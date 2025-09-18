# backend/app/routes/appointment.py

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import (
    Appointment,
    Service,
    User,
    CalendarBlackout,
    Staff,
    StaffAvailabilityRule,
)
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


appointment_bp = Blueprint('appointment', __name__)

def get_user_id_from_jwt():
    try:
        return int(get_jwt_identity())
    except (ValueError, TypeError):
        return None

@appointment_bp.route('/appointments', methods=['POST'])
@jwt_required()
def create_appointment():
    """
    POST /api/appointments
    =======================
    """
    from .email_service import send_appointment_confirmation_emails
    user_id = get_user_id_from_jwt()
    if not user_id: return jsonify({"msg": "Token inválido"}), 422

    client = User.query.get(user_id)
    if not client or client.role != 'client':
        return jsonify({"msg": "Solo los clientes pueden crear citas."}), 403

    data = request.get_json()
    required_fields = ['service_id', 'start_time']
    if not data or any(f not in data for f in required_fields):
        return jsonify({"msg": f"Faltan datos requeridos: {', '.join(required_fields)}"}), 400

    try:
        service_id = int(data['service_id'])
        start_time_obj = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        # --- 1. OBTENEMOS EL staff_id (OPCIONAL) DEL JSON ---
        staff_id = data.get('staff_id')
    except (ValueError, TypeError):
        return jsonify({"msg": "Formato de service_id o start_time inválido."}), 400
    
    service = Service.query.get(service_id)
    if not service or not service.is_active:
        return jsonify({"msg": "Servicio no encontrado o inactivo."}), 404
        
    end_time_obj = start_time_obj + timedelta(minutes=service.duracion_minutos)

    # --- BLOQUEO POR BLACKOUT (DÍA COMPLETO O PARCIAL) ---
    conflict, reason = _blackout_conflict(service.establishment, start_time_obj, end_time_obj)
    if conflict:
        return jsonify({"msg": f"No se puede reservar en esta fecha/franja: {reason}."}), 409

    # --- ASIGNACIÓN AUTOMÁTICA DE STAFF SI EL LOCAL ES MULTI-STAFF Y NO VIENE staff_id ---
    if service.establishment.has_multiple_staff and not staff_id:
        auto_staff_id = _pick_free_staff(service, start_time_obj, end_time_obj)
        if not auto_staff_id:
            return jsonify({"msg": "No hay profesionales disponibles en ese horario."}), 409
        staff_id = auto_staff_id

    # --- 2. VALIDACIÓN DE SOLAPAMIENTO MEJORADA (CONSCIENTE DEL STAFF) ---
    query = Appointment.query.join(Service).filter(
        Service.establishment_id == service.establishment_id,
        Appointment.start_time < end_time_obj,
        Appointment.end_time > start_time_obj,
        Appointment.estado.in_(['CONFIRMED', 'PENDING_PROVIDER'])
    )

    if service.establishment.has_multiple_staff and staff_id:
        # Si se eligió/asignó un empleado, solo nos importa si ESE empleado está ocupado.
        query = query.filter(Appointment.staff_id == staff_id)
    
    overlapping = query.first()
    if overlapping:
        return jsonify({"msg": "Este horario con este profesional acaba de ser reservado. Por favor, elige otro."}), 409

    # --- 3. GUARDAMOS EL staff_id EN LA NUEVA CITA ---
    new_appointment = Appointment(
        user_id=user_id,
        service_id=service_id,
        start_time=start_time_obj,
        end_time=end_time_obj,
        estado='CONFIRMED',
        precio_final=service.precio,
        notas_cliente=data.get('notes_client'),
        staff_id=staff_id
    )
    db.session.add(new_appointment)
    db.session.commit()
    
    try:
        send_appointment_confirmation_emails(new_appointment)
    except Exception as e:
        current_app.logger.error(f"La cita {new_appointment.id} se creó, pero falló el envío de emails: {e}", exc_info=True)

    return jsonify(new_appointment.to_dict()), 201

@appointment_bp.route('/appointments/client', methods=['GET'])
@jwt_required()
def get_client_appointments():
    user_id = get_user_id_from_jwt()
    if not user_id: return jsonify({"msg": "Token inválido"}), 422

    appointments = Appointment.query.filter_by(user_id=user_id).order_by(Appointment.start_time.desc()).all()
    return jsonify([appt.to_dict() for appt in appointments]), 200

