# backend/app/routes/appointments.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, timedelta, time, timezone
from app import db
from ..models import  User, Provider, Service, Appointment, AvailabilityRule, TimeBlock
from .helpers import (get_provider_timezone_object, calculate_daily_net_working_periods, merge_overlapping_intervals, PYTHON_WEEKDAY_TO_ENUM_STR)

bp = Blueprint('appointments', __name__, url_prefix='/appointments')

@bp.route('/providers/<int:provider_id>/available-slots', methods=['GET'])
def get_available_slots(provider_id):
    """
    GET /providers/<provider_id>/available-slots
    ============================================

    📅 Obtiene todos los "slots" disponibles para un proveedor y un servicio dado en un rango de fechas.

    Este endpoint devuelve los intervalos horarios (en UTC) disponibles para reservar citas,
    calculados a partir de:
    - Reglas de disponibilidad del proveedor (`AvailabilityRule`)
    - Bloques de tiempo personalizados (`TimeBlock`)
    - Citas ya reservadas (`Appointment`)

    Parámetros de ruta:
    -------------------
    - `provider_id` (int): ID del proveedor.

    Parámetros de query (obligatorios):
    -----------------------------------
    - `service_id` (int): ID del servicio a consultar.
    - `start_date` (str): Fecha inicial en formato `YYYY-MM-DD`.
    - `end_date` (str): Fecha final en formato `YYYY-MM-DD`.

    Reglas de validación:
    ---------------------
    - `service_id` debe ser entero válido.
    - Fechas deben estar en formato correcto.
    - `start_date` no puede estar en el pasado.
    - `start_date` ≤ `end_date`
    - El rango entre `start_date` y `end_date` no puede ser mayor a 60 días.
    - El proveedor y el servicio deben existir, estar activos y estar correctamente relacionados.
    - El proveedor debe tener una zona horaria válida configurada.

    Proceso interno:
    ----------------
    1. Determina los intervalos de disponibilidad según las reglas (`AvailabilityRule`).
    2. Aplica exclusiones por bloques no disponibles (`TimeBlock.is_available = False`).
    3. Añade intervalos extra por bloques explícitamente disponibles (`TimeBlock.is_available = True`).
    4. Excluye citas reservadas (`Appointment` con estados bloqueantes).
    5. Divide los intervalos resultantes en "slots" de duración fija (según `Service.duration_minutes`).

    Retorna:
    --------
    ✅ 200 OK: Lista de slots disponibles en formato:
        ```json
        [
            {
                "slot_start_utc": "2025-06-15T10:00:00+00:00",
                "date_for_slot": "2025-06-15"
            },
            ...
        ]
        ```

    ⚠️ 400 Bad Request:
        - Parámetros faltantes o inválidos.
        - Fechas mal formateadas.
        - Zona horaria del proveedor inválida o ausente.

    ⚠️ 404 Not Found:
        - Proveedor o servicio no encontrado.

    ❌ 500 Internal Server Error:
        - Problemas críticos al procesar la zona horaria.
    """

    current_app.logger.info(f"Solicitando slots disponibles para Provider ID: {provider_id}")

    # 1. Obtener Parámetros de Query
    service_id_str = request.args.get('service_id')
    start_date_str = request.args.get('start_date') # Formato esperado: YYYY-MM-DD
    end_date_str = request.args.get('end_date')     # Formato esperado: YYYY-MM-DD

    # 2. Validaciones Básicas de Parámetros
    if not service_id_str or not start_date_str or not end_date_str:
        return jsonify({"msg": "Parámetros requeridos faltantes: service_id, start_date, end_date"}), 400

    try:
        service_id = int(service_id_str)
    except ValueError:
        return jsonify({"msg": "service_id debe ser un entero válido"}), 400

    try:
        start_date_obj = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date_obj = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"msg": "Formato de fecha inválido para start_date o end_date. Usar YYYY-MM-DD"}), 400

    if start_date_obj < date.today(): # Corrección: date.today() en lugar de datetime.today() si comparas con date
         return jsonify({"msg": "La fecha de inicio (start_date) no puede ser en el pasado."}), 400
    if start_date_obj > end_date_obj:
        return jsonify({"msg": "start_date no puede ser posterior a end_date"}), 400
    
    if (end_date_obj - start_date_obj).days > 60: 
        return jsonify({"msg": "El rango de fechas solicitado es demasiado amplio (máximo 60 días)."}), 400

    # --- INICIO DE LA LÓGICA QUE FALTABA ---
    # 3. Obtener Proveedor y Servicio
    provider = Provider.query.get(provider_id)
    if not provider:
        return jsonify({"msg": f"Proveedor con ID {provider_id} no encontrado"}), 404
    
    service = Service.query.filter_by(id=service_id, provider_id=provider.provider_id).first()
    if not service:
        return jsonify({"msg": f"Servicio con ID {service_id} no encontrado para el proveedor ID {provider_id}"}), 404
    if not service.is_active:
        return jsonify({"msg": f"El servicio con ID {service_id} no está activo actualmente"}), 400

    service_duration = timedelta(minutes=service.duration_minutes)
    provider_timezone_str = provider.timezone
    provider_tz = None 

    if not provider_timezone_str: 
        current_app.logger.error(f"El proveedor {provider_id} no tiene una zona horaria configurada.")
        return jsonify({"msg": "La zona horaria del proveedor no está configurada."}), 500

    try:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            provider_tz = ZoneInfo(provider_timezone_str)
        except ZoneInfoNotFoundError:
            provider_tz = None
        except Exception: provider_tz = None
    except ImportError: provider_tz = None

    if provider_tz is None:
        try:
            import pytz
            provider_tz = pytz.timezone(provider_timezone_str)
        except ImportError:
            if provider_timezone_str.upper() == 'UTC': provider_tz = timezone.utc
            else:
                current_app.logger.error(f"Error crítico al obtener tz para proveedor {provider_id} sin pytz/zoneinfo.")
                return jsonify({"msg": "Error de configuración del servidor al procesar la disponibilidad."}), 500
        except pytz.UnknownTimeZoneError:
            current_app.logger.error(f"Zona horaria desconocida '{provider_timezone_str}' para proveedor {provider_id}.")
            return jsonify({"msg": "Error en la zona horaria del proveedor."}), 500
        except Exception as e_pytz:
            current_app.logger.error(f"Error inesperado con pytz para '{provider_timezone_str}': {e_pytz}")
            return jsonify({"msg": "Error al procesar la zona horaria del proveedor."}), 500
    
    current_app.logger.info(f"Proveedor: {provider.business_name} (ID: {provider.provider_id}), Servicio: {service.name} (ID: {service.id}), Duración: {service_duration}, Timezone Proveedor (str): {provider_timezone_str}, Timezone Proveedor (obj resultante): {provider_tz}")

    all_available_slots_info = [] 
    current_date_iter = start_date_obj
    
    python_weekday_to_enum_str = {
        0: 'LUNES', 1: 'MARTES', 2: 'MIERCOLES', 3: 'JUEVES', 
        4: 'VIERNES', 5: 'SABADO', 6: 'DOMINGO'
    }

    while current_date_iter <= end_date_obj:
        day_of_week_int = current_date_iter.weekday() 
        day_of_week_enum_value = python_weekday_to_enum_str.get(day_of_week_int)
        
        current_app.logger.debug(f"Procesando día: {current_date_iter}, DOW_int: {day_of_week_int}, DOW_enum: {day_of_week_enum_value}")

        base_availability_intervals_for_day = []
        if day_of_week_enum_value:
            rules_for_day = AvailabilityRule.query.filter_by(
                provider_id=provider.provider_id,
                day_of_week=day_of_week_enum_value
            ).all()
            current_app.logger.debug(f"Día {current_date_iter} ({day_of_week_enum_value}): {len(rules_for_day)} reglas encontradas.")
            for rule in rules_for_day:
                start_dt_naive = datetime.combine(current_date_iter, rule.start_time)
                end_dt_naive = datetime.combine(current_date_iter, rule.end_time)
                start_dt_aware = provider_tz.localize(start_dt_naive) if hasattr(provider_tz, 'localize') else start_dt_naive.replace(tzinfo=provider_tz)
                end_dt_aware = provider_tz.localize(end_dt_naive) if hasattr(provider_tz, 'localize') else end_dt_naive.replace(tzinfo=provider_tz)
                start_dt_utc = start_dt_aware.astimezone(timezone.utc)
                end_dt_utc = end_dt_aware.astimezone(timezone.utc)
                base_availability_intervals_for_day.append({'start': start_dt_utc, 'end': end_dt_utc})
        
        day_start_local_naive = datetime.combine(current_date_iter, time.min) # Inicio del día local
        day_start_aware_provider_tz = provider_tz.localize(day_start_local_naive) if hasattr(provider_tz, 'localize') else day_start_local_naive.replace(tzinfo=provider_tz)
        day_start_utc = day_start_aware_provider_tz.astimezone(timezone.utc)

        day_end_local_naive = datetime.combine(current_date_iter, time.max) # Fin del día local
        day_end_aware_provider_tz = provider_tz.localize(day_end_local_naive) if hasattr(provider_tz, 'localize') else day_end_local_naive.replace(tzinfo=provider_tz)
        # Para el filtro de TimeBlocks y Appointments, es más seguro usar el inicio del día siguiente como fin del día actual
        next_day_start_utc = (day_start_aware_provider_tz + timedelta(days=1)).astimezone(timezone.utc)


        provider_time_blocks_for_day = TimeBlock.query.filter(
            TimeBlock.provider_id == provider.provider_id,
            TimeBlock.start_datetime < next_day_start_utc, # TimeBlock comienza antes de que termine el día
            TimeBlock.end_datetime > day_start_utc   # TimeBlock termina después de que comience el día
        ).all()

        processed_intervals_for_day = list(base_availability_intervals_for_day)

        for tb in provider_time_blocks_for_day:
            if not tb.is_available:
                tb_start_utc = tb.start_datetime.astimezone(timezone.utc) 
                tb_end_utc = tb.end_datetime.astimezone(timezone.utc)     
                next_processed_intervals_after_block = []
                for interval in processed_intervals_for_day:
                    if tb_end_utc <= interval['start'] or tb_start_utc >= interval['end']:
                        next_processed_intervals_after_block.append(interval)
                        continue
                    if tb_start_utc <= interval['start'] < tb_end_utc < interval['end']:
                        if tb_end_utc < interval['end']:
                             next_processed_intervals_after_block.append({'start': tb_end_utc, 'end': interval['end']})
                    elif interval['start'] < tb_start_utc < interval['end'] <= tb_end_utc:
                        if interval['start'] < tb_start_utc:
                            next_processed_intervals_after_block.append({'start': interval['start'], 'end': tb_start_utc})
                    elif interval['start'] < tb_start_utc and tb_end_utc < interval['end']:
                        if interval['start'] < tb_start_utc:
                            next_processed_intervals_after_block.append({'start': interval['start'], 'end': tb_start_utc})
                        if tb_end_utc < interval['end']:
                            next_processed_intervals_after_block.append({'start': tb_end_utc, 'end': interval['end']})
                    elif tb_start_utc <= interval['start'] and tb_end_utc >= interval['end']:
                        pass 
                processed_intervals_for_day = next_processed_intervals_after_block
        
        extra_availability_intervals_utc = []
        for tb in provider_time_blocks_for_day:
            if tb.is_available:
                tb_start_utc_extra = tb.start_datetime.astimezone(timezone.utc) 
                tb_end_utc_extra = tb.end_datetime.astimezone(timezone.utc)     
                effective_start_extra = max(tb_start_utc_extra, day_start_utc)
                effective_end_extra = min(tb_end_utc_extra, next_day_start_utc) # Usar next_day_start_utc para el límite superior del día
                if effective_start_extra < effective_end_extra:
                    extra_availability_intervals_utc.append({'start': effective_start_extra, 'end': effective_end_extra})
        
        combined_intervals_for_day = processed_intervals_for_day + extra_availability_intervals_utc
        merged_intervals_for_day = merge_overlapping_intervals(combined_intervals_for_day)
        processed_intervals_for_day = merged_intervals_for_day
        
        blocking_appointment_statuses = ['CONFIRMED', 'PENDING_PROVIDER'] 
        appointments_for_day = Appointment.query.filter(
            Appointment.provider_id == provider.provider_id,
            Appointment.status.in_(blocking_appointment_statuses),
            Appointment.start_datetime < next_day_start_utc, 
            Appointment.end_datetime > day_start_utc    
        ).all()

        if appointments_for_day:
            for appt in appointments_for_day:
                appt_start_utc = appt.start_datetime.astimezone(timezone.utc)
                appt_end_utc = appt.end_datetime.astimezone(timezone.utc)
                next_intervals_after_this_appt = []
                for work_interval in processed_intervals_for_day:
                    if appt_end_utc <= work_interval['start'] or appt_start_utc >= work_interval['end']:
                        next_intervals_after_this_appt.append(work_interval)
                        continue
                    if appt_start_utc <= work_interval['start'] and appt_end_utc > work_interval['start'] and appt_end_utc < work_interval['end']:
                        if appt_end_utc < work_interval['end']:
                             next_intervals_after_this_appt.append({'start': appt_end_utc, 'end': work_interval['end']})
                    elif appt_start_utc > work_interval['start'] and appt_start_utc < work_interval['end'] and appt_end_utc >= work_interval['end']:
                        if work_interval['start'] < appt_start_utc:
                            next_intervals_after_this_appt.append({'start': work_interval['start'], 'end': appt_start_utc})
                    elif appt_start_utc > work_interval['start'] and appt_end_utc < work_interval['end']:
                        if work_interval['start'] < appt_start_utc:
                            next_intervals_after_this_appt.append({'start': work_interval['start'], 'end': appt_start_utc})
                        if appt_end_utc < work_interval['end']:
                            next_intervals_after_this_appt.append({'start': appt_end_utc, 'end': work_interval['end']})
                    elif appt_start_utc <= work_interval['start'] and appt_end_utc >= work_interval['end']:
                        pass
                processed_intervals_for_day = next_intervals_after_this_appt
        
        for interval in processed_intervals_for_day:
            interval_start_dt = interval['start']
            interval_end_dt = interval['end']
            current_slot_start_dt = interval_start_dt
            while current_slot_start_dt + service_duration <= interval_end_dt:
                all_available_slots_info.append({
                    "slot_start_utc": current_slot_start_dt.isoformat(),
                    "date_for_slot": current_date_iter.isoformat() 
                })
                current_slot_start_dt += service_duration

        current_date_iter += timedelta(days=1)
    
    return jsonify(all_available_slots_info), 200

