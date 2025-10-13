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
    Permiso: cliente dueño o proveedor dueño del establecimiento.
    Valida blackouts y, si aplica, disponibilidad/solapes del staff asignado.
    """
    from .email_service import send_appointment_rescheduled_email

    user_id = get_user_id_from_jwt()
    if not user_id:
        return jsonify({"msg": "Token inválido"}), 422

    user = User.query.get(user_id)
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({"msg": "Cita no encontrada."}), 404

    # Permisos
    is_client_owner = (user.role == 'client' and appointment.user_id == user_id)
    is_provider_owner = (user.role == 'provider' and user.provider_profile and
                         appointment.service.establishment.provider_id == user.provider_profile.provider_id)
    if not (is_client_owner or is_provider_owner):
        return jsonify({"msg": "No tienes permiso para reprogramar esta cita."}), 403

    # Estado válido
    if appointment.estado != 'CONFIRMED':
        return jsonify({"msg": "Solo se pueden reprogramar citas confirmadas."}), 400

    # Límite antelación cliente (24h)
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
    est = service.establishment
    new_end_time_obj = new_start_time_obj + timedelta(minutes=service.duracion_minutos)

    # Blackouts (día completo / parciales) -> 409
    conflict, reason = _blackout_conflict(est, new_start_time_obj, new_end_time_obj)
    if conflict:
        return jsonify({"msg": f"No se puede reprogramar a esa fecha/franja: {reason}."}), 409

    # Si la cita tiene staff asignado y el establecimiento es multi-staff, validar disponibilidad/solapes de ESE staff
    if est.has_multiple_staff and appointment.staff_id:
        # 1) Opcional: validar que el staff presta el servicio (si tu modelo lo expone)
        try:
            allowed_staff_ids = set(service.staff_ids or [])
        except Exception:
            allowed_staff_ids = set()
        if allowed_staff_ids and appointment.staff_id not in allowed_staff_ids:
            return jsonify({"msg": "El profesional asignado no está habilitado para este servicio."}), 409

        # 2) Disponibilidad del staff para ese día/horario
        tzname = est.provider.timezone if est and est.provider else None
        tz = ZoneInfo(tzname) if tzname else timezone.utc
        start_local = new_start_time_obj.astimezone(tz)
        end_local = new_end_time_obj.astimezone(tz)
        day_map = {0: 'LUNES', 1: 'MARTES', 2: 'MIERCOLES', 3: 'JUEVES', 4: 'VIERNES', 5: 'SABADO', 6: 'DOMINGO'}
        dow = day_map[start_local.weekday()]

        rules = StaffAvailabilityRule.query.filter_by(staff_id=appointment.staff_id, dia_semana=dow).all()
        covers = any(
            datetime.combine(start_local.date(), r.hora_inicio, tzinfo=tz) <= start_local and
            datetime.combine(start_local.date(), r.hora_fin, tzinfo=tz) >= end_local
            for r in rules
        )
        if not covers:
            return jsonify({"msg": "El profesional no trabaja en el horario seleccionado."}), 409

        # 3) Solapes con citas del mismo staff
        q = Appointment.query.join(Service).filter(
            Appointment.id != appointment_id,
            Service.establishment_id == est.id,
            Appointment.estado.in_(['CONFIRMED', 'PENDING_PROVIDER']),
            Appointment.start_time < new_end_time_obj,
            Appointment.end_time > new_start_time_obj,
            Appointment.staff_id == appointment.staff_id
        )
        overlapping = q.first()
        if overlapping:
            return jsonify({"msg": "El profesional ya tiene una cita en ese horario."}), 409
    else:
        # Establecimiento mono-staff o cita sin staff: mantén la política actual (evita solapes globales)
        q = Appointment.query.join(Service).filter(
            Appointment.id != appointment_id,
            Service.establishment_id == est.id,
            Appointment.estado.in_(['CONFIRMED', 'PENDING_PROVIDER']),
            Appointment.start_time < new_end_time_obj,
            Appointment.end_time > new_start_time_obj,
        )
        overlapping = q.first()
        if overlapping:
            return jsonify({"msg": "El nuevo horario seleccionado ya no está disponible."}), 409

    # Aplicar cambios
    old_start_time = appointment.start_time
    appointment.start_time = new_start_time_obj
    appointment.end_time = new_end_time_obj

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

@appointment_bp.route('/appointments/<int:appointment_id>', methods=['PATCH'])
@jwt_required()
def patch_appointment(appointment_id):
    """
    PATCH /api/appointments/<id>

    Permisos:
      - Solo el provider dueño del establecimiento de la cita puede modificar.

    Payload (todos opcionales):
      - staff_id: int | null
      - start_time: ISO 8601 (UTC o con offset)
      - estado: str
      - notas_cliente: str
      - notas_internas: str

    Reglas:
      - Si staff_id != null:
          * Debe pertenecer al establecimiento y estar activo.
          * Debe ofrecer el servicio de la cita.
          * No puede tener otra cita solapada (CONFIRMED/PENDING_PROVIDER) en el intervalo.
      - Si cambia start_time (o el estado final queda/permanece CONFIRMED):
          * Respetar blackouts (día completo y parciales).
          * Respetar anti-solapes (por staff_id si hay staff asignado; si no y el local no es multi-staff, por establecimiento).
    """
    from .email_service import send_appointment_rescheduled_email  # opcional si luego quieres notificar

    # --- Auth & permisos (provider dueño) ---
    user_id = get_user_id_from_jwt()
    if not user_id:
        return jsonify({"msg": "Token inválido"}), 422

    user = User.query.get(user_id)
    if not user or user.role != 'provider' or not user.provider_profile:
        return jsonify({"msg": "Solo el proveedor puede modificar esta cita."}), 403

    appt = Appointment.query.get(appointment_id)
    if not appt:
        return jsonify({"msg": "Cita no encontrada."}), 404

    service = appt.service
    if not service or not service.is_active:
        return jsonify({"msg": "Servicio de la cita no disponible."}), 409

    est = service.establishment
    if not est or est.provider_id != user.provider_profile.provider_id:
        return jsonify({"msg": "No tienes permiso sobre esta cita."}), 403

    # --- Entrada ---
    data = request.get_json(silent=True) or {}
    new_staff_id      = data.get('staff_id', '__UNCHANGED__')
    new_start_iso     = data.get('start_time', '__UNCHANGED__')
    new_estado        = data.get('estado', '__UNCHANGED__')
    new_notas_cliente = data.get('notas_cliente', '__UNCHANGED__')
    new_notas_internas= data.get('notas_internas', '__UNCHANGED__')

    # Si no hay nada que cambiar
    if all(v == '__UNCHANGED__' for v in [new_staff_id, new_start_iso, new_estado, new_notas_cliente, new_notas_internas]):
        return jsonify({"msg": "Nada que actualizar"}), 400

    # --- Estado efectivo de trabajo ---
    effective_start_utc = appt.start_time
    effective_end_utc   = appt.end_time
    effective_staff_id  = appt.staff_id
    effective_estado    = appt.estado

    # Recalcular start/end si cambia start_time
    if new_start_iso != '__UNCHANGED__':
        try:
            new_start_utc = datetime.fromisoformat(str(new_start_iso).replace('Z', '+00:00'))
        except Exception:
            return jsonify({"msg": "Formato de 'start_time' inválido."}), 400
        if new_start_utc < datetime.now(timezone.utc):
            return jsonify({"msg": "La nueva hora debe ser futura."}), 400
        effective_start_utc = new_start_utc
        effective_end_utc   = new_start_utc + timedelta(minutes=service.duracion_minutos)

    # Validar/ajustar staff_id
    if new_staff_id != '__UNCHANGED__':
        if new_staff_id is None:
            effective_staff_id = None  # desasigna
        else:
            try:
                candidate_staff_id = int(new_staff_id)
            except (TypeError, ValueError):
                return jsonify({"msg": "El 'staff_id' debe ser entero o null."}), 400

            staff = Staff.query.get(candidate_staff_id)
            if not staff or staff.activo is False:
                return jsonify({"msg": "Empleado no encontrado o inactivo."}), 400
            if staff.establishment_id != est.id:
                return jsonify({"msg": "El empleado no pertenece a este establecimiento."}), 400

            # Debe ofrecer el servicio de la cita
            offers = Staff.query.join(Staff.services).filter(
                Staff.id == candidate_staff_id,
                Service.id == service.id
            ).first()
            if not offers:
                return jsonify({"msg": "Este empleado no ofrece el servicio de la cita."}), 400

            effective_staff_id = candidate_staff_id

    # ¿El estado final quedará en CONFIRMED?
    target_estado = effective_estado if new_estado == '__UNCHANGED__' else str(new_estado).upper().strip()
    will_be_confirmed = (target_estado == 'CONFIRMED') or (target_estado == '__UNCHANGED__' and effective_estado == 'CONFIRMED')

    # Validaciones fuertes si queda CONFIRMED (o ya lo estaba y no cambia)
    if will_be_confirmed:
        # 1) Blackouts
        conflict, reason = _blackout_conflict(est, effective_start_utc, effective_end_utc)
        if conflict:
            return jsonify({"msg": f"No disponible por bloqueo de calendario: {reason}."}), 409

        # 2) Anti-solape
        if effective_staff_id:
            # Solapado para el mismo staff
            clash = Appointment.query.join(Service).filter(
                Appointment.id != appt.id,
                Service.establishment_id == est.id,
                Appointment.staff_id == effective_staff_id,
                Appointment.estado.in_(['CONFIRMED', 'PENDING_PROVIDER']),
                Appointment.start_time < effective_end_utc,
                Appointment.end_time > effective_start_utc
            ).first()
            if clash:
                return jsonify({"msg": "Este profesional ya tiene una cita en esa franja."}), 409
        else:
            # Si no hay staff asignado y el establecimiento NO es multi-staff, bloquea por establecimiento
            if not est.has_multiple_staff:
                clash = Appointment.query.join(Service).filter(
                    Appointment.id != appt.id,
                    Service.establishment_id == est.id,
                    Appointment.estado.in_(['CONFIRMED', 'PENDING_PROVIDER']),
                    Appointment.start_time < effective_end_utc,
                    Appointment.end_time > effective_start_utc
                ).first()
                if clash:
                    return jsonify({"msg": "Ya existe una cita en esa franja para este establecimiento."}), 409

    # --- Aplicar cambios persistentes ---
    if new_start_iso != '__UNCHANGED__':
        appt.start_time = effective_start_utc
        appt.end_time   = effective_end_utc
    if new_staff_id != '__UNCHANGED__':
        appt.staff_id   = effective_staff_id
    if new_estado != '__UNCHANGED__':
        appt.estado     = target_estado
    if new_notas_cliente != '__UNCHANGED__':
        appt.notas_cliente = new_notas_cliente
    if new_notas_internas != '__UNCHANGED__':
        appt.notas_internas = new_notas_internas

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error en PATCH cita {appointment_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al actualizar la cita."}), 500

    return jsonify(appt.to_dict()), 200
