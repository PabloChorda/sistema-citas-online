# backend/app/routes.py
from flask import Blueprint, jsonify, request, current_app
from . import db
from .models import User, Provider, Service, AvailabilityRule, TimeBlock, Appointment # Todos los modelos necesarios
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from datetime import date, datetime, time, timedelta, timezone

# REFAC: Intentar importar zoneinfo (Python 3.9+) y pytz como fallback
try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:
    ZoneInfo = None # type: ignore # Define ZoneInfo como None si no se encuentra
    ZoneInfoNotFoundError = type(None) # Define ZoneInfoNotFoundError como un tipo base si no se encuentra

try:
    import pytz
except ImportError:
    pytz = None # type: ignore # Define pytz como None si no se encuentra


bp_api = Blueprint('api', __name__)

VALID_DAYS_OF_WEEK = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']
# REFAC: Constante para mapeo de días de la semana
PYTHON_WEEKDAY_TO_ENUM_STR = {0: 'LUNES', 1: 'MARTES', 2: 'MIERCOLES', 3: 'JUEVES', 4: 'VIERNES', 5: 'SABADO', 6: 'DOMINGO'}


# --- Funciones Auxiliares ---
def merge_overlapping_intervals(intervals: list[dict[str, datetime]]) -> list[dict[str, datetime]]:
    """
    Fusiona una lista de intervalos de tiempo que pueden estar solapados o ser adyacentes.
    Cada intervalo es un diccionario {'start': datetime_utc, 'end': datetime_utc}.
    Devuelve una nueva lista de intervalos no solapados, ordenados por inicio.
    """
    if not intervals:
        return []

    intervals.sort(key=lambda x: x['start'])
    merged = []
    # El check 'if not intervals:' de abajo es redundante si ya se hizo arriba, pero no hace daño.
    if not intervals: 
        return merged

    current_start = intervals[0]['start']
    current_end = intervals[0]['end']

    for i in range(1, len(intervals)):
        next_start = intervals[i]['start']
        next_end = intervals[i]['end']

        if next_start <= current_end: 
            current_end = max(current_end, next_end)
        else:
            merged.append({'start': current_start, 'end': current_end})
            current_start = next_start
            current_end = next_end
    
    merged.append({'start': current_start, 'end': current_end})
    return merged

# REFAC: NUEVA FUNCIÓN AUXILIAR para obtener el objeto timezone
def _get_provider_timezone_object(provider_timezone_str: str) -> timezone | None:
    """
    Intenta obtener un objeto tzinfo a partir de un string de zona horaria.
    Prioriza zoneinfo, luego pytz, y finalmente un fallback para 'UTC'.
    """
    provider_tz = None
    module_name = "_get_provider_timezone_object" # Para logs

    if ZoneInfo: # Si zoneinfo está disponible (Python 3.9+)
        try:
            provider_tz = ZoneInfo(provider_timezone_str)
            current_app.logger.debug(f"{module_name}: Timezone '{provider_timezone_str}' obtenida con zoneinfo.")
            return provider_tz
        except ZoneInfoNotFoundError: # type: ignore
            current_app.logger.warning(f"{module_name}: ZoneInfo no encontró la zona horaria: '{provider_timezone_str}'. Intentando con pytz.")
        except Exception as e_zi: # Otros errores de ZoneInfo
            current_app.logger.error(f"{module_name}: Error inesperado con ZoneInfo para '{provider_timezone_str}': {e_zi}")
    
    # Si ZoneInfo no está disponible o falló
    if pytz: # Si pytz está disponible
        try:
            provider_tz = pytz.timezone(provider_timezone_str)
            current_app.logger.debug(f"{module_name}: Timezone '{provider_timezone_str}' obtenida con pytz.")
            return provider_tz
        except pytz.UnknownTimeZoneError:
            current_app.logger.error(f"{module_name}: Zona horaria desconocida '{provider_timezone_str}' con pytz.")
        except Exception as e_pytz: # Otros errores de pytz
            current_app.logger.error(f"{module_name}: Error inesperado con pytz para '{provider_timezone_str}': {e_pytz}")

    # Fallback si ni zoneinfo ni pytz funcionaron o no están disponibles
    if provider_timezone_str and provider_timezone_str.upper() == 'UTC':
        current_app.logger.warning(f"{module_name}: Usando datetime.timezone.utc como fallback para 'UTC'.")
        return timezone.utc
        
    current_app.logger.error(f"{module_name}: No se pudo obtener el objeto timezone para '{provider_timezone_str}'.")
    return None