@bp.route('', methods=['POST'])
@jwt_required()
def create_appointment():
    """
    POST /appointments
    ==================

    📆 Crea una nueva cita para un cliente autenticado.

    Este endpoint permite a los usuarios con rol "client" reservar una cita con un proveedor y servicio específico
    en una fecha y hora determinadas, siempre que el slot esté disponible.

    Requisitos:
    -----------
    - El usuario debe estar autenticado mediante JWT.
    - El usuario debe tener rol `client`.
    - El proveedor y el servicio deben existir y estar relacionados.
    - El servicio debe estar activo.
    - El slot solicitado debe estar disponible según:
        - Las reglas de disponibilidad (`AvailabilityRule`)
        - Los bloques de tiempo (`TimeBlock`)
        - Las citas ya existentes (`Appointment`)

    Entrada (JSON):
    ---------------
    {
        "provider_id": int,          # ID del proveedor con el que se quiere reservar
        "service_id": int,           # ID del servicio que se quiere reservar
        "slot_start_utc": str,       # Inicio del slot en formato ISO UTC, ej: "2025-07-01T09:00:00Z"
        "notes_client": str | null   # (Opcional) Comentario del cliente
    }

    Validaciones importantes:
    -------------------------
    - `slot_start_utc` debe tener zona horaria (Z o +00:00).
    - No se permite reservar en horarios fuera de disponibilidad.
    - Se rechaza si ya existe una cita que se solape con el slot solicitado.
    - La zona horaria del proveedor debe estar configurada y ser válida.
    - El rango solicitado debe estar incluido completamente dentro de los periodos disponibles.

    Respuestas:
    -----------
    ✅ 201 Created:
        - Cita creada exitosamente.
        - Respuesta: `appointment.to_dict()` con los datos de la cita.

    ⚠️ 400 Bad Request:
        - Parámetros inválidos o faltantes.
        - Zona horaria ausente en `slot_start_utc`.

    ⚠️ 403 Forbidden:
        - Usuario no es un cliente.

    ⚠️ 404 Not Found:
        - Usuario, proveedor o servicio no encontrados.

    ⚠️ 409 Conflict:
        - El slot solicitado no está disponible (por reglas, bloques o conflictos con citas).

    ❌ 422 Unprocessable Entity:
        - Token JWT malformado (user_id no entero).

    ❌ 500 Internal Server Error:
        - Errores internos, típicamente al obtener la zona horaria o al guardar en DB.

    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"POST /appointments: User ID del token ('{current_user_id_str}') no es un entero válido.")
        return jsonify({"msg": "Token inválido: User ID incorrecto"}), 422

    client = User.query.get(current_user_id)

    if not client:
        current_app.logger.warning(f"POST /appointments: Cliente con User ID {current_user_id} (del token) no encontrado.")
        return jsonify({"msg": "Usuario cliente no encontrado"}), 404
    
    if client.role != 'client':
        current_app.logger.warning(f"POST /appointments: Usuario {client.email} (ID: {client.user_id}) intentó reservar pero no es un cliente (rol: {client.role}).")
        return jsonify({"msg": "Acceso denegado: Solo los clientes pueden reservar citas"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se enviaron datos en la petición"}), 400

    # Validar y parsear los datos de entrada
    provider_id_from_request = data.get('provider_id')
    service_id_from_request = data.get('service_id')
    slot_start_utc_str = data.get('slot_start_utc')
    notes_client = data.get('notes_client') # Opcional

    if not provider_id_from_request or not service_id_from_request or not slot_start_utc_str:
        return jsonify({"msg": "Faltan datos requeridos: provider_id, service_id, slot_start_utc"}), 400

    try:
        provider_id = int(provider_id_from_request)
        service_id = int(service_id_from_request)
    except ValueError:
        return jsonify({"msg": "provider_id y service_id deben ser enteros válidos"}), 400

    try:
        # Convertir el string UTC a un objeto datetime aware (consciente de zona horaria)
        # datetime.fromisoformat maneja bien los strings con '+00:00' o 'Z'
        slot_start_datetime_obj_utc = datetime.fromisoformat(slot_start_utc_str)
        # Asegurarnos de que es UTC si no tiene offset, o convertirlo si lo tiene
        if slot_start_datetime_obj_utc.tzinfo is None:
            # Si por alguna razón llega sin tzinfo (aunque fromisoformat debería manejarlo si el string es correcto)
            # Lo ideal sería rechazarlo o asumir UTC explícitamente. Rechazar es más seguro.
            current_app.logger.warning(f"POST /appointments: slot_start_utc ('{slot_start_utc_str}') no tiene información de zona horaria.")
            return jsonify({"msg": "slot_start_utc debe ser un string ISO 8601 con información de zona horaria UTC (ej. 'Z' o '+00:00')"}), 400
        elif slot_start_datetime_obj_utc.tzinfo != timezone.utc:
            # Si tiene una zona horaria diferente a UTC, la convertimos a UTC
            slot_start_datetime_obj_utc = slot_start_datetime_obj_utc.astimezone(timezone.utc)
            current_app.logger.info(f"POST /appointments: slot_start_utc convertido a UTC: {slot_start_datetime_obj_utc.isoformat()}")

    except ValueError:
        current_app.logger.warning(f"POST /appointments: Formato de slot_start_utc ('{slot_start_utc_str}') inválido.")
        return jsonify({"msg": "Formato de slot_start_utc inválido. Usar ISO 8601 UTC (ej. YYYY-MM-DDTHH:MM:SSZ o YYYY-MM-DDTHH:MM:SS+00:00)"}), 400

    # Obtener Provider y Service
    provider = Provider.query.get(provider_id)
    if not provider:
        current_app.logger.warning(f"POST /appointments: Proveedor con ID {provider_id} no encontrado.")
        return jsonify({"msg": "Proveedor no encontrado"}), 404

    service = Service.query.filter_by(id=service_id, provider_id=provider.provider_id).first() # Buscamos el servicio para ese proveedor
    if not service:
        current_app.logger.warning(f"POST /appointments: Servicio con ID {service_id} no encontrado para el Proveedor ID {provider.provider_id}.")
        return jsonify({"msg": f"Servicio no encontrado para el proveedor especificado"}), 404
    if not service.is_active:
        current_app.logger.warning(f"POST /appointments: Servicio con ID {service_id} (Proveedor ID {provider.provider_id}) no está activo.")
        return jsonify({"msg": "El servicio seleccionado no está activo"}), 400

    # Calcular hora de finalización de la cita
    appointment_duration = timedelta(minutes=service.duration_minutes)
    appointment_end_datetime_obj_utc = slot_start_datetime_obj_utc + appointment_duration
    
    current_app.logger.info(f"POST /appointments: Intento de reserva para Cliente ID {client.user_id}, Proveedor ID {provider.provider_id}, Servicio ID {service.id}, Slot UTC: {slot_start_datetime_obj_utc.isoformat()} a {appointment_end_datetime_obj_utc.isoformat()}")

    # --- INICIO DE VERIFICACIÓN DE DISPONIBILIDAD DEL SLOT ---
    current_app.logger.info(f"POST /appointments: Verificando disponibilidad del slot para Proveedor ID {provider.provider_id}...")

    # 1.a Obtener zona horaria del proveedor
    provider_tz_str = provider.timezone
    provider_tz = None
    # (Reutilizamos la lógica de obtención de tzinfo que teníamos en get_available_slots)
    try:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            provider_tz = ZoneInfo(provider_tz_str)
        except ZoneInfoNotFoundError:
            provider_tz = None
        except Exception: provider_tz = None
    except ImportError: provider_tz = None

    if provider_tz is None:
        try:
            import pytz
            provider_tz = pytz.timezone(provider_tz_str)
        except ImportError:
            if provider_tz_str.upper() == 'UTC': provider_tz = timezone.utc
            else:
                current_app.logger.error(f"POST /appointments: Error crítico al obtener tz para proveedor {provider.provider_id} sin pytz/zoneinfo.")
                return jsonify({"msg": "Error de configuración del servidor al procesar la disponibilidad."}), 500
        except pytz.UnknownTimeZoneError:
            current_app.logger.error(f"POST /appointments: Zona horaria desconocida '{provider_tz_str}' para proveedor {provider.provider_id}.")
            return jsonify({"msg": "Error en la zona horaria del proveedor."}), 500
        except Exception as e_pytz:
            current_app.logger.error(f"POST /appointments: Error inesperado con pytz para '{provider_tz_str}': {e_pytz}")
            return jsonify({"msg": "Error al procesar la zona horaria del proveedor."}), 500

    # 1.b Determinar fecha y día de la semana del slot en la TZ del proveedor
    slot_start_local_provider_tz = slot_start_datetime_obj_utc.astimezone(provider_tz)
    slot_date_local = slot_start_local_provider_tz.date()
    
    python_weekday_to_enum_str = { 0: 'LUNES', 1: 'MARTES', 2: 'MIERCOLES', 3: 'JUEVES', 4: 'VIERNES', 5: 'SABADO', 6: 'DOMINGO'}
    day_of_week_enum_value = python_weekday_to_enum_str.get(slot_date_local.weekday())

    if not day_of_week_enum_value: # No debería pasar si slot_date_local es válida
        current_app.logger.error(f"POST /appointments: No se pudo determinar el día de la semana para {slot_date_local}")
        return jsonify({"msg": "Error procesando la fecha del slot."}), 500

    # 1.c & 1.d: Obtener AvailabilityRules y convertirlas a UTC para la fecha del slot
    base_availability_intervals_utc = []
    rules_for_day = AvailabilityRule.query.filter_by(
        provider_id=provider.provider_id,
        day_of_week=day_of_week_enum_value
    ).all()

    current_app.logger.debug(f"POST /appointments: {len(rules_for_day)} reglas de disponibilidad encontradas para {day_of_week_enum_value} el {slot_date_local}.")
    for rule in rules_for_day:
        start_dt_naive = datetime.combine(slot_date_local, rule.start_time)
        end_dt_naive = datetime.combine(slot_date_local, rule.end_time)
        # Hacerlos "aware" usando la zona horaria del proveedor
        start_dt_aware_provider = provider_tz.localize(start_dt_naive) if hasattr(provider_tz, 'localize') else start_dt_naive.replace(tzinfo=provider_tz)
        end_dt_aware_provider = provider_tz.localize(end_dt_naive) if hasattr(provider_tz, 'localize') else end_dt_naive.replace(tzinfo=provider_tz)
        # Convertir a UTC
        base_availability_intervals_utc.append({
            'start': start_dt_aware_provider.astimezone(timezone.utc),
            'end': end_dt_aware_provider.astimezone(timezone.utc)
        })
    
    if not base_availability_intervals_utc: # Si no hay reglas para ese día
        current_app.logger.info(f"POST /appointments: No hay reglas de disponibilidad base para el proveedor {provider.provider_id} en {day_of_week_enum_value} ({slot_date_local}). Slot no disponible.")
        return jsonify({"msg": "El proveedor no está disponible en la fecha solicitada."}), 409 # 409 Conflict

    # 1.e & 1.f: Aplicar TimeBlocks
    # Definir el inicio y fin del día del slot en UTC para filtrar TimeBlocks
    day_start_utc = slot_start_datetime_obj_utc.replace(hour=0, minute=0, second=0, microsecond=0) # Inicio del día UTC del slot
    day_end_utc = day_start_utc + timedelta(days=1) # Fin del día UTC del slot (inicio del siguiente)

    time_blocks_for_slot_day = TimeBlock.query.filter(
        TimeBlock.provider_id == provider.provider_id,
        TimeBlock.start_datetime < day_end_utc, # TimeBlock comienza antes de que termine el día del slot
        TimeBlock.end_datetime > day_start_utc   # TimeBlock termina después de que comience el día del slot
    ).all()
    
    current_app.logger.debug(f"POST /appointments: {len(time_blocks_for_slot_day)} TimeBlocks encontrados que se solapan con el día del slot.")
    
    # Aplicar lógica de TimeBlocks (reutilizando la estructura de get_available_slots)
    processed_intervals_utc = list(base_availability_intervals_utc)

    # Restar TimeBlocks con is_available=False
    for tb in time_blocks_for_slot_day:
        if not tb.is_available:
            tb_start_utc = tb.start_datetime.astimezone(timezone.utc)
            tb_end_utc = tb.end_datetime.astimezone(timezone.utc)
            next_processed_intervals = []
            for interval in processed_intervals_utc:
                if tb_end_utc <= interval['start'] or tb_start_utc >= interval['end']: next_processed_intervals.append(interval); continue
                if tb_start_utc <= interval['start'] < tb_end_utc < interval['end']:
                    if tb_end_utc < interval['end']: next_processed_intervals.append({'start': tb_end_utc, 'end': interval['end']})
                elif interval['start'] < tb_start_utc < interval['end'] <= tb_end_utc:
                    if interval['start'] < tb_start_utc: next_processed_intervals.append({'start': interval['start'], 'end': tb_start_utc})
                elif interval['start'] < tb_start_utc and tb_end_utc < interval['end']:
                    if interval['start'] < tb_start_utc: next_processed_intervals.append({'start': interval['start'], 'end': tb_start_utc})
                    if tb_end_utc < interval['end']: next_processed_intervals.append({'start': tb_end_utc, 'end': interval['end']})
                elif tb_start_utc <= interval['start'] and tb_end_utc >= interval['end']: pass
            processed_intervals_utc = next_processed_intervals
            
    # Añadir TimeBlocks con is_available=True y fusionar
    extra_availability_utc = []
    for tb in time_blocks_for_slot_day:
        if tb.is_available:
            tb_start_utc = tb.start_datetime.astimezone(timezone.utc)
            tb_end_utc = tb.end_datetime.astimezone(timezone.utc)
            # Recortar al día del slot para evitar añadir disponibilidad de otros días (importante si el TimeBlock abarca varios días)
            effective_start = max(tb_start_utc, day_start_utc)
            effective_end = min(tb_end_utc, day_end_utc)
            if effective_start < effective_end:
                extra_availability_utc.append({'start': effective_start, 'end': effective_end})

    combined_intervals_utc = processed_intervals_utc + extra_availability_utc
    
    # Necesitamos la función merge_overlapping_intervals aquí.
    # Si no está definida globalmente en routes.py, necesitarás copiarla o importarla.
    # Asumo que la tienes definida en el mismo archivo (routes.py) como 'merge_overlapping_intervals'
    net_working_periods_utc = merge_overlapping_intervals(combined_intervals_utc) 
    
    current_app.logger.debug(f"POST /appointments: Periodos de trabajo netos para el día del slot: {net_working_periods_utc}")

    # 1.g: Verificar si el slot solicitado está contenido en los periodos de trabajo netos
    slot_is_within_general_availability = False
    for period in net_working_periods_utc:
        if period['start'] <= slot_start_datetime_obj_utc and period['end'] >= appointment_end_datetime_obj_utc:
            slot_is_within_general_availability = True
            break
            
    if not slot_is_within_general_availability:
        current_app.logger.info(f"POST /appointments: El slot solicitado {slot_start_datetime_obj_utc.isoformat()} - {appointment_end_datetime_obj_utc.isoformat()} no está dentro de la disponibilidad general del proveedor.")
        return jsonify({"msg": "El slot de tiempo solicitado no está disponible (conflicto con disponibilidad general)."}), 409 # Conflict

    current_app.logger.info(f"POST /appointments: Slot {slot_start_datetime_obj_utc.isoformat()} está DENTRO de la disponibilidad general. Procediendo a verificar citas existentes.")
    # --- FIN DE VERIFICACIÓN DE DISPONIBILIDAD GENERAL ---

    # --- INICIO DE VERIFICACIÓN DE CONFLICTO CON OTRAS CITAS EXISTENTES ---
    blocking_appointment_statuses = ['CONFIRMED', 'PENDING_PROVIDER'] # Estados que consideramos que ocupan un slot

    overlapping_appointments = Appointment.query.filter(
        Appointment.provider_id == provider.provider_id,
        Appointment.status.in_(blocking_appointment_statuses),
        Appointment.start_datetime < appointment_end_datetime_obj_utc, # Cita existente comienza antes de que termine el nuevo slot
        Appointment.end_datetime > slot_start_datetime_obj_utc      # Cita existente termina después de que comience el nuevo slot
    ).first() # Solo necesitamos saber si existe al menos una, no necesitamos todas.

    if overlapping_appointments:
        current_app.logger.info(f"POST /appointments: El slot solicitado {slot_start_datetime_obj_utc.isoformat()} - {appointment_end_datetime_obj_utc.isoformat()} entra en conflicto con la cita existente ID {overlapping_appointments.id}.")
        return jsonify({"msg": "El slot de tiempo solicitado ya no está disponible (conflicto con otra cita)."}), 409 # Conflict

    current_app.logger.info(f"POST /appointments: Slot {slot_start_datetime_obj_utc.isoformat()} NO tiene conflictos con citas existentes. Procediendo a crear la cita.")

    # --- FIN DE VERIFICACIÓN DE CONFLICTO CON OTRAS CITAS EXISTENTES ---

    # --- CREAR Y GUARDAR LA NUEVA CITA ---
    try:
        new_appointment = Appointment(
            client_id=client.user_id,
            provider_id=provider.provider_id,
            service_id=service.id,
            start_datetime=slot_start_datetime_obj_utc,
            end_datetime=appointment_end_datetime_obj_utc,
            status='CONFIRMED',  # O 'PENDING_PROVIDER' si tu lógica de negocio lo requiere
            notes_client=notes_client # Puede ser None si el cliente no envió notas
        )
        db.session.add(new_appointment)
        db.session.commit()
        
        current_app.logger.info(f"POST /appointments: Cita ID {new_appointment.id} creada exitosamente para Cliente ID {client.user_id}, Proveedor ID {provider.provider_id} en el slot {new_appointment.start_datetime.isoformat()}.")
        
        # Devolver la cita creada con un código de estado 201 (Created)
        return jsonify(new_appointment.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"POST /appointments: Error al guardar la nueva cita en la base de datos: {e}")
        # Para un debug más detallado en desarrollo, podrías loggear el traceback completo:
        # import traceback
        # current_app.logger.error(traceback.format_exc())
        return jsonify({"msg": "Error interno del servidor al intentar guardar la cita."}), 500

@bp.route('', methods=['GET'])
@jwt_required()
def get_appointments():
    """
    GET /appointments
    ==================

    📋 Obtiene todas las citas asociadas al usuario autenticado.

    Este endpoint devuelve una lista de citas ordenadas por fecha (de más reciente a más antigua),
    dependiendo del rol del usuario:
    - Si el usuario es un **cliente**, se devuelven sus citas como cliente.
    - Si el usuario es un **proveedor**, se devuelven las citas asociadas a su perfil de proveedor.

    Requisitos:
    -----------
    - El usuario debe estar autenticado mediante JWT.
    - El usuario debe tener el rol `client` o `provider`.
    - Los proveedores deben tener configurado un perfil de proveedor válido.

    Salida:
    -------
    Una lista JSON de objetos de cita (`Appointment.to_dict()`).

    Ejemplo de respuesta:
    ---------------------
    ```json
    [
        {
            "id": 123,
            "client_id": 1,
            "provider_id": 5,
            "service_id": 12,
            "start_datetime": "2025-07-01T09:00:00Z",
            "end_datetime": "2025-07-01T09:30:00Z",
            "status": "CONFIRMED",
            "notes_client": "Por favor, ser puntual."
        },
        ...
    ]
    ```

    Respuestas:
    -----------
    ✅ 200 OK:
        - Lista de citas devuelta exitosamente.

    ⚠️ 400 Bad Request:
        - El proveedor autenticado no tiene perfil asociado.

    ⚠️ 403 Forbidden:
        - El rol del usuario no está autorizado para esta operación.

    ⚠️ 404 Not Found:
        - El usuario del token no fue encontrado.

    ❌ 422 Unprocessable Entity:
        - El ID del usuario en el token no es un entero válido.

    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"GET /appointments: User ID del token ('{current_user_id_str}') no es un entero válido.")
        return jsonify({"msg": "Token inválido: User ID incorrecto"}), 422

    user = User.query.get(current_user_id)
    if not user:
        current_app.logger.warning(f"GET /appointments: Usuario con User ID {current_user_id} (del token) no encontrado.")
        return jsonify({"msg": "Usuario del token no encontrado"}), 404

    list_of_appointments = [] 

    if user.role == 'client':
        current_app.logger.info(f"GET /appointments: Cliente ID {user.user_id} ({user.email}) solicitando sus citas.")
        list_of_appointments = Appointment.query.filter_by(client_id=user.user_id).order_by(Appointment.start_datetime.desc()).all()

    elif user.role == 'provider':
        current_app.logger.info(f"GET /appointments: Proveedor con User ID {user.user_id} ({user.email}) solicitando sus citas.")
        if not user.provider_profile:
            current_app.logger.warning(f"GET /appointments: Proveedor User ID {user.user_id} no tiene un perfil de proveedor asociado.")
            return jsonify({"msg": "Este usuario proveedor no tiene un perfil de proveedor configurado."}), 400 
        
        provider_id_for_query = user.provider_profile.provider_id
        list_of_appointments = Appointment.query.filter_by(provider_id=provider_id_for_query).order_by(Appointment.start_datetime.desc()).all()
        
    else:
        current_app.logger.error(f"GET /appointments: Usuario ID {user.user_id} con rol desconocido o no manejado: '{user.role}'.")
        return jsonify({"msg": "Rol de usuario no reconocido o no autorizado para esta acción."}), 403

    return jsonify([appointment.to_dict() for appointment in list_of_appointments]), 200

