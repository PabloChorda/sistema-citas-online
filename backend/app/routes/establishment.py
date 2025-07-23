# backend/app/routes/establishment.py

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Establishment, Provider, Service, AvailabilityRule, Appointment
from datetime import datetime, date, timedelta, time, timezone

establishment_bp = Blueprint('establishment', __name__)

# --- RUTA PÚBLICA PARA LISTAR ESTABLECIMIENTOS ---
@establishment_bp.route('/public/establishments', methods=['GET'])
def list_public_establishments():
    """
    GET /api/public/establishments
    ------------------------------
    Obtiene una lista de todos los establecimientos activos y visibles
    para el marketplace o directorio público. No requiere autenticación.
    """
    try:
        # Filtramos para mostrar solo los locales que el proveedor ha decidido hacer públicos
        establishments = Establishment.query.filter_by(
            activo=True,
            visible_en_busquedas=True
        ).order_by(Establishment.nombre).all()

        # Usamos el método to_dict() que ya existe en el modelo Establishment
        return jsonify([est.to_dict() for est in establishments]), 200
    except Exception as e:
        current_app.logger.error(f"Error listando establecimientos públicos: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al obtener los establecimientos."}), 500


# --- RUTAS PÚBLICAS EXISTENTES (detalles y horarios) ---

@establishment_bp.route('/public/establishments/<int:establishment_id>', methods=['GET'])
def get_public_establishment_details(establishment_id):
    # (Tu código existente se mantiene igual)
    establishment = Establishment.query.filter_by(id=establishment_id, activo=True).first()
    if not establishment: return jsonify({"msg": "Establecimiento no encontrado o inactivo."}), 404
    services = Service.query.filter_by(establishment_id=establishment.id, is_active=True).all()
    return jsonify({
        "id": establishment.id, "nombre": establishment.nombre,
        "direccion_completa": establishment.direccion_completa,
        "services": [service.to_dict() for service in services]
    }), 200

@establishment_bp.route('/establishments/<int:establishment_id>/available-slots', methods=['GET'])
def get_available_slots(establishment_id):
    """ Calcula y devuelve los huecos de tiempo disponibles (ruta pública). """
    date_str = request.args.get('date')
    service_id_str = request.args.get('service_id')

    if not date_str or not service_id_str:
        return jsonify({"msg": "Los parámetros 'date' y 'service_id' son requeridos."}), 400

    try:
        requested_dt_naive = datetime.strptime(date_str, '%Y-%m-%d')
        service_id = int(service_id_str)
    except (ValueError, TypeError):
        return jsonify({"msg": "Formato de fecha o service_id inválido."}), 400

    establishment = Establishment.query.get(establishment_id)
    if not establishment or not establishment.activo: return jsonify({"msg": "Establecimiento no encontrado o inactivo."}), 404
    
    service = Service.query.get(service_id)
    if not service or not service.is_active: return jsonify({"msg": "Servicio no encontrado o inactivo."}), 404
    
    if service.establishment_id != establishment_id:
        return jsonify({"msg": "Este servicio no pertenece a este establecimiento."}), 400

    provider = establishment.provider
    if not provider.timezone: return jsonify({"msg": "La zona horaria del proveedor no está configurada."}), 500

    try:
        from zoneinfo import ZoneInfo
        provider_tz = ZoneInfo(provider.timezone)
    except Exception:
        return jsonify({"msg": "Error de configuración de zona horaria en el servidor."}), 500

    start_of_day_local = datetime.combine(requested_dt_naive.date(), time.min, tzinfo=provider_tz)
    day_map = {0: 'LUNES', 1: 'MARTES', 2: 'MIERCOLES', 3: 'JUEVES', 4: 'VIERNES', 5: 'SABADO', 6: 'DOMINGO'}
    day_of_week = day_map.get(start_of_day_local.weekday())
    
    if not day_of_week: return jsonify([]), 200

    availability_rules = AvailabilityRule.query.filter_by(establishment_id=establishment_id, dia_semana=day_of_week, activo=True).all()
    if not availability_rules: return jsonify([]), 200

    start_of_day_utc = start_of_day_local.astimezone(timezone.utc)
    end_of_day_utc = start_of_day_utc + timedelta(days=1)
    
    existing_appointments = Appointment.query.join(Service).filter(
        Service.establishment_id == establishment_id,
        Appointment.start_time >= start_of_day_utc,
        Appointment.start_time < end_of_day_utc,
        Appointment.estado.in_(['CONFIRMED', 'PENDING_PROVIDER'])
    ).all()
    
    booked_slots = [{'start': appt.start_time, 'end': appt.end_time} for appt in existing_appointments]

    final_slots = []
    service_duration = timedelta(minutes=service.duracion_minutos)
    slot_increment = timedelta(minutes=15)
    now_utc = datetime.now(timezone.utc)

    for rule in availability_rules:
        start_dt_local_rule = datetime.combine(start_of_day_local.date(), rule.hora_inicio, tzinfo=provider_tz)
        end_dt_local_rule = datetime.combine(start_of_day_local.date(), rule.hora_fin, tzinfo=provider_tz)
        
        current_slot_start = start_dt_local_rule.astimezone(timezone.utc)
        working_end = end_dt_local_rule.astimezone(timezone.utc)

        while current_slot_start + service_duration <= working_end:
            if current_slot_start >= now_utc:
                slot_end = current_slot_start + service_duration
                is_booked = any((current_slot_start < booked['end'] and slot_end > booked['start']) for booked in booked_slots)
                if not is_booked:
                    slot_in_provider_tz = current_slot_start.astimezone(provider_tz)
                    final_slots.append(slot_in_provider_tz.strftime('%H:%M'))
            
            current_slot_start += slot_increment
            
    return jsonify(sorted(list(set(final_slots)))), 200