# REFAC: NUEVA FUNCIÓN AUXILIAR para calcular disponibilidad diaria (reglas + timeblocks)
def _calculate_daily_net_working_periods(provider_id: int, target_date: date, provider_tz_obj: timezone) -> list[dict[str, datetime]]:
    """
    Calcula los periodos de trabajo netos (en UTC) para un proveedor en una fecha específica,
    considerando AvailabilityRules y TimeBlocks.

    Args:
        provider_id: El ID del proveedor (de la tabla Provider, que es user_id).
        target_date: La fecha local del proveedor para la cual calcular la disponibilidad.
        provider_tz_obj: El objeto timezone (tzinfo) del proveedor ya resuelto.

    Returns:
        Una lista de diccionarios {'start': datetime_utc, 'end': datetime_utc}
        representando los periodos de trabajo netos fusionados, o una lista vacía si no hay disponibilidad.
    """
    module_name = "_calculate_daily_net_working_periods" # Para logs
    current_app.logger.debug(f"{module_name}: Iniciando para Provider ID {provider_id}, Fecha {target_date}, TZ {provider_tz_obj}")

    day_of_week_enum_value = PYTHON_WEEKDAY_TO_ENUM_STR.get(target_date.weekday())
    base_availability_intervals_utc = []

    if day_of_week_enum_value:
        rules_for_day = AvailabilityRule.query.filter_by(
            provider_id=provider_id,
            day_of_week=day_of_week_enum_value
        ).all()
        current_app.logger.debug(f"{module_name}: {len(rules_for_day)} reglas de disponibilidad para {day_of_week_enum_value} el {target_date}.")
        for rule in rules_for_day:
            start_dt_naive = datetime.combine(target_date, rule.start_time)
            end_dt_naive = datetime.combine(target_date, rule.end_time)
            
            # Convertir naive datetime a aware datetime usando la zona horaria del proveedor
            start_dt_aware_provider = start_dt_naive.replace(tzinfo=provider_tz_obj)
            end_dt_aware_provider = end_dt_naive.replace(tzinfo=provider_tz_obj)
            
            base_availability_intervals_utc.append({
                'start': start_dt_aware_provider.astimezone(timezone.utc),
                'end': end_dt_aware_provider.astimezone(timezone.utc)
            })
    else: # target_date.weekday() no devolvió un día esperado (0-6), lo cual es imposible para un objeto date.
        current_app.logger.error(f"{module_name}: No se pudo determinar el día de la semana válido para {target_date}")
        return [] # No se puede proceder sin un día de la semana válido.

    if not base_availability_intervals_utc:
        current_app.logger.debug(f"{module_name}: No hay reglas de disponibilidad base para Provider ID {provider_id} en {day_of_week_enum_value} ({target_date}).")
        # Se continúa con lista vacía, los TimeBlocks de is_available=True podrían añadir disponibilidad.

    # Calcular inicio y fin del día (target_date) en UTC para filtrar TimeBlocks
    day_start_local_naive = datetime.combine(target_date, time.min) # time.min es 00:00:00
    day_start_aware_provider_tz = day_start_local_naive.replace(tzinfo=provider_tz_obj)
    day_start_utc = day_start_aware_provider_tz.astimezone(timezone.utc)
    # El fin del día es el inicio del día siguiente
    next_day_start_utc = (day_start_aware_provider_tz + timedelta(days=1)).astimezone(timezone.utc)

    time_blocks_for_day = TimeBlock.query.filter(
        TimeBlock.provider_id == provider_id,
        TimeBlock.start_datetime < next_day_start_utc, # TimeBlock comienza antes de que termine el target_date
        TimeBlock.end_datetime > day_start_utc        # TimeBlock termina después de que comience el target_date
    ).order_by(TimeBlock.start_datetime).all()
    current_app.logger.debug(f"{module_name}: {len(time_blocks_for_day)} TimeBlocks encontrados solapados con {target_date} para Provider ID {provider_id}.")

    processed_intervals_utc = list(base_availability_intervals_utc)

    # Aplicar TimeBlocks que son is_available=False (bloqueos)
    for tb in time_blocks_for_day:
        if not tb.is_available:
            tb_start_utc = tb.start_datetime.astimezone(timezone.utc)
            tb_end_utc = tb.end_datetime.astimezone(timezone.utc)
            current_app.logger.debug(f"{module_name}: Aplicando TimeBlock NO disponible ID {tb.id}: {tb_start_utc.isoformat()} - {tb_end_utc.isoformat()}")
            
            next_processed_intervals = []
            for interval in processed_intervals_utc:
                # Lógica de resta de intervalos
                if tb_end_utc <= interval['start'] or tb_start_utc >= interval['end']: # No overlap
                    next_processed_intervals.append(interval)
                    continue
                if tb_start_utc <= interval['start'] and tb_end_utc < interval['end']: # Block covers beginning
                    if tb_end_utc < interval['end']: next_processed_intervals.append({'start': tb_end_utc, 'end': interval['end']})
                elif interval['start'] < tb_start_utc and tb_end_utc >= interval['end']: # Block covers end
                    if interval['start'] < tb_start_utc: next_processed_intervals.append({'start': interval['start'], 'end': tb_start_utc})
                elif interval['start'] < tb_start_utc and tb_end_utc < interval['end']: # Block in the middle (splits)
                    if interval['start'] < tb_start_utc: next_processed_intervals.append({'start': interval['start'], 'end': tb_start_utc})
                    if tb_end_utc < interval['end']: next_processed_intervals.append({'start': tb_end_utc, 'end': interval['end']})
                elif tb_start_utc <= interval['start'] and tb_end_utc >= interval['end']: # Block covers entirely
                    pass # Interval is removed
                else: # Complex overlaps or interval is contained within tb but not perfectly aligned - needs careful review if this branch is hit often
                    current_app.logger.warning(f"{module_name}: TimeBlock (is_available=False) ID {tb.id} ({tb_start_utc}-{tb_end_utc}) tuvo un solapamiento no estándar con el intervalo {interval}. El intervalo original no se añade.")
            processed_intervals_utc = next_processed_intervals
    
    # Aplicar TimeBlocks que son is_available=True (disponibilidad extra)
    extra_availability_utc = []
    for tb in time_blocks_for_day:
        if tb.is_available:
            tb_start_utc = tb.start_datetime.astimezone(timezone.utc)
            tb_end_utc = tb.end_datetime.astimezone(timezone.utc)
            # Clip the extra availability to the boundaries of the target_date in UTC
            effective_start = max(tb_start_utc, day_start_utc)
            effective_end = min(tb_end_utc, next_day_start_utc)
            if effective_start < effective_end: # Ensure there's a valid interval after clipping
                current_app.logger.debug(f"{module_name}: Añadiendo TimeBlock disponible ID {tb.id}: UTC {effective_start.isoformat()} - {effective_end.isoformat()}")
                extra_availability_utc.append({'start': effective_start, 'end': effective_end})

    combined_intervals_utc = processed_intervals_utc + extra_availability_utc
    net_working_periods_utc = merge_overlapping_intervals(combined_intervals_utc)
    
    current_app.logger.debug(f"{module_name}: Para Provider ID {provider_id}, Fecha {target_date}, Periodos netos finales calculados: {net_working_periods_utc}")
    return net_working_periods_utc
# --- FIN DE NUEVAS FUNCIONES AUXILIARES ---

# --- Ruta de prueba ---
@bp_api.route('/test-db', methods=['GET']) 
def api_test_db():
    try:
        user_count = User.query.count()
        return jsonify({"message": "Conexión a DB exitosa!", "user_count": user_count}), 200
    except Exception as e:
        current_app.logger.error(f"Error conectando a DB: {e}")
        return jsonify({"message": "Error conectando a DB", "error": str(e)}), 500

# --- Autenticación Endpoints ---
@bp_api.route('/auth/register/provider', methods=['POST'])
def register_provider():
    """
    POST /auth/register/provider
    -----------------------------

    Registra un nuevo usuario con rol "provider" y crea automáticamente su perfil de proveedor.

    ✅ Campos requeridos (en JSON):
        - email: str — Email del usuario.
        - password: str — Contraseña del usuario (se guarda hasheada).
        - business_name: str — Nombre del negocio del proveedor.

    🟡 Campos opcionales:
        - first_name: str — Nombre del usuario.
        - last_name: str — Apellido del usuario.
        - phone_number: str — Teléfono de contacto.
        - business_type: str — Tipo de negocio. Por defecto 'default_type'.
        - timezone: str — Zona horaria. Por defecto 'UTC'.
        - address: str — Dirección del negocio.
        - bio: str — Descripción o biografía del proveedor.

    📤 Respuesta (201):
        {
            "msg": "Proveedor registrado exitosamente!",
            "user": { ...datos del usuario... },
            "provider_profile": { ...datos del perfil proveedor... }
        }

    ❌ Errores posibles:
        - 400: Si falta algún campo obligatorio.
        - 409: Si el email ya está registrado.
        - 500: Si ocurre un error interno al guardar en base de datos.
    """
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('business_name'):
        return jsonify({"msg": "Faltan datos requeridos: email, password, business_name"}), 400

    email = data.get('email')
    password = data.get('password')
    business_name = data.get('business_name')

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "El email ya está registrado"}), 409

    new_user = User(
        email=email,
        role='provider',
        first_name=data.get('first_name'),
        last_name=data.get('last_name'),
        phone_number=data.get('phone_number')
    )
    new_user.set_password(password)

    new_provider_profile = Provider(
        business_name=business_name,
        business_type=data.get('business_type', 'default_type'),
        timezone=data.get('timezone', 'UTC'),
        address=data.get('address'),
        bio=data.get('bio')
    )
    new_user.provider_profile = new_provider_profile

    try:
        db.session.add(new_user)
        db.session.commit()
        user_data = new_user.to_dict()
        profile_data = new_provider_profile.to_dict()
        return jsonify({
            "msg": "Proveedor registrado exitosamente!",
            "user": user_data,
            "provider_profile": profile_data
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al registrar proveedor: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno del servidor al registrar el proveedor", "error_details": str(e)}), 500

@bp_api.route('/auth/register/client', methods=['POST'])
def register_client():
    """
    POST /auth/register/client
    ---------------------------

    Registra un nuevo usuario con rol "client".

    ✅ Campos requeridos (en JSON):
        - email: str — Email del usuario.
        - password: str — Contraseña del usuario (se guarda de forma segura).

    🟡 Campos opcionales:
        - first_name: str — Nombre del cliente.
        - last_name: str — Apellido del cliente.
        - phone_number: str — Teléfono de contacto.

    📤 Respuesta (201):
        {
            "msg": "Cliente registrado exitosamente!",
            "user": { ...datos del usuario... }
        }

    ❌ Errores posibles:
        - 400: Si falta el email o la contraseña.
        - 409: Si ya existe un usuario con ese email.
        - 500: Si ocurre un error interno al guardar en base de datos.
    """
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"msg": "Faltan datos requeridos: email, password"}), 400

    email = data.get('email')
    password = data.get('password')

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "El email ya está registrado"}), 409

    new_user = User(
        email=email,
        role='client',
        first_name=data.get('first_name'),
        last_name=data.get('last_name'),
        phone_number=data.get('phone_number')
    )
    new_user.set_password(password)

    try:
        db.session.add(new_user)
        db.session.commit()
        user_data = new_user.to_dict()
        return jsonify({
            "msg": "Cliente registrado exitosamente!",
            "user": user_data
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al registrar cliente: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno del servidor al registrar el cliente", "error_details": str(e)}), 500

@bp_api.route('/auth/login', methods=['POST'])
def login():
    """
    POST /auth/login
    ----------------

    Inicia sesión de un usuario (cliente o proveedor) y genera un JWT válido.

    ✅ Campos requeridos (en JSON):
        - email: str — Email del usuario.
        - password: str — Contraseña del usuario.

    📤 Respuesta exitosa (200):
        {
            "access_token": "JWT_TOKEN_GENERADO",
            "user_id": int,
            "role": "client" | "provider"
        }

    ❌ Errores posibles:
        - 400: Si faltan email o contraseña.
        - 401: Si las credenciales son incorrectas.

    🔐 Seguridad:
        - Utiliza JWT (Json Web Tokens) para autenticar futuras solicitudes.
        - El token generado se debe incluir en el header Authorization como:
            Authorization: Bearer <token>
    """

    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"msg": "Faltan email o contraseña"}), 400

    email = data.get('email')
    password = data.get('password')
    user = User.query.filter_by(email=email).first()

    if user and user.check_password(password):
        identity_to_store = str(user.user_id)
        access_token = create_access_token(identity=identity_to_store)
        current_app.logger.info(f"TOKEN GENERADO PARA LOGIN (user_id {user.user_id}, identity_stored: '{identity_to_store}'): {access_token}")
        return jsonify(access_token=access_token, user_id=user.user_id, role=user.role), 200
    else:
        return jsonify({"msg": "Credenciales incorrectas"}), 401

