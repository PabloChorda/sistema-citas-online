# backend/app/routes/establishment.py

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import (
    Establishment,
    Provider,
    Service,
    AvailabilityRule,
    Appointment,
    Staff,
    StaffAvailabilityRule,
    CalendarBlackout,
)
from datetime import datetime, timedelta, time, timezone

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
        establishments = Establishment.query.filter_by(
            activo=True,
            visible_en_busquedas=True
        ).order_by(Establishment.nombre).all()

        return jsonify([est.to_public_dict() for est in establishments]), 200
    except Exception as e:
        current_app.logger.error(f"Error listando establecimientos públicos: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al obtener los establecimientos."}), 500


# --- RUTAS PÚBLICAS EXISTENTES (detalles y horarios) ---

@establishment_bp.route('/public/establishments/<int:establishment_id>', methods=['GET'])
def get_public_establishment_details(establishment_id):
    """
    Obtiene los detalles públicos de un establecimiento para la página de reserva.
    """
    establishment = Establishment.query.filter_by(id=establishment_id, activo=True).first()
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado o inactivo."}), 404

    establishment_data = establishment.to_public_dict()
    services = Service.query.filter_by(establishment_id=establishment.id, is_active=True).all()
    establishment_data['services'] = [service.to_dict() for service in services]
    return jsonify(establishment_data), 200