@bp.route('/<int:appointment_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_appointment(appointment_id):
    """
    PUT /appointments/<appointment_id>/cancel
    =========================================

    ❌ Cancela una cita existente, si el usuario autenticado está autorizado.

    Esta operación puede ser realizada por:
    - El **cliente** que reservó la cita.
    - El **proveedor** que ofrece el servicio asociado a la cita.

    Requisitos:
    -----------
    - Autenticación JWT requerida.
    - El usuario debe tener el rol `client` o `provider`.
    - Solo el cliente de la cita o el proveedor asociado puede cancelarla.
    - La cita debe estar en estado `CONFIRMED` o `PENDING_PROVIDER`.

    Parámetros de ruta:
    -------------------
    - appointment_id (int): ID de la cita a cancelar.

    Cambios realizados:
    -------------------
    - Si cancela un cliente, el nuevo estado será `CANCELLED_BY_CLIENT`.
    - Si cancela un proveedor, el nuevo estado será `CANCELLED_BY_PROVIDER`.

    Ejemplo de respuesta:
    ---------------------
    ```json
    {
        "id": 42,
        "client_id": 3,
        "provider_id": 5,
        "service_id": 7,
        "start_datetime": "2025-07-01T09:00:00Z",
        "end_datetime": "2025-07-01T09:30:00Z",
        "status": "CANCELLED_BY_CLIENT",
        "notes_client": "No podré asistir."
    }
    ```

    Respuestas:
    -----------
    ✅ 200 OK:
        - Cita cancelada exitosamente.

    ⚠️ 400 Bad Request:
        - El proveedor no tiene un perfil válido asociado.

    ⚠️ 403 Forbidden:
        - El usuario no está autorizado a cancelar esa cita.

    ⚠️ 404 Not Found:
        - El usuario o la cita no existen.

    ⚠️ 409 Conflict:
        - La cita no se puede cancelar por su estado actual.

    ❌ 422 Unprocessable Entity:
        - El ID del token no es válido.

    ❌ 500 Internal Server Error:
        - Error inesperado al intentar cancelar la cita.
    """
    
    current_user_id_str = get_jwt_identity()
    try:
        current_user_id = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"PUT /appointments/{appointment_id}/cancel: User ID del token ('{current_user_id_str}') no es un entero válido.")
        return jsonify({"msg": "Token inválido: User ID incorrecto"}), 422

    user = User.query.get(current_user_id)
    if not user:
        current_app.logger.warning(f"PUT /appointments/{appointment_id}/cancel: Usuario con User ID {current_user_id} (del token) no encontrado.")
        return jsonify({"msg": "Usuario del token no encontrado"}), 404

    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        current_app.logger.warning(f"PUT /appointments/{appointment_id}/cancel: Cita con ID {appointment_id} no encontrada.")
        return jsonify({"msg": "Cita no encontrada"}), 404

    current_app.logger.info(f"Usuario {user.email} (Rol: {user.role}, ID: {user.user_id}) intentando cancelar cita ID {appointment.id} (Cliente ID: {appointment.client_id}, Proveedor ID: {appointment.provider_id}).")

    # --- Lógica de Autorización ---
    is_authorized_to_cancel = False
    cancelling_as_role = None 

    if user.role == 'client':
        if appointment.client_id == user.user_id:
            is_authorized_to_cancel = True
            cancelling_as_role = 'client'
    elif user.role == 'provider':
        if not user.provider_profile:
            current_app.logger.warning(f"Usuario proveedor {user.email} (ID: {user.user_id}) intentó cancelar cita pero no tiene perfil de proveedor.")
            return jsonify({"msg": "Acción no permitida: el perfil de proveedor no está completo."}), 403
        
        if appointment.provider_id == user.provider_profile.provider_id:
            is_authorized_to_cancel = True
            cancelling_as_role = 'provider'

    if not is_authorized_to_cancel:
        current_app.logger.warning(f"Usuario {user.email} (ID: {user.user_id}) NO está autorizado para cancelar la cita ID {appointment.id}.")
        return jsonify({"msg": "No tienes permiso para cancelar esta cita."}), 403 
    
    current_app.logger.info(f"Autorización concedida. Usuario (ID: {user.user_id}, Rol: {cancelling_as_role}) procede a verificar estado de cita ID {appointment.id}.")
    # --- FIN Lógica de Autorización ---

    # --- Lógica de Estado (¿Se puede cancelar?) ---
    cancellable_statuses = ['CONFIRMED', 'PENDING_PROVIDER']

    if appointment.status not in cancellable_statuses:
        current_app.logger.info(f"Intento de cancelar cita ID {appointment.id} (por Usuario ID: {user.user_id}) que no está en un estado cancelable. Estado actual: {appointment.status}.")
        return jsonify({"msg": f"Esta cita no se puede cancelar porque su estado actual es '{appointment.status}'."}), 409
    
    current_app.logger.info(f"Cita ID {appointment.id} (Estado actual: {appointment.status}) es cancelable por Usuario ID: {user.user_id} (Rol: {cancelling_as_role}).")
    # --- FIN Lógica de Estado ---

    # --- Actualizar Estado, Guardar y Devolver ---
    try:
        new_status = None
        if cancelling_as_role == 'client':
            new_status = 'CANCELLED_BY_CLIENT'
        elif cancelling_as_role == 'provider':
            new_status = 'CANCELLED_BY_PROVIDER'
        else:
            # Salvaguarda: este caso no debería ocurrir si la lógica anterior es correcta.
            current_app.logger.error(f"PUT /appointments/{appointment_id}/cancel: Rol de cancelación desconocido o no asignado ('{cancelling_as_role}') para la cita ID {appointment.id}.")
            return jsonify({"msg": "Error interno: no se pudo determinar el actor de la cancelación."}), 500

        appointment.status = new_status
        db.session.commit() # SQLAlchemy detectará el cambio en appointment.status

        current_app.logger.info(f"Cita ID {appointment.id} cancelada exitosamente. Nuevo estado: {appointment.status}. Cancelada por: {cancelling_as_role} (Usuario ID: {user.user_id}).")
        
        return jsonify(appointment.to_dict()), 200 # OK

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"PUT /appointments/{appointment_id}/cancel: Error al actualizar y guardar la cita ID {appointment.id} durante la cancelación: {e}")
        # Para depuración más detallada:
        # import traceback
        # current_app.logger.error(traceback.format_exc())
        return jsonify({"msg": "Error interno del servidor al intentar cancelar la cita."}), 500
    # --- FIN Actualizar Estado, Guardar y Devolver ---