@bp_api.route('/protected', methods=['GET'])
@jwt_required()
def protected_route_example():
    """
    GET /protected
    --------------

    Ruta protegida de ejemplo que requiere autenticación JWT para acceder.

    🔐 Requiere token JWT válido:
        - El token debe ser incluido en el header Authorization:
          Authorization: Bearer <access_token>

    📤 Respuesta exitosa (200):
        {
            "logged_in_as": "usuario@example.com",
            "user_id": 1,
            "role": "client" | "provider",
            "message": "¡Acceso a ruta protegida concedido!"
        }

    ❌ Errores posibles:
        - 401: Token JWT ausente, inválido o expirado.
        - 422: Identidad del token no es un entero válido.
        - 404: Usuario no encontrado con el ID extraído del token.

    📚 Propósito:
        Esta ruta sirve como ejemplo para validar que el sistema de autenticación
        JWT está funcionando correctamente. Ideal para testing o debugging.
    """
    current_app.logger.info("Accediendo a ruta protegida '/protected'.")
    try:
        raw_jwt_header = request.headers.get('Authorization')
        current_app.logger.info(f"Raw Authorization Header: {raw_jwt_header}")
    except Exception as e:
        current_app.logger.error(f"Error obteniendo/logueando JWT en ruta protegida: {e}")

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"Error: La identidad del token ('{current_user_id_str}') no es un entero válido.")
        return jsonify({"msg": "Identidad del token inválida"}), 422

    user = User.query.get(current_user_id_int)

    if not user:
        current_app.logger.warning(f"Usuario no encontrado para ID (del token): {current_user_id_int}")
        return jsonify({"msg": "Usuario no encontrado con la identidad del token"}), 404

    current_app.logger.info(f"Usuario autenticado en '/protected': {user.email} (ID: {user.user_id})")
    return jsonify(logged_in_as=user.email, user_id=user.user_id, role=user.role, message="¡Acceso a ruta protegida concedido!"), 200