@establishment_bp.route('/establishments/<int:establishment_id>/available-slots', methods=['GET'])
def get_available_slots(establishment_id):
    """
    Calcula los huecos disponibles. Consciente del modo 'staff'
    y filtra por festivos/blackouts.
    Acepta un parámetro opcional 'staff_id' para filtrar por un empleado específico.
    """
    # --- 1. OBTENCIÓN DE PARÁMETROS ---
    date_str = request.args.get('date')
    service_id_str = request.args.get('service_id')
    staff_id_str = request.args.get('staff_id')  # Opcional

    if not date_str or not service_id_str:
        return jsonify({"msg": "Los parámetros 'date' y 'service_id' son requeridos."}), 400

    try:
        requested_dt_naive = datetime.strptime(date_str, '%Y-%m-%d')
        service_id = int(service_id_str)
        staff_id = int(staff_id_str) if staff_id_str else None
    except (ValueError, TypeError):
        return jsonify({"msg": "Formato de fecha o IDs inválido."}), 400

    # --- 2. OBTENCIÓN DE ENTIDADES ---
    establishment = Establishment.query.get(establishment_id)
    if not establishment or not establishment.activo:
        return jsonify({"msg": "Establecimiento no encontrado o inactivo."}), 404

    service = Service.query.get(service_id)
    if not service or not service.is_active:
        return jsonify({"msg": "Servicio no encontrado o inactivo."}), 404

    if service.establishment_id != establishment_id:
        return jsonify({"msg": "Este servicio no pertenece a este establecimiento."}), 400

    provider = establishment.provider
    if not provider or not provider.timezone:
        return jsonify({"msg": "La zona horaria del proveedor no está configurada."}), 500

    try:
        from zoneinfo import ZoneInfo
        provider_tz = ZoneInfo(provider.timezone)
    except Exception:
        return jsonify({"msg": "Error de configuración de zona horaria en el servidor."}), 500

    # --- 3. LÓGICA DE CÁLCULO ---
    service_duration = timedelta(minutes=service.duracion_minutos)
    start_of_day_local = datetime.combine(requested_dt_naive.date(), time.min, tzinfo=provider_tz)
    day_map = {0: 'LUNES', 1: 'MARTES', 2: 'MIERCOLES', 3: 'JUEVES', 4: 'VIERNES', 5: 'SABADO', 6: 'DOMINGO'}
    day_of_week = day_map.get(start_of_day_local.weekday())
    day_local_date = start_of_day_local.date()

    if not day_of_week:
        return jsonify([]), 200

    # Festivos (opcional) + blackouts
    if _is_public_holiday(establishment, day_local_date):
        return jsonify([]), 200

    full_blackout, partial_blackouts_utc = _get_blackout_intervals_utc(
        establishment_id=establishment_id,
        day_local=day_local_date,
        provider_tz=provider_tz,
        timezone_mod=timezone,
    )
    if full_blackout:
        return jsonify([]), 200

    # Modo staff vs modo sencillo
    if establishment.has_multiple_staff:
        query_staff = Staff.query.join(Staff.services).filter(
            Staff.establishment_id == establishment_id,
            Staff.activo.is_(True),
            Service.id == service_id
        )
        if staff_id:
            query_staff = query_staff.filter(Staff.id == staff_id)

        available_staff = query_staff.all()
        if not available_staff:
            return jsonify([]), 200

        working_intervals = []
        for member in available_staff:
            rules = StaffAvailabilityRule.query.filter_by(staff_id=member.id, dia_semana=day_of_week).all()
            for rule in rules:
                working_intervals.append({
                    "staff_id": member.id,
                    "start": datetime.combine(start_of_day_local.date(), rule.hora_inicio, tzinfo=provider_tz),
                    "end": datetime.combine(start_of_day_local.date(), rule.hora_fin,   tzinfo=provider_tz)
                })
    else:
        rules = AvailabilityRule.query.filter_by(
            establishment_id=establishment_id,
            dia_semana=day_of_week,
            activo=True
        ).all()
        if not rules:
            return jsonify([]), 200

        working_intervals = [{
            "staff_id": None,
            "start": datetime.combine(start_of_day_local.date(), rule.hora_inicio, tzinfo=provider_tz),
            "end": datetime.combine(start_of_day_local.date(), rule.hora_fin,   tzinfo=provider_tz)
        } for rule in rules]

    # --- 4. Generación de huecos ---
    start_of_day_utc = start_of_day_local.astimezone(timezone.utc)
    end_of_day_utc = start_of_day_utc + timedelta(days=1)

    existing_appointments = Appointment.query.join(Service).filter(
        Service.establishment_id == establishment_id,
        Appointment.start_time >= start_of_day_utc,
        Appointment.start_time < end_of_day_utc,
        Appointment.estado.in_(['CONFIRMED', 'PENDING_PROVIDER'])
    ).all()

    booked_slots_by_staff = {}
    for appt in existing_appointments:
        key = appt.staff_id or 'establishment'
        booked_slots_by_staff.setdefault(key, []).append({'start': appt.start_time, 'end': appt.end_time})

    final_slots = set()
    now_utc = datetime.now(timezone.utc)
    slot_increment = timedelta(minutes=15)

    for interval in working_intervals:
        current_staff_id = interval['staff_id']
        booked_slots = booked_slots_by_staff.get(current_staff_id, []) if current_staff_id else booked_slots_by_staff.get('establishment', [])

        current_slot_start = interval['start'].astimezone(timezone.utc)
        working_end = interval['end'].astimezone(timezone.utc)

        while current_slot_start + service_duration <= working_end:
            if current_slot_start >= now_utc:
                slot_end = current_slot_start + service_duration

                is_booked = any(_overlaps(current_slot_start, slot_end, b['start'], b['end']) for b in booked_slots)
                is_in_blackout = any(_overlaps(current_slot_start, slot_end, b0, b1) for (b0, b1) in partial_blackouts_utc)

                if not is_booked and not is_in_blackout:
                    slot_in_provider_tz = current_slot_start.astimezone(provider_tz)
                    final_slots.add(slot_in_provider_tz.strftime('%H:%M'))

            current_slot_start += slot_increment

    return jsonify(sorted(list(final_slots))), 200


# --- RUTAS PRIVADAS (requieren autenticación) ---

def get_provider_id_from_jwt():
    """Función helper para obtener y validar el ID del provider desde el token JWT."""
    try:
        return int(get_jwt_identity())
    except (ValueError, TypeError):
        return None