@appointment_bp.route('/appointments/<int:appointment_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_appointment(appointment_id):
    from .email_service import send_appointment_cancellation_email

    user_id = get_user_id_from_jwt()
    if not user_id: return jsonify({"msg": "Token inválido"}), 422

    user = User.query.get(user_id)
    appointment = Appointment.query.get(appointment_id)

    if not appointment: return jsonify({"msg": "Cita no encontrada."}), 404

    is_client_owner = (user.role == 'client' and appointment.user_id == user_id)
    is_provider_owner = (user.role == 'provider' and user.provider_profile and 
                         appointment.service.establishment.provider_id == user.provider_profile.provider_id)

    if not (is_client_owner or is_provider_owner):
        return jsonify({"msg": "No tienes permiso para cancelar esta cita."}), 403

    if str(appointment.estado).startswith('CANCELLED'):
        return jsonify({"msg": "Esta cita ya ha sido cancelada."}), 400
        
    if appointment.start_time < datetime.now(timezone.utc):
        return jsonify({"msg": "No se puede cancelar una cita que ya ha comenzado o pasado."}), 400

    cancelled_by_role = 'client' if is_client_owner else 'provider'
    new_status = f'CANCELLED_BY_{cancelled_by_role.upper()}'
    appointment.estado = new_status
    db.session.commit()
    
    try:
        send_appointment_cancellation_email(appointment, cancelled_by_role)
    except Exception as e:
        current_app.logger.error(f"La cita {appointment.id} se canceló, pero falló el envío de email de notificación: {e}", exc_info=True)

    return jsonify(appointment.to_dict()), 200


@appointment_bp.route('/appointments/<int:appointment_id>/reschedule', methods=['PUT'])
@jwt_required()
def reschedule_appointment(appointment_id):
    """
    PUT /api/appointments/<id>/reschedule
    Reprograma una cita a una nueva fecha/hora.
    Ahora permite que tanto el proveedor como el cliente (dueño) la usen.
    """
    # Import local para evitar NameError si no está cargado a nivel módulo
    from .email_service import send_appointment_rescheduled_email

    user_id = get_user_id_from_jwt()
    if not user_id: return jsonify({"msg": "Token inválido"}), 422

    user = User.query.get(user_id)
    appointment = Appointment.query.get(appointment_id)

    if not appointment:
        return jsonify({"msg": "Cita no encontrada."}), 404

    # --- 1. LÓGICA DE PERMISOS ACTUALIZADA ---
    is_client_owner = (user.role == 'client' and appointment.user_id == user_id)
    is_provider_owner = (user.role == 'provider' and user.provider_profile and 
                         appointment.service.establishment.provider_id == user.provider_profile.provider_id)

    if not (is_client_owner or is_provider_owner):
        return jsonify({"msg": "No tienes permiso para reprogramar esta cita."}), 403

    # --- Validación del estado de la cita ---
    if appointment.estado != 'CONFIRMED':
        return jsonify({"msg": "Solo se pueden reprogramar citas confirmadas."}), 400

    # --- 2. NUEVA VALIDACIÓN: LÍMITE DE ANTELACIÓN DE 24 HORAS ---
    if is_client_owner:
        time_until_appointment = appointment.start_time - datetime.now(timezone.utc)
        if time_until_appointment < timedelta(hours=24):
            return jsonify({"msg": "No se puede reprogramar una cita con menos de 24 horas de antelación."}), 403

    data = request.get_json()
    if not data or 'new_start_time' not in data:
        return jsonify({"msg": "Se requiere 'new_start_time'."}), 400

    try:
        new_start_time_obj = datetime.fromisoformat(data['new_start_time'].replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return jsonify({"msg": "Formato de 'new_start_time' inválido."}), 400

    service = appointment.service
    new_end_time_obj = new_start_time_obj + timedelta(minutes=service.duracion_minutos)

    # --- BLOQUEO POR BLACKOUT (DÍA COMPLETO O PARCIAL) ---
    conflict, reason = _blackout_conflict(service.establishment, new_start_time_obj, new_end_time_obj)
    if conflict:
        return jsonify({"msg": f"No se puede reprogramar a esa fecha/franja: {reason}."}), 409

    overlapping = Appointment.query.join(Service).filter(
        Appointment.id != appointment_id,
        Service.establishment_id == service.establishment_id,
        Appointment.start_time < new_end_time_obj,
        Appointment.end_time > new_start_time_obj,
        Appointment.estado.in_(['CONFIRMED', 'PENDING_PROVIDER'])
    ).first()

    if overlapping:
        return jsonify({"msg": "El nuevo horario seleccionado ya no está disponible."}), 409

    old_start_time = appointment.start_time
    appointment.end_time = new_end_time_obj
    appointment.start_time = new_start_time_obj
    
    db.session.commit()
    
    try:
        send_appointment_rescheduled_email(appointment, old_start_time)
    except Exception as e:
        current_app.logger.error(f"La cita {appointment.id} se reprogramó, pero falló el envío de email: {e}", exc_info=True)

    return jsonify(appointment.to_dict()), 200

@appointment_bp.route('/appointments/client/next', methods=['GET'])
@jwt_required()
def get_client_next_appointment():
    user_id = get_user_id_from_jwt()
    if not user_id: return jsonify({"msg": "Token inválido"}), 422
    
    now_utc = datetime.now(timezone.utc)
    next_appointment = Appointment.query.filter(
        Appointment.user_id == user_id,
        Appointment.start_time >= now_utc,
        Appointment.estado == 'CONFIRMED'
    ).order_by(Appointment.start_time.asc()).first()

    if not next_appointment:
        return jsonify(None), 200

    return jsonify(next_appointment.to_dict()), 200


def _blackout_conflict(establishment, start_utc, end_utc):
    """
    Devuelve (True, msg) si hay conflicto con un blackout del establecimiento
    entre start_utc y end_utc, teniendo en cuenta el huso horario del provider.
    Si no hay conflicto, devuelve (False, None).
    """
    provider_tz_name = establishment.provider.timezone if establishment and establishment.provider else None
    if not provider_tz_name:
        # Sin TZ: no bloqueamos aquí (available-slots ya lo evita)
        return (False, None)

    tz = ZoneInfo(provider_tz_name)
    start_local = start_utc.astimezone(tz)
    end_local = end_utc.astimezone(tz)

    dates_to_check = {start_local.date(), end_local.date()}

    # 1) Día completo
    full_day = CalendarBlackout.query.filter(
        CalendarBlackout.establishment_id == establishment.id,
        CalendarBlackout.es_dia_completo.is_(True),
        CalendarBlackout.fecha.in_(list(dates_to_check))
    ).first()
    if full_day:
        return (True, full_day.nombre or "Día no disponible")

    # 2) Parciales
    partials = CalendarBlackout.query.filter(
        CalendarBlackout.establishment_id == establishment.id,
        CalendarBlackout.es_dia_completo.is_(False),
        CalendarBlackout.fecha.in_(list(dates_to_check))
    ).all()

    for b in partials:
        b_start_local = datetime.combine(b.fecha, b.hora_inicio, tzinfo=tz)
        b_end_local = datetime.combine(b.fecha, b.hora_fin, tzinfo=tz)
        if start_local < b_end_local and end_local > b_start_local:
            return (True, b.nombre or "Franja no disponible")

    return (False, None)


def _pick_free_staff(service: Service, start_utc: datetime, end_utc: datetime):
    """
    Devuelve un staff_id disponible que pueda realizar el servicio en el intervalo dado,
    respetando las reglas de disponibilidad del staff y evitando solapamientos de citas.
    Si no hay candidato válido, devuelve None.
    """
    est = service.establishment
    if not est or not est.has_multiple_staff:
        return None

    # Staff que puede hacer el servicio
    eligible = Staff.query.join(Staff.services).filter(
        Staff.establishment_id == est.id,
        Staff.activo.is_(True),
        Service.id == service.id
    ).all()
    if not eligible:
        return None

    tzname = est.provider.timezone if est.provider else None
    tz = ZoneInfo(tzname) if tzname else timezone.utc

    start_local = start_utc.astimezone(tz)
    end_local = end_utc.astimezone(tz)
    day_map = {0: 'LUNES', 1: 'MARTES', 2: 'MIERCOLES', 3: 'JUEVES', 4: 'VIERNES', 5: 'SABADO', 6: 'DOMINGO'}
    dow = day_map[start_local.weekday()]

    for st in eligible:
        # Reglas del staff que cubran completamente el slot
        rules = StaffAvailabilityRule.query.filter_by(staff_id=st.id, dia_semana=dow).all()
        covers = any(
            datetime.combine(start_local.date(), r.hora_inicio, tzinfo=tz) <= start_local and
            datetime.combine(start_local.date(), r.hora_fin, tzinfo=tz) >= end_local
            for r in rules
        )
        if not covers:
            continue

        # Sin cita solapada para ese staff
        conflict = Appointment.query.join(Service).filter(
            Service.establishment_id == est.id,
            Appointment.staff_id == st.id,
            Appointment.estado.in_(['CONFIRMED', 'PENDING_PROVIDER']),
            Appointment.start_time < end_utc,
            Appointment.end_time > start_utc
        ).first()
        if conflict:
            continue

        return st.id  # candidato válido

    return None