@bp_api.route('/services', methods=['POST'])
@jwt_required()
def create_service():
    """
    POST /services
    --------------

    Crea un nuevo servicio para un proveedor autenticado.

    🔐 Requiere autenticación JWT:
        - Solo usuarios con rol `provider` pueden acceder.
        - El usuario debe tener un perfil de proveedor asociado.

    📥 Cuerpo JSON requerido:
        {
            "name": "Corte de cabello",
            "description": "Servicio de peluquería profesional",
            "duration_minutes": 30,
            "price": 15.5,                  # Opcional
            "is_active": true               # Opcional, por defecto True
        }

    📤 Respuesta exitosa (201):
        {
            "msg": "Servicio creado exitosamente!",
            "service": {
                "service_id": 1,
                "provider_id": 2,
                "name": "Corte de cabello",
                "description": "...",
                "duration_minutes": 30,
                "price": 15.5,
                "is_active": true
            }
        }

    ❌ Errores posibles:
        - 400: Faltan campos obligatorios o valores inválidos (nombre, duración, precio negativo, etc.).
        - 401: Token JWT ausente o inválido.
        - 403: Usuario no tiene rol `provider`.
        - 404: Usuario del token no encontrado.
        - 422: Identidad del token no es un número válido.
        - 500: Error interno al guardar en la base de datos.

    📚 Propósito:
        Permite a proveedores crear nuevos servicios disponibles para que los clientes los reserven.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"Error: La identidad del token para crear servicio ('{current_user_id_str}') no es un entero válido.")
        return jsonify({"msg": "Identidad del token inválida para crear servicio"}), 422
        
    user = User.query.get(current_user_id_int)

    if not user:
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden crear servicios"}), 403
    if not user.provider_profile:
        current_app.logger.error(f"Usuario proveedor (ID: {user.user_id}) no tiene un perfil de proveedor asociado.")
        return jsonify({"msg": "Este usuario proveedor no tiene un perfil de proveedor configurado correctamente."}), 400

    data = request.get_json()
    if not data or not data.get('name') or not data.get('duration_minutes'):
        return jsonify({"msg": "Faltan datos requeridos: name, duration_minutes"}), 400

    try:
        duration_minutes = int(data.get('duration_minutes'))
        if duration_minutes <= 0:
            return jsonify({"msg": "duration_minutes debe ser un entero positivo"}), 400
    except (ValueError, TypeError):
        return jsonify({"msg": "duration_minutes debe ser un entero válido"}), 400
        
    price_str = data.get('price')
    price = None
    if price_str is not None:
        try:
            price = float(price_str)
            if price < 0:
                 return jsonify({"msg": "El precio no puede ser negativo"}), 400
        except (ValueError, TypeError):
            return jsonify({"msg": "El precio debe ser un número válido"}), 400

    new_service = Service(
        provider_id=user.provider_profile.provider_id,
        name=data.get('name'),
        description=data.get('description'),
        duration_minutes=duration_minutes,
        price=price,
        is_active=data.get('is_active', True)
    )

    try:
        db.session.add(new_service)
        db.session.commit()
        service_data = new_service.to_dict()
        return jsonify({"msg": "Servicio creado exitosamente!", "service": service_data}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear servicio: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno al crear el servicio", "error_details": str(e)}), 500

@bp_api.route('/services', methods=['GET'])
@jwt_required()
def get_provider_services():
    """
    GET /services
    --------------

    Obtiene la lista de servicios ofrecidos por el proveedor autenticado.

    🔐 Requiere autenticación JWT:
        - Solo usuarios con rol `provider` pueden acceder.
        - El usuario debe tener un perfil de proveedor asociado.

    📤 Respuesta exitosa (200):
        [
            {
                "service_id": 1,
                "provider_id": 2,
                "name": "Corte de cabello",
                "description": "Servicio de peluquería profesional",
                "duration_minutes": 30,
                "price": 15.5,
                "is_active": true
            },
            ...
        ]

    ❌ Errores posibles:
        - 401: Token JWT ausente o inválido.
        - 403: Acceso denegado o usuario no tiene el rol adecuado.
        - 404: No se encontró perfil de proveedor asociado.
        - 422: Identidad del token no es un número válido.

    📚 Propósito:
        Permite al proveedor autenticado ver todos los servicios que ha registrado.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    if not user or user.role != 'provider':
        return jsonify({"msg": "Acceso denegado o usuario no es proveedor"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 404

    services = user.provider_profile.services_offered.all()
    return jsonify([service.to_dict() for service in services]), 200

@bp_api.route('/services/<int:service_id>', methods=['GET'])
@jwt_required()
def get_service_detail(service_id):
    """
    GET /services/<service_id>
    ----------------------------

    Obtiene el detalle de un servicio específico creado por el proveedor autenticado.

    🔐 Requiere autenticación JWT:
        - Solo accesible para usuarios con rol `provider`.
        - El servicio debe pertenecer al proveedor autenticado.

    📥 Parámetros:
        - service_id (int): ID del servicio a consultar.

    📤 Respuesta exitosa (200):
        {
            "service_id": 1,
            "provider_id": 2,
            "name": "Consulta inicial",
            "description": "Sesión de evaluación inicial con el cliente",
            "duration_minutes": 60,
            "price": 50.0,
            "is_active": true
        }

    ❌ Errores posibles:
        - 401: Token JWT ausente o inválido.
        - 403: Acceso denegado o el servicio no pertenece al proveedor autenticado.
        - 404: Servicio no encontrado o perfil de proveedor inexistente.
        - 422: El valor de identidad del token no es un entero válido.

    📚 Propósito:
        Permite al proveedor ver todos los detalles de uno de sus servicios individuales,
        útil para edición o revisión en la interfaz de administración.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    if not user or user.role != 'provider':
        return jsonify({"msg": "Acceso denegado o usuario no es proveedor"}), 403
    if not user.provider_profile: 
        return jsonify({"msg": "Perfil de proveedor no encontrado"}), 404

    service = Service.query.get(service_id)
    if not service:
        return jsonify({"msg": "Servicio no encontrado"}), 404
    if service.provider_id != user.provider_profile.provider_id:
        return jsonify({"msg": "Acceso denegado: este servicio no pertenece a este proveedor"}), 403
    return jsonify(service.to_dict()), 200

@bp_api.route('/services/<int:service_id>', methods=['PUT'])
@jwt_required()
def update_service(service_id):
    """
    PUT /services/<service_id>
    ----------------------------

    Actualiza un servicio existente del proveedor autenticado.

    🔐 Requiere autenticación JWT:
        - Solo accesible para usuarios con rol `provider`.
        - El servicio debe pertenecer al proveedor autenticado.

    📥 Parámetros:
        - service_id (int): ID del servicio que se desea actualizar.
        - Body JSON opcional con los siguientes campos:
            - name (str): Nombre del servicio.
            - description (str): Descripción del servicio.
            - duration_minutes (int): Duración en minutos (debe ser entero positivo).
            - price (float | null): Precio del servicio (debe ser número positivo o null).
            - is_active (bool): Estado de activación del servicio.

    📤 Respuesta exitosa (200):
        {
            "msg": "Servicio actualizado exitosamente",
            "service": {
                "service_id": 1,
                "provider_id": 2,
                "name": "Consulta modificada",
                "description": "...",
                "duration_minutes": 45,
                "price": 40.0,
                "is_active": true
            }
        }

    ❌ Errores posibles:
        - 400: Datos inválidos o faltantes.
        - 401: Token JWT inválido o ausente.
        - 403: El usuario no tiene permiso para modificar este servicio.
        - 404: Servicio no encontrado o perfil de proveedor no existe.
        - 422: Token inválido (identidad no convertible a entero).
        - 500: Error interno al guardar los cambios en base de datos.

    📚 Propósito:
        Permite al proveedor modificar los datos de sus servicios desde la interfaz de administración.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    if not user or user.role != 'provider':
        return jsonify({"msg": "Acceso denegado o usuario no es proveedor"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado"}), 404

    service = Service.query.get(service_id)
    if not service:
        return jsonify({"msg": "Servicio no encontrado para actualizar"}), 404
    if service.provider_id != user.provider_profile.provider_id:
        return jsonify({"msg": "Acceso denegado: no puede actualizar un servicio que no le pertenece"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se enviaron datos para actualizar"}), 400

    if 'name' in data: service.name = data['name']
    if 'description' in data: service.description = data['description']
    if 'duration_minutes' in data:
        try:
            duration = int(data['duration_minutes'])
            if duration <= 0: return jsonify({"msg": "duration_minutes debe ser un entero positivo"}), 400
            service.duration_minutes = duration
        except (ValueError, TypeError): return jsonify({"msg": "duration_minutes debe ser un entero válido"}), 400
    if 'price' in data:
        if data['price'] is not None:
            try:
                price = float(data['price'])
                if price < 0: return jsonify({"msg": "El precio no puede ser negativo"}), 400
                service.price = price
            except (ValueError, TypeError): return jsonify({"msg": "El precio debe ser un número válido"}), 400
        else: service.price = None
    if 'is_active' in data:
        if not isinstance(data['is_active'], bool): return jsonify({"msg": "is_active debe ser un valor booleano (true/false)"}), 400
        service.is_active = data['is_active']

    try:
        db.session.commit()
        return jsonify({"msg": "Servicio actualizado exitosamente", "service": service.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al actualizar servicio: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno al actualizar el servicio", "error_details": str(e)}), 500

@bp_api.route('/services/<int:service_id>', methods=['DELETE'])
@jwt_required()
def delete_service(service_id):
    """
    DELETE /services/<service_id>
    -----------------------------

    Elimina un servicio específico perteneciente al proveedor autenticado.

    🔐 Requiere autenticación JWT:
        - Solo accesible para usuarios con rol `provider`.
        - El servicio debe pertenecer al proveedor autenticado.

    📥 Parámetros:
        - service_id (int): ID del servicio que se desea eliminar.

    📤 Respuesta exitosa (200):
        {
            "msg": "Servicio eliminado exitosamente"
        }

    ❌ Errores posibles:
        - 400: Perfil de proveedor no válido.
        - 401: Token JWT inválido o ausente.
        - 403: Usuario no tiene permiso para eliminar este servicio.
        - 404: Servicio no encontrado o no pertenece al proveedor.
        - 422: Token inválido (identidad no convertible a entero).
        - 500: Error interno al eliminar el servicio en base de datos.

    📚 Propósito:
        Permite a un proveedor eliminar un servicio existente que ha sido creado previamente.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    if not user or user.role != 'provider':
        return jsonify({"msg": "Acceso denegado o usuario no es proveedor"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado"}), 404

    service = Service.query.get(service_id)
    if not service:
        return jsonify({"msg": "Servicio no encontrado para eliminar"}), 404
    if service.provider_id != user.provider_profile.provider_id:
        return jsonify({"msg": "Acceso denegado: no puede eliminar un servicio que no le pertenece"}), 403

    try:
        db.session.delete(service)
        db.session.commit()
        return jsonify({"msg": "Servicio eliminado exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al eliminar servicio: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno al eliminar el servicio", "error_details": str(e)}), 500

# --- Endpoints para AvailabilityRule (Disponibilidad Recurrente del Proveedor) ---
@bp_api.route('/availability-rules', methods=['POST'])
@jwt_required()
def create_availability_rule():
    """
    POST /availability-rules
    =========================

    🔐 Ruta protegida para crear una regla de disponibilidad recurrente para un proveedor.

    Esta regla define en qué días de la semana y horarios un proveedor estará disponible.

    Requisitos:
    -----------
    - El usuario debe estar autenticado mediante JWT.
    - El usuario debe tener el rol "provider".
    - El proveedor debe tener un perfil asociado.

    JSON esperado (Body):
    ----------------------
    {
        "day_of_week": "MONDAY",          # Día de la semana (mayúsculas preferidas, e.g. MONDAY, TUESDAY...)
        "start_time": "09:00",            # Hora de inicio en formato HH:MM o HH:MM:SS
        "end_time": "17:00"               # Hora de fin en formato HH:MM o HH:MM:SS
    }

    Días válidos:
    -------------
    - MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY  # (Asegúrate que coincida con tu constante VALID_DAYS_OF_WEEK)

    Respuestas:
    -----------
    ✅ 201 Created:
        {
            "msg": "Regla de disponibilidad creada exitosamente",
            "rule": { ... } # Objeto de la regla creada
        }

    ⚠️ 400 Bad Request:
        - Faltan campos requeridos.
        - Formato de hora inválido.
        - day_of_week no válido.
        - start_time es posterior o igual a end_time.
        - El usuario no tiene perfil de proveedor.

    ⚠️ 403 Forbidden:
        - El usuario no tiene rol de proveedor.

    ❌ 422 Unprocessable Entity:
        - Identidad del token inválida.

    ❌ 500 Internal Server Error:
        - Fallo al guardar en la base de datos.
    """
    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    if not user or user.role != 'provider':
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden crear reglas de disponibilidad"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 400

    data = request.get_json()
    if not data: 
        return jsonify({"msg": "No se enviaron datos"}), 400

    day_of_week_from_request = data.get('day_of_week') 
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')

    if day_of_week_from_request is None or start_time_str is None or end_time_str is None:
        return jsonify({"msg": "Faltan datos requeridos: day_of_week, start_time, end_time"}), 400
    
    if not isinstance(day_of_week_from_request, str) or day_of_week_from_request.upper() not in VALID_DAYS_OF_WEEK:
        return jsonify({"msg": f"day_of_week debe ser uno de los siguientes valores: {', '.join(VALID_DAYS_OF_WEEK)}"}), 400
    
    day_of_week_for_db = day_of_week_from_request.upper()

    try:
        # Asumiendo que 'time' está importado de 'from datetime import time' al principio del archivo
        start_time_obj = time.fromisoformat(start_time_str)
        end_time_obj = time.fromisoformat(end_time_str)
    except ValueError:
        return jsonify({"msg": "Formato de start_time o end_time inválido. Usar HH:MM o HH:MM:SS"}), 400

    if start_time_obj >= end_time_obj:
        return jsonify({"msg": "start_time debe ser anterior a end_time"}), 400

    new_rule = AvailabilityRule(
        provider_id=user.provider_profile.provider_id,
        day_of_week=day_of_week_for_db,
        start_time=start_time_obj,
        end_time=end_time_obj
    )
    try:
        db.session.add(new_rule)
        db.session.commit()
        return jsonify({"msg": "Regla de disponibilidad creada exitosamente", "rule": new_rule.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear regla de disponibilidad: {e}", exc_info=True) # exc_info=True para traceback completo en logs
        return jsonify({"msg": "Error interno al crear la regla de disponibilidad."}), 500

@bp_api.route('/availability-rules', methods=['GET'])
@jwt_required()
def get_availability_rules():
    """
    GET /availability-rules
    ========================

    🔐 Ruta protegida que devuelve la lista de reglas de disponibilidad recurrente
    asociadas al proveedor autenticado.

    Cada regla indica un día de la semana y un rango horario en el que el proveedor está disponible.

    Requisitos:
    -----------
    - El usuario debe estar autenticado mediante JWT.
    - El usuario debe tener el rol "provider".
    - El proveedor debe tener un perfil asociado.

    Respuesta:
    ----------
    ✅ 200 OK:
        [
            {
                "id": 1,
                "day_of_week": "MONDAY", // O el valor string del ENUM
                "start_time": "09:00:00",
                "end_time": "17:00:00"
                // ... otros campos del to_dict() ...
            },
            // ... más reglas ...
        ]

    ⚠️ 403 Forbidden:
        - El usuario no tiene rol de proveedor o no está autorizado.

    ⚠️ 404 Not Found:
        - El proveedor no tiene un perfil asociado o el usuario del token no existe.

    ❌ 422 Unprocessable Entity:
        - Identidad del token inválida.
    """
    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)

    if not user: # Chequeo añadido por consistencia
        return jsonify({"msg": "Usuario del token no encontrado."}), 404
    if user.role != 'provider':
        return jsonify({"msg": "Acceso denegado."}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado."}), 404

    rules = user.provider_profile.availability_rules.order_by(AvailabilityRule.day_of_week, AvailabilityRule.start_time).all()
    return jsonify([rule.to_dict() for rule in rules]), 200

# El endpoint DELETE que ya habías añadido (está correcto):
@bp_api.route('/availability-rules/<int:rule_id>', methods=['DELETE'])
@jwt_required()
def delete_availability_rule(rule_id):
    """
    DELETE /availability-rules/<int:rule_id>
    ========================================

    🔐 Ruta protegida que permite a un proveedor eliminar una regla de disponibilidad recurrente
    previamente creada.

    Solo el proveedor que creó la regla puede eliminarla.

    Parámetros:
    -----------
    - rule_id (int): ID de la regla de disponibilidad a eliminar.

    Requisitos:
    -----------
    - El usuario debe estar autenticado mediante JWT.
    - El usuario debe tener rol "provider".
    - La regla debe pertenecer al proveedor autenticado.

    Respuesta:
    ----------
    ✅ 200 OK:
        {
            "msg": "Regla de disponibilidad eliminada exitosamente"
        }

    ⚠️ 400 Bad Request:
        - El proveedor no tiene perfil asociado.

    ⚠️ 403 Forbidden:
        - El usuario no es proveedor o intenta eliminar una regla ajena.

    ⚠️ 404 Not Found:
        - La regla de disponibilidad no existe.
        - El usuario no existe en base de datos.

    ❌ 422 Unprocessable Entity:
        - La identidad extraída del token no es válida.

    ❌ 500 Internal Server Error:
        - Error inesperado al intentar eliminar la regla.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"DELETE /availability-rules: Identidad del token inválida '{current_user_id_str}'")
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} intentando borrar AvailabilityRule ID {rule_id}")

    if not user: 
        current_app.logger.warning(f"DELETE /availability-rules: Usuario del token no encontrado (ID: {current_user_id_int})")
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        current_app.logger.warning(f"DELETE /availability-rules: Usuario ID {user.user_id} no es proveedor (rol: {user.role})")
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden eliminar reglas de disponibilidad"}), 403
    if not user.provider_profile:
        current_app.logger.error(f"DELETE /availability-rules: Usuario proveedor (ID: {user.user_id}) no tiene un perfil de proveedor asociado.")
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 400 

    rule = AvailabilityRule.query.get(rule_id)
    if not rule:
        current_app.logger.info(f"DELETE /availability-rules: Regla de disponibilidad ID {rule_id} no encontrada.")
        return jsonify({"msg": "Regla de disponibilidad no encontrada para eliminar"}), 404
    
    if rule.provider_id != user.provider_profile.provider_id:
        current_app.logger.warning(f"DELETE /availability-rules: Usuario ID {user.user_id} intentó borrar regla ID {rule_id} que no le pertenece (pertenece a Provider ID {rule.provider_id})")
        return jsonify({"msg": "Acceso denegado: no puede eliminar una regla que no le pertenece"}), 403

    try:
        db.session.delete(rule)
        db.session.commit()
        current_app.logger.info(f"Usuario ID {user.user_id} eliminó exitosamente AvailabilityRule ID {rule_id}")
        return jsonify({"msg": "Regla de disponibilidad eliminada exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al eliminar regla de disponibilidad ID {rule_id}: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno al eliminar la regla de disponibilidad", "error_details": str(e)}), 500
    
@bp_api.route('/availability-rules/<int:rule_id>', methods=['PUT'])
@jwt_required()
def update_availability_rule(rule_id):
    """
    PUT /availability-rules/<int:rule_id>
    =====================================

    🔐 Ruta protegida que permite a un proveedor autenticado actualizar una regla de disponibilidad existente.

    Solo el proveedor que creó la regla puede modificarla. Los campos que pueden actualizarse son:
    - day_of_week (str): Día de la semana (ej: "MONDAY", "TUESDAY", etc.)
    - start_time (str): Hora de inicio en formato HH:MM o HH:MM:SS.
    - end_time (str): Hora de fin en formato HH:MM o HH:MM:SS.

    Parámetros:
    -----------
    - rule_id (int): ID de la regla a actualizar.
    - JSON Body (al menos uno requerido):
        {
            "day_of_week": "MONDAY",
            "start_time": "09:00",
            "end_time": "17:00"
        }

    Requisitos:
    -----------
    - Usuario autenticado con JWT.
    - Usuario con rol "provider".
    - El ID de la regla debe pertenecer al proveedor autenticado.

    Respuestas:
    -----------
    ✅ 200 OK:
        {
            "msg": "Regla de disponibilidad actualizada exitosamente",
            "rule": { ... }
        }

    ⚠️ 200 OK (sin cambios):
        {
            "msg": "Los datos proporcionados no modifican la regla actual.",
            "rule": { ... }
        }

    ⚠️ 400 Bad Request:
        - No se proporcionaron datos válidos.
        - day_of_week inválido.
        - Formato de hora incorrecto.
        - start_time posterior o igual a end_time.

    ⚠️ 403 Forbidden:
        - El usuario no es proveedor o intenta modificar reglas ajenas.

    ⚠️ 404 Not Found:
        - Usuario o regla no encontrada.

    ❌ 422 Unprocessable Entity:
        - La identidad del JWT no es válida.

    ❌ 500 Internal Server Error:
        - Error inesperado al guardar cambios.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"PUT /availability-rules: Identidad del token inválida '{current_user_id_str}'")
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} intentando actualizar AvailabilityRule ID {rule_id}")

    if not user:
        current_app.logger.warning(f"PUT /availability-rules: Usuario del token no encontrado (ID: {current_user_id_int})")
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        current_app.logger.warning(f"PUT /availability-rules: Usuario ID {user.user_id} no es proveedor (rol: {user.role})")
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden actualizar reglas"}), 403
    if not user.provider_profile:
        current_app.logger.error(f"PUT /availability-rules: Usuario proveedor (ID: {user.user_id}) no tiene un perfil.")
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 400

    rule = AvailabilityRule.query.get(rule_id)
    if not rule:
        current_app.logger.info(f"PUT /availability-rules: Regla ID {rule_id} no encontrada.")
        return jsonify({"msg": "Regla de disponibilidad no encontrada para actualizar"}), 404
    
    if rule.provider_id != user.provider_profile.provider_id:
        current_app.logger.warning(f"PUT /availability-rules: Usuario ID {user.user_id} intentó actualizar regla ID {rule_id} que no le pertenece.")
        return jsonify({"msg": "Acceso denegado: no puede actualizar una regla que no le pertenece"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se enviaron datos para actualizar"}), 400

    # Inicializar con los valores actuales de la regla
    # Estos se usarán para la validación final del rango y para la asignación.
    final_day_of_week = rule.day_of_week 
    final_start_time = rule.start_time
    final_end_time = rule.end_time
    updated_fields_count = 0 # Contador para saber si realmente se envió algún dato para actualizar

    if 'day_of_week' in data:
        day_of_week_from_request = data['day_of_week']
        if not isinstance(day_of_week_from_request, str) or day_of_week_from_request.upper() not in VALID_DAYS_OF_WEEK:
            return jsonify({"msg": f"day_of_week debe ser uno de: {', '.join(VALID_DAYS_OF_WEEK)}"}), 400
        final_day_of_week = day_of_week_from_request.upper()
        updated_fields_count += 1

    if 'start_time' in data:
        try:
            final_start_time = dt_time.fromisoformat(data['start_time'])
            updated_fields_count += 1
        except ValueError:
            return jsonify({"msg": "Formato de start_time inválido. Usar HH:MM o HH:MM:SS"}), 400
    
    if 'end_time' in data:
        try:
            final_end_time = dt_time.fromisoformat(data['end_time'])
            updated_fields_count += 1
        except ValueError:
            return jsonify({"msg": "Formato de end_time inválido. Usar HH:MM o HH:MM:SS"}), 400

    # Si no se envió ningún campo conocido en 'data' para actualizar.
    if not updated_fields_count and data: # 'data' no está vacío pero no contenía campos actualizables
        # Comprobar si hay otros campos desconocidos en data, o si simplemente no se envió nada útil
        # Si 'data' es un JSON vacío {}, updated_fields_count será 0 y 'data' será False,
        # por lo que el if de arriba (if not data:) ya lo habría capturado.
        # Este if es por si se envían campos que no son 'day_of_week', 'start_time', o 'end_time'.
        # Aunque, si solo se envían campos válidos pero con los mismos valores, updated_fields_count podría ser >0.
        # El check de "updated" abajo es más para la lógica de "realmente cambió algo?".
        pass # Se podría añadir lógica aquí si se quiere ser más estricto con campos desconocidos.

    # Validar el rango de tiempo ANTES de asignar a la regla
    if final_start_time >= final_end_time:
        return jsonify({"msg": "start_time debe ser anterior a end_time"}), 400
    
    # Asignar los valores finales a la regla.
    # Los validadores del modelo se dispararán aquí.
    rule.day_of_week = final_day_of_week
    rule.start_time = final_start_time 
    rule.end_time = final_end_time

    # Verificar si realmente hubo un cambio semántico después de las asignaciones.
    # db.session.is_modified(rule) podría ser útil aquí si los valores asignados
    # son diferentes de los originales.
    # Si updated_fields_count es 0 y data no estaba vacío, significa que no había campos válidos.
    # Pero si updated_fields_count > 0, significa que se intentó una actualización.
    
    if not db.session.is_modified(rule) and updated_fields_count > 0 : # Si se enviaron datos pero no modificaron el objeto
        return jsonify({"msg": "Los datos proporcionados no modifican la regla actual.", "rule": rule.to_dict()}), 200
    elif not updated_fields_count and data: # Si se enviaron datos, pero ninguno era un campo actualizable
         return jsonify({"msg": "No se proporcionaron campos válidos para actualizar."}), 400


    try:
        db.session.commit()
        current_app.logger.info(f"Usuario ID {user.user_id} actualizó exitosamente AvailabilityRule ID {rule_id}")
        return jsonify({"msg": "Regla de disponibilidad actualizada exitosamente", "rule": rule.to_dict()}), 200
    except ValueError as ve: # Captura específica de ValueErrors de los validadores del modelo
        db.session.rollback()
        current_app.logger.error(f"Error de validación al actualizar regla ID {rule_id}: {ve}")
        return jsonify({"msg": str(ve)}), 400 # Devuelve el mensaje del validador
    except Exception as e: 
        db.session.rollback()
        current_app.logger.error(f"Error interno al actualizar regla de disponibilidad ID {rule_id}: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno al actualizar la regla", "error_details": str(e)}), 500

# --- Y luego los endpoints para TimeBlock y Appointment ---


# --- Endpoints para TimeBlock (Excepciones de Disponibilidad del Proveedor) ---

@bp_api.route('/time-blocks', methods=['POST'])
@jwt_required()
def create_time_block():
    """
    POST /time-blocks
    =================

    🔐 Ruta protegida que permite a un proveedor autenticado crear un bloque de tiempo (disponible o no disponible)
    en su calendario.

    Este endpoint sirve para marcar disponibilidad o indisponibilidad específica en momentos concretos, complementando
    la disponibilidad recurrente semanal.

    Requisitos:
    -----------
    - Usuario autenticado mediante JWT.
    - Usuario con rol "provider".
    - El proveedor debe tener un perfil creado.

    Cuerpo JSON requerido:
    ----------------------
    {
        "start_datetime": "2025-06-01T09:00:00+02:00",  # Obligatorio
        "end_datetime": "2025-06-01T11:00:00+02:00",    # Obligatorio
        "is_available": false,                          # Opcional (por defecto: false)
        "reason": "Vacaciones"                          # Opcional (texto explicativo)
    }

    Notas importantes:
    ------------------
    - Los campos `start_datetime` y `end_datetime` deben incluir zona horaria (ej: `+02:00` o `Z`).
    - `start_datetime` debe ser anterior a `end_datetime`.
    - `is_available` debe ser booleano (true / false).

    Respuestas:
    -----------
    ✅ 201 Created:
        {
            "msg": "Bloque de tiempo creado exitosamente",
            "time_block": { ... }
        }

    ⚠️ 400 Bad Request:
        - Falta alguno de los campos obligatorios.
        - Fechas mal formateadas o sin zona horaria.
        - `is_available` no es booleano.
        - `start_datetime` no es anterior a `end_datetime`.

    ⚠️ 403 Forbidden:
        - El usuario autenticado no es proveedor.

    ⚠️ 404 Not Found:
        - El usuario autenticado no tiene perfil de proveedor.

    ❌ 422 Unprocessable Entity:
        - El token JWT es inválido.

    ❌ 500 Internal Server Error:
        - Fallo inesperado en la base de datos o validaciones del modelo.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"POST /time-blocks: Identidad del token inválida '{current_user_id_str}'")
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} intentando crear TimeBlock.")

    if not user:
        current_app.logger.warning(f"POST /time-blocks: Usuario del token no encontrado (ID: {current_user_id_int})")
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        current_app.logger.warning(f"POST /time-blocks: Usuario ID {user.user_id} no es proveedor (rol: {user.role})")
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden crear bloques de tiempo"}), 403
    if not user.provider_profile:
        current_app.logger.error(f"POST /time-blocks: Usuario proveedor (ID: {user.user_id}) no tiene un perfil.")
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 400

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se enviaron datos"}), 400

    start_datetime_str = data.get('start_datetime')
    end_datetime_str = data.get('end_datetime')
    is_available = data.get('is_available', False) # Default a False (no disponible) si no se especifica
    reason = data.get('reason')

    if not start_datetime_str or not end_datetime_str:
        return jsonify({"msg": "Faltan datos requeridos: start_datetime, end_datetime"}), 400
    
    if not isinstance(is_available, bool):
        return jsonify({"msg": "is_available debe ser un valor booleano (true/false)"}), 400

    try:
        # Intenta parsear las fechas. datetime.fromisoformat() maneja bien las zonas horarias si están en el string.
        # Si no tienen zona horaria, se asumen como "naive", lo cual podría ser problemático
        # si tu base de datos espera "aware" datetimes.
        # El modelo DateTime(timezone=True) espera datetimes "aware".
        # Es RECOMENDABLE que el frontend envíe los datetimes con información de zona horaria (ej. Z para UTC o +/-HH:MM)
        start_datetime_obj = datetime.fromisoformat(start_datetime_str)
        end_datetime_obj = datetime.fromisoformat(end_datetime_str)
    except ValueError:
        return jsonify({"msg": "Formato de start_datetime o end_datetime inválido. Usar formato ISO 8601 (ej. YYYY-MM-DDTHH:MM:SSZ o YYYY-MM-DDTHH:MM:SS+/-HH:MM)"}), 400

    # Validar que los datetimes sean "aware" (tengan zona horaria) si tu DB lo requiere
    # (DateTime(timezone=True) en el modelo lo sugiere)
    if start_datetime_obj.tzinfo is None or end_datetime_obj.tzinfo is None:
        # Podrías asumir UTC por defecto si son naive, o devolver un error.
        # Por ahora, devolvamos un error para forzar que el cliente envíe la info de timezone.
        # Alternativamente, podrías hacer:
        # from datetime import timezone
        # if start_datetime_obj.tzinfo is None: start_datetime_obj = start_datetime_obj.replace(tzinfo=timezone.utc)
        # if end_datetime_obj.tzinfo is None: end_datetime_obj = end_datetime_obj.replace(tzinfo=timezone.utc)
        current_app.logger.warning(f"POST /time-blocks: start_datetime o end_datetime recibidos sin información de zona horaria.")
        return jsonify({"msg": "start_datetime y end_datetime deben incluir información de zona horaria (ej. 'Z' para UTC o +/-HH:MM)."}), 400


    if start_datetime_obj >= end_datetime_obj:
        return jsonify({"msg": "start_datetime debe ser anterior a end_datetime"}), 400

    new_time_block = TimeBlock(
        provider_id=user.provider_profile.provider_id,
        start_datetime=start_datetime_obj,
        end_datetime=end_datetime_obj,
        is_available=is_available,
        reason=reason
    )

    try:
        db.session.add(new_time_block)
        db.session.commit()
        current_app.logger.info(f"Usuario ID {user.user_id} creó exitosamente TimeBlock ID {new_time_block.id}")
        return jsonify({"msg": "Bloque de tiempo creado exitosamente", "time_block": new_time_block.to_dict()}), 201
    except ValueError as ve: # Capturar ValueErrors de los validadores del modelo
        db.session.rollback()
        current_app.logger.error(f"Error de validación al crear TimeBlock: {ve}")
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear TimeBlock: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno al crear el bloque de tiempo", "error_details": str(e)}), 500

# --- Aquí seguirían los otros endpoints para TimeBlock (GET, PUT, DELETE) ---


@bp_api.route('/time-blocks', methods=['GET'])
@jwt_required()
def get_time_blocks():
    """
    GET /time-blocks
    =================

    🔐 Ruta protegida que permite a un proveedor autenticado obtener la lista de sus bloques de tiempo
    (disponibles o no disponibles).

    Esta información es útil para visualizar y gestionar la disponibilidad puntual definida por el proveedor.

    Requisitos:
    -----------
    - Usuario autenticado mediante JWT.
    - Usuario con rol "provider".
    - El proveedor debe tener un perfil creado.

    Parámetros opcionales (query string):
    -------------------------------------
    (Nota: actualmente comentados en el código, pero listos para habilitar)
    - `start_date`: Filtra bloques cuyo `start_datetime` sea igual o posterior a la fecha dada (formato YYYY-MM-DD).
    - `end_date`: Filtra bloques cuyo `end_datetime` sea anterior a la fecha dada (formato YYYY-MM-DD).

    Respuesta:
    ----------
    ✅ 200 OK:
        [
            {
                "id": 1,
                "provider_id": 2,
                "start_datetime": "2025-06-01T09:00:00+02:00",
                "end_datetime": "2025-06-01T11:00:00+02:00",
                "is_available": false,
                "reason": "Vacaciones"
            },
            ...
        ]

    ⚠️ 400 Bad Request:
        - (Si se habilitan los filtros por fecha y están mal formateados).

    ⚠️ 403 Forbidden:
        - El usuario autenticado no es proveedor.

    ⚠️ 404 Not Found:
        - El usuario autenticado no tiene perfil de proveedor.

    ❌ 422 Unprocessable Entity:
        - El token JWT es inválido.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} solicitando sus TimeBlocks.")

    if not user:
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden ver sus bloques de tiempo"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 400

    # Opcional: Añadir filtros por fecha si se desea
    # start_date_filter_str = request.args.get('start_date') # ej. YYYY-MM-DD
    # end_date_filter_str = request.args.get('end_date')     # ej. YYYY-MM-DD
    
    query = user.provider_profile.time_blocks # Esto es un BaseQuery (lazy='dynamic')

    # Ejemplo de cómo podrías filtrar (necesitarías parsear las fechas y manejar errores)
    # if start_date_filter_str:
    #     try:
    #         start_filter = datetime.strptime(start_date_filter_str, '%Y-%m-%d').date()
    #         # Ajustar para que el filtro incluya todo el día o comparar con la parte de fecha de start_datetime
    #         # Por simplicidad, aquí podríamos filtrar si el start_datetime del bloque es >= start_filter
    #         query = query.filter(TimeBlock.start_datetime >= datetime.combine(start_filter, datetime.min.time()))
    #     except ValueError:
    #         return jsonify({"msg": "Formato de start_date inválido, usar YYYY-MM-DD"}), 400
    # if end_date_filter_str:
    #     try:
    #         end_filter = datetime.strptime(end_date_filter_str, '%Y-%m-%d').date()
    #         # Ajustar para que el filtro incluya todo el día o comparar con la parte de fecha de end_datetime
    #         # Por simplicidad, aquí podríamos filtrar si el end_datetime del bloque es <= end_filter + 1 día (para incluir todo el día)
    #         from datetime import timedelta
    #         query = query.filter(TimeBlock.end_datetime < datetime.combine(end_filter + timedelta(days=1), datetime.min.time()))
    #     except ValueError:
    #         return jsonify({"msg": "Formato de end_date inválido, usar YYYY-MM-DD"}), 400

    time_blocks_list = query.order_by(TimeBlock.start_datetime).all()
    
    return jsonify([block.to_dict() for block in time_blocks_list]), 200


@bp_api.route('/time-blocks/<int:block_id>', methods=['DELETE'])
@jwt_required()
def delete_time_block(block_id):
    """
    DELETE /time-blocks/<block_id>
    ==============================

    🔐 Ruta protegida que permite a un proveedor autenticado eliminar uno de sus bloques de tiempo personalizados.

    Esta operación se utiliza para eliminar bloques de disponibilidad o no disponibilidad previamente definidos
    (por ejemplo, cancelación de vacaciones o cambios en la agenda).

    Requisitos:
    -----------
    - Usuario autenticado mediante JWT.
    - Usuario con rol "provider".
    - El proveedor debe tener un perfil asociado.
    - El bloque debe existir y pertenecer al proveedor autenticado.

    Parámetros de ruta:
    -------------------
    - `block_id` (int): ID del bloque de tiempo a eliminar.

    Respuestas:
    -----------
    ✅ 200 OK:
        {
            "msg": "Bloque de tiempo eliminado exitosamente"
        }

    ⚠️ 403 Forbidden:
        - El usuario no es proveedor.
        - El bloque no pertenece al proveedor autenticado.

    ⚠️ 404 Not Found:
        - Usuario no encontrado.
        - Perfil de proveedor no encontrado.
        - Bloque de tiempo con `block_id` no existe.

    ❌ 422 Unprocessable Entity:
        - El token JWT contiene una identidad inválida.

    ❌ 500 Internal Server Error:
        - Error inesperado durante la eliminación en base de datos.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} intentando borrar TimeBlock ID {block_id}")

    if not user:
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden eliminar bloques de tiempo"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado"}), 400

    time_block = TimeBlock.query.get(block_id)
    if not time_block:
        return jsonify({"msg": "Bloque de tiempo no encontrado para eliminar"}), 404
    
    if time_block.provider_id != user.provider_profile.provider_id:
        return jsonify({"msg": "Acceso denegado: no puede eliminar un bloque de tiempo que no le pertenece"}), 403

    try:
        db.session.delete(time_block)
        db.session.commit()
        current_app.logger.info(f"Usuario ID {user.user_id} eliminó exitosamente TimeBlock ID {block_id}")
        return jsonify({"msg": "Bloque de tiempo eliminado exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al eliminar TimeBlock ID {block_id}: {e}")
        return jsonify({"msg": "Error interno al eliminar el bloque de tiempo", "error_details": str(e)}), 500
    
 
@bp_api.route('/time-blocks/<int:block_id>', methods=['PUT'])
@jwt_required()
def update_time_block(block_id):
    """
    PUT /time-blocks/<block_id>
    ============================

    🔐 Ruta protegida que permite a un proveedor autenticado actualizar uno de sus bloques de tiempo personalizados.

    Los bloques de tiempo permiten definir intervalos específicos de disponibilidad o no disponibilidad. 
    Este endpoint permite actualizar campos como el inicio, fin, si está disponible y el motivo del bloqueo.

    Requisitos:
    -----------
    - Usuario autenticado mediante JWT.
    - Usuario con rol "provider".
    - El bloque debe existir y pertenecer al proveedor autenticado.

    Parámetros de ruta:
    -------------------
    - `block_id` (int): ID del bloque de tiempo a actualizar.

    Cuerpo de la solicitud (JSON):
    ------------------------------
    - `start_datetime` (str, opcional): Fecha y hora de inicio en formato ISO 8601 (con zona horaria).
    - `end_datetime` (str, opcional): Fecha y hora de fin en formato ISO 8601 (con zona horaria).
    - `is_available` (bool, opcional): Si el bloque indica disponibilidad o no.
    - `reason` (str | null, opcional): Razón del bloqueo, puede ser `null`.

    Reglas de validación:
    ---------------------
    - `start_datetime` debe ser anterior a `end_datetime`.
    - Ambos deben incluir zona horaria.
    - `is_available` debe ser booleano.

    Respuestas:
    -----------
    ✅ 200 OK:
        - Cuando el bloque se actualiza exitosamente.
        - Cuando los datos enviados no modifican el bloque (sin cambios efectivos).

    ⚠️ 400 Bad Request:
        - Datos inválidos (ej. fechas mal formateadas, zonas horarias faltantes, etc.).
        - No se proporcionaron campos válidos para actualizar.

    ⚠️ 403 Forbidden:
        - El usuario no es proveedor o el bloque no le pertenece.

    ⚠️ 404 Not Found:
        - Usuario, perfil o bloque no encontrado.

    ❌ 422 Unprocessable Entity:
        - Token inválido (identidad no es un entero).

    ❌ 500 Internal Server Error:
        - Fallo inesperado durante la actualización.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} intentando actualizar TimeBlock ID {block_id}")

    if not user:
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden actualizar bloques de tiempo"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado"}), 400

    time_block = TimeBlock.query.get(block_id)
    if not time_block:
        return jsonify({"msg": "Bloque de tiempo no encontrado para actualizar"}), 404
    
    if time_block.provider_id != user.provider_profile.provider_id:
        return jsonify({"msg": "Acceso denegado: no puede actualizar un bloque que no le pertenece"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se enviaron datos para actualizar"}), 400

    final_start_datetime = time_block.start_datetime
    final_end_datetime = time_block.end_datetime
    updated_fields_count = 0

    if 'start_datetime' in data:
        try:
            dt_obj = datetime.fromisoformat(data['start_datetime'])
            if dt_obj.tzinfo is None: # Forzar zona horaria si es naive
                return jsonify({"msg": "start_datetime debe incluir información de zona horaria."}), 400
            final_start_datetime = dt_obj
            updated_fields_count += 1
        except ValueError:
            return jsonify({"msg": "Formato de start_datetime inválido."}), 400
            
    if 'end_datetime' in data:
        try:
            dt_obj = datetime.fromisoformat(data['end_datetime'])
            if dt_obj.tzinfo is None: # Forzar zona horaria si es naive
                return jsonify({"msg": "end_datetime debe incluir información de zona horaria."}), 400
            final_end_datetime = dt_obj
            updated_fields_count += 1
        except ValueError:
            return jsonify({"msg": "Formato de end_datetime inválido."}), 400

    if final_start_datetime >= final_end_datetime:
        return jsonify({"msg": "start_datetime debe ser anterior a end_datetime"}), 400

    # Asignar y dejar que los validadores del modelo actúen
    time_block.start_datetime = final_start_datetime
    time_block.end_datetime = final_end_datetime

    if 'is_available' in data:
        if not isinstance(data['is_available'], bool):
            return jsonify({"msg": "is_available debe ser un valor booleano"}), 400
        time_block.is_available = data['is_available']
        updated_fields_count += 1
    
    if 'reason' in data: # Permite establecer reason a None/null o a un string
        time_block.reason = data['reason']
        updated_fields_count += 1
    
    if not updated_fields_count and data:
         return jsonify({"msg": "No se proporcionaron campos válidos para actualizar."}), 400
    if not db.session.is_modified(time_block) and updated_fields_count > 0:
        return jsonify({"msg": "Los datos proporcionados no modifican el bloque de tiempo actual.", "time_block": time_block.to_dict()}), 200

    try:
        db.session.commit()
        current_app.logger.info(f"Usuario ID {user.user_id} actualizó exitosamente TimeBlock ID {block_id}")
        return jsonify({"msg": "Bloque de tiempo actualizado exitosamente", "time_block": time_block.to_dict()}), 200
    except ValueError as ve:
        db.session.rollback()
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al actualizar TimeBlock ID {block_id}: {e}")
        return jsonify({"msg": "Error interno al actualizar el bloque de tiempo", "error_details": str(e)}), 500

# --- Siguiente: Endpoint "mágico" de disponibilidad y luego Appointments ---   

@bp_api.route('/providers/<int:provider_id>/available-slots', methods=['GET'])
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

@bp_api.route('/appointments', methods=['POST'])
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
    
    # --- FIN DE CREAR Y GUARDAR LA NUEVA CITA ---

@bp_api.route('/appointments', methods=['GET'])
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


@bp_api.route('/appointments/<int:appointment_id>/cancel', methods=['PUT'])
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