@establishment_bp.route('/establishments/<int:establishment_id>', methods=['GET'])
@jwt_required()
def get_establishment(establishment_id):
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    establishment = Establishment.query.get(establishment_id)
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado"}), 404

    if establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado."}), 403

    return jsonify(establishment.to_private_dict()), 200


@establishment_bp.route('/establishments', methods=['POST'])
@jwt_required()
def create_establishment():
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    provider = Provider.query.get(provider_id)
    if not provider:
        return jsonify({"msg": "Acceso denegado. Se requiere perfil de proveedor."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos (payload vacío)"}), 400

    required_fields = ['nombre', 'direccion_completa', 'provincia', 'localidad']
    if any(field not in data for field in required_fields):
        return jsonify({"msg": f"Faltan datos requeridos: {', '.join(required_fields)}"}), 400

    try:
        new_establishment = Establishment(
            provider_id=provider_id,
            nombre=data['nombre'],
            direccion_completa=data['direccion_completa'],
            provincia=data['provincia'],
            localidad=data['localidad'],
            codigo_postal=data.get('codigo_postal'),
            telefono=data.get('telefono'),
            email=data.get('email'),
            web=data.get('web'),
            descripcion_publica=data.get('descripcion_publica'),
        )
        db.session.add(new_establishment)
        db.session.commit()
        return jsonify(new_establishment.to_private_dict()), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creando establecimiento: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al crear el establecimiento"}), 500


@establishment_bp.route('/establishments/<int:establishment_id>', methods=['PUT'])
@jwt_required()
def update_establishment(establishment_id):
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    establishment = Establishment.query.get(establishment_id)
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado"}), 404

    if establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado. No eres el propietario."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos"}), 400

    # ⚠️ Incluye settings de festivos automáticos
    editable_fields = [
        'nombre', 'direccion_completa', 'provincia', 'localidad',
        'codigo_postal', 'telefono', 'email', 'web', 'descripcion_publica', 'activo',
        'has_multiple_staff',
        'holiday_auto_enabled', 'holiday_country_code', 'holiday_region_code',
        'holiday_types', 'holiday_years_ahead'
    ]
    for field in editable_fields:
        if field in data:
            setattr(establishment, field, data[field])
    for field in editable_fields:
        if field in data:
            # Coerciones suaves para booleanos que podrían venir como string
            if field in ('has_multiple_staff', 'holiday_auto_enabled', 'activo'):
                val = data[field]
                if isinstance(val, str):
                    val = val.strip().lower() in ('1', 'true', 't', 'yes', 'y')
                setattr(establishment, field, bool(val))
            else:
                setattr(establishment, field, data[field])

    # Normaliza region si viene vacía
    if 'holiday_region_code' in data and not data['holiday_region_code']:
        establishment.holiday_region_code = None

    try:
        db.session.commit()
        return jsonify(establishment.to_private_dict()), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error en update_establishment: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al actualizar"}), 500