# --- RUTAS PRIVADAS (requieren autenticación) ---

def get_provider_id_from_jwt():
    """Función helper para obtener y validar el ID del provider desde el token JWT."""
    try: return int(get_jwt_identity())
    except (ValueError, TypeError): return None

@establishment_bp.route('/establishments/<int:establishment_id>', methods=['GET'])
@jwt_required()
def get_establishment(establishment_id):
    # (Tu código existente se mantiene igual)
    provider_id = get_provider_id_from_jwt()
    if not provider_id: return jsonify({"msg": "Identidad del token inválida"}), 422
    establishment = Establishment.query.get(establishment_id)
    if not establishment: return jsonify({"msg": "Establecimiento no encontrado"}), 404
    if establishment.provider_id != provider_id: return jsonify({"msg": "Acceso denegado."}), 403
    return jsonify(establishment.to_dict()), 200

@establishment_bp.route('/establishments', methods=['POST'])
@jwt_required()
def create_establishment():
    # (Tu código existente se mantiene igual)
    provider_id = get_provider_id_from_jwt()
    if not provider_id: return jsonify({"msg": "Identidad del token inválida"}), 422
    provider = Provider.query.get(provider_id)
    if not provider: return jsonify({"msg": "Acceso denegado. Se requiere perfil de proveedor."}), 403
    data = request.get_json()
    if not data: return jsonify({"msg": "No se recibieron datos (payload vacío)"}), 400
    required_fields = ['nombre', 'direccion_completa', 'provincia', 'localidad']
    if any(field not in data for field in required_fields): return jsonify({"msg": f"Faltan datos requeridos: {', '.join(required_fields)}"}), 400
    try:
        new_establishment = Establishment(provider_id=provider_id, nombre=data['nombre'], direccion_completa=data['direccion_completa'], provincia=data['provincia'], localidad=data['localidad'], codigo_postal=data.get('codigo_postal'), telefono=data.get('telefono'), email=data.get('email'))
        db.session.add(new_establishment)
        db.session.commit()
        return jsonify(new_establishment.to_dict()), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error interno al crear el establecimiento"}), 500

@establishment_bp.route('/establishments/<int:establishment_id>', methods=['PUT'])
@jwt_required()
def update_establishment(establishment_id):
    # (Tu código existente se mantiene igual)
    provider_id = get_provider_id_from_jwt()
    if not provider_id: return jsonify({"msg": "Identidad del token inválida"}), 422
    establishment = Establishment.query.get(establishment_id)
    if not establishment: return jsonify({"msg": "Establecimiento no encontrado"}), 404
    if establishment.provider_id != provider_id: return jsonify({"msg": "Acceso denegado. No eres el propietario."}), 403
    data = request.get_json()
    if not data: return jsonify({"msg": "No se recibieron datos"}), 400
    editable_fields = ['nombre', 'direccion_completa', 'provincia', 'localidad', 'codigo_postal', 'telefono', 'email', 'web', 'descripcion_publica', 'activo']
    for field in editable_fields:
        if field in data:
            setattr(establishment, field, data[field])
    try:
        db.session.commit()
        return jsonify(establishment.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error interno al actualizar"}), 500

@establishment_bp.route('/establishments/<int:establishment_id>', methods=['DELETE'])
@jwt_required()
def delete_establishment(establishment_id):
    # (Tu código existente se mantiene igual)
    provider_id = get_provider_id_from_jwt()
    if not provider_id: return jsonify({"msg": "Identidad del token inválida"}), 422
    establishment = Establishment.query.get(establishment_id)
    if not establishment: return jsonify({"msg": "Operación no permitida"}), 404
    if establishment.provider_id != provider_id: return jsonify({"msg": "Acceso denegado."}), 403
    try:
        db.session.delete(establishment)
        db.session.commit()
        return jsonify({"msg": "Establecimiento eliminado correctamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error interno al eliminar"}), 500

@establishment_bp.route('/establishments/<int:establishment_id>/appointments', methods=['GET'])
@jwt_required()
def get_establishment_appointments(establishment_id):
    # (Tu código existente se mantiene igual)
    provider_id = get_provider_id_from_jwt()
    if not provider_id: return jsonify({"msg": "Token inválido"}), 422
    establishment = Establishment.query.get(establishment_id)
    if not establishment: return jsonify({"msg": "Establecimiento no encontrado."}), 404
    if establishment.provider_id != provider_id: return jsonify({"msg": "No tienes permiso para ver las citas de este establecimiento."}), 403
    appointments = Appointment.query.join(Service).filter(Service.establishment_id == establishment_id).order_by(Appointment.start_time.desc()).all()
    return jsonify([appt.to_dict() for appt in appointments]), 200