@establishment_bp.route('/establishments/<int:establishment_id>', methods=['DELETE'])
@jwt_required()
def delete_establishment(establishment_id):
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    establishment = Establishment.query.get(establishment_id)
    if not establishment:
        return jsonify({"msg": "Operación no permitida"}), 404

    if establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado."}), 403

    try:
        db.session.delete(establishment)
        db.session.commit()
        return jsonify({"msg": "Establecimiento eliminado correctamente"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error eliminando establecimiento: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al eliminar"}), 500


@establishment_bp.route('/establishments/<int:establishment_id>/appointments', methods=['GET'])
@jwt_required()
def get_establishment_appointments(establishment_id):
    """
    GET /api/establishments/<id>/appointments
    -----------------------------------------
    Obtiene las citas de un establecimiento para un rango de fechas.
    Acepta parámetros:
      - 'start' y 'end' (YYYY-MM-DD)  ✅
      - o 'start_date' y 'end_date' (YYYY-MM-DD) ✅ (compatibilidad)
    Opcionales:
      - 'staff_id' para filtrar por empleado
      - 'status' (p.ej. CONFIRMED, PENDING_PROVIDER, CANCELLED). Si viene con
        varios separados por coma, se aplicará un IN.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Token inválido"}), 422

    establishment = Establishment.query.get(establishment_id)
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado."}), 404

    if establishment.provider_id != provider_id:
        return jsonify({"msg": "No tienes permiso para ver las citas de este establecimiento."}), 403

    # Soporta 'start/end' y 'start_date/end_date'
    start_str = request.args.get('start') or request.args.get('start_date')
    end_str   = request.args.get('end')   or request.args.get('end_date')

    if not start_str or not end_str:
        return jsonify({"msg": "Los parámetros 'start' y 'end' (o 'start_date' y 'end_date') son requeridos."}), 400

    try:
        start_date = datetime.strptime(start_str, '%Y-%m-%d').date()
        end_date   = datetime.strptime(end_str,   '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"msg": "Formato de fecha inválido. Usa YYYY-MM-DD."}), 400

    # Normalizamos a datetimes UTC (inicio del día y del día siguiente)
    # end_date se toma como EXCLUSIVO (estilo FullCalendar)
    start_dt_utc = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end_dt_utc   = datetime.combine(end_date,   time.min, tzinfo=timezone.utc)

    # Filtros opcionales
    staff_id = request.args.get('staff_id', type=int)
    status_param = request.args.get('status')  # Puede ser simple o lista separada por comas

    query = Appointment.query.join(Service).filter(
        Service.establishment_id == establishment_id,
        Appointment.start_time >= start_dt_utc,
        Appointment.start_time < end_dt_utc
    )

    if staff_id is not None:
        query = query.filter(Appointment.staff_id == staff_id)

    if status_param:
        statuses = [s.strip() for s in status_param.split(',') if s.strip()]
        if len(statuses) == 1:
            query = query.filter(Appointment.estado == statuses[0])
        elif len(statuses) > 1:
            query = query.filter(Appointment.estado.in_(statuses))

    appointments = query.order_by(Appointment.start_time.asc()).all()
    return jsonify([appt.to_dict() for appt in appointments]), 200


# ----- Helpers para festivos / blackouts -----

def _overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end

def _get_blackout_intervals_utc(establishment_id, day_local, provider_tz, timezone_mod):
    """
    Devuelve:
      - full_day: bool si ese día está bloqueado entero
      - partials_utc: lista de tuplas (start_utc, end_utc) para bloqueos parciales
    """
    full = CalendarBlackout.query.filter_by(
        establishment_id=establishment_id, fecha=day_local, es_dia_completo=True
    ).first()
    if full:
        return True, []

    partials = CalendarBlackout.query.filter_by(
        establishment_id=establishment_id, fecha=day_local, es_dia_completo=False
    ).all()

    from datetime import datetime as dt  # alias local
    partials_utc = []
    for b in partials:
        start_local = dt.combine(day_local, b.hora_inicio, tzinfo=provider_tz)
        end_local   = dt.combine(day_local, b.hora_fin,   tzinfo=provider_tz)
        partials_utc.append((
            start_local.astimezone(timezone_mod.utc),
            end_local.astimezone(timezone_mod.utc),
        ))
    return False, partials_utc

def _is_public_holiday(establishment, day_local):
    """
    Opcional: festivos automáticos con python-holidays.
    Por defecto NO bloquea, salvo que añadas un flag estilo block_public_holidays en el modelo.
    """
    block = getattr(establishment, "block_public_holidays", False)
    if not block:
        return False
    try:
        import holidays as pyholidays  # type: ignore
    except Exception:
        return False

    country = getattr(establishment, "country_code", "ES")
    region  = getattr(establishment, "region_code", None)  # ej. 'VC'
    hcal = pyholidays.country_holidays(country, subdiv=region, years=[day_local.year])
    return day_local in hcal
