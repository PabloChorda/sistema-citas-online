# backend/app/routes.py
from flask import Blueprint, jsonify, request, current_app
from . import db
from .models import User, Provider, Service, AvailabilityRule, TimeBlock, Appointment # Todos los modelos necesarios
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt # Importado para posible logging futuro, no usado activamente ahora
)
from datetime import date, datetime, time, timedelta, timezone # Para convertir strings a objetos time

bp_api = Blueprint('api', __name__)

VALID_DAYS_OF_WEEK = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']


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

# --- Ruta Protegida de Ejemplo ---
@bp_api.route('/protected', methods=['GET'])
@jwt_required()
def protected_route_example():
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

# --- Endpoints CRUD para Servicios ---
@bp_api.route('/services', methods=['POST'])
@jwt_required()
def create_service():
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
    if not data: return jsonify({"msg": "No se enviaron datos"}), 400

    # <<< CAMBIO AQUÍ: Renombrar la variable para claridad >>>
    day_of_week_from_request = data.get('day_of_week') 
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')

    # <<< CAMBIO AQUÍ: Validar que los campos requeridos no sean None >>>
    if day_of_week_from_request is None or start_time_str is None or end_time_str is None:
        return jsonify({"msg": "Faltan datos requeridos: day_of_week, start_time, end_time"}), 400
    
    # <<< CAMBIO AQUÍ: Modificar la validación para day_of_week >>>
    if not isinstance(day_of_week_from_request, str) or day_of_week_from_request.upper() not in VALID_DAYS_OF_WEEK:
        return jsonify({"msg": f"day_of_week debe ser uno de los siguientes valores: {', '.join(VALID_DAYS_OF_WEEK)}"}), 400
    
    day_of_week_for_db = day_of_week_from_request.upper() # Usar el string en mayúsculas

    try:
        start_time_obj = time.fromisoformat(start_time_str)
        end_time_obj = time.fromisoformat(end_time_str)
    except ValueError:
        return jsonify({"msg": "Formato de start_time o end_time inválido. Usar HH:MM o HH:MM:SS"}), 400

    if start_time_obj >= end_time_obj:
        return jsonify({"msg": "start_time debe ser anterior a end_time"}), 400

    new_rule = AvailabilityRule(
        provider_id=user.provider_profile.provider_id,
        day_of_week=day_of_week_for_db, # <<< CAMBIO AQUÍ: Usar la variable con el string validado >>>
        start_time=start_time_obj,
        end_time=end_time_obj
    )
    try:
        db.session.add(new_rule)
        db.session.commit()
        return jsonify({"msg": "Regla de disponibilidad creada exitosamente", "rule": new_rule.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear regla de disponibilidad: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno al crear la regla de disponibilidad", "error_details": str(e)}), 500

@bp_api.route('/availability-rules', methods=['GET'])
@jwt_required()
def get_availability_rules():
    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)

    if not user or user.role != 'provider':
        return jsonify({"msg": "Acceso denegado"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado"}), 404

    rules = user.provider_profile.availability_rules.order_by(AvailabilityRule.day_of_week, AvailabilityRule.start_time).all()
    return jsonify([rule.to_dict() for rule in rules]), 200

# El endpoint DELETE que ya habías añadido (está correcto):
@bp_api.route('/availability-rules/<int:rule_id>', methods=['DELETE'])
@jwt_required()
def delete_availability_rule(rule_id):
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
# SG: Este endpoint es para clientes, ¿debería requerir autenticación de cliente?
# Por ahora lo dejaremos abierto, pero es algo a considerar.
# Si se requiere autenticación de cliente, añadir @jwt_required() y obtener el cliente.
def get_available_slots(provider_id):
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

    if start_date_obj < date.today(): # SG: No permitir buscar slots en el pasado
         return jsonify({"msg": "La fecha de inicio (start_date) no puede ser en el pasado."}), 400
    if start_date_obj > end_date_obj:
        return jsonify({"msg": "start_date no puede ser posterior a end_date"}), 400
    
    # SG: Limitar el rango de búsqueda para evitar consultas muy largas (ej. max 30-60 días)
    if (end_date_obj - start_date_obj).days > 60: # Ejemplo: máximo 60 días de rango
        return jsonify({"msg": "El rango de fechas solicitado es demasiado amplio (máximo 60 días)."}), 400


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
    provider_timezone_str = provider.timezone # Ej. "Europe/Madrid", "America/New_York", o "UTC"

    service_duration = timedelta(minutes=service.duration_minutes)

    provider_timezone_str = provider.timezone
    provider_tz = None # Inicializar la variable para el objeto tzinfo

    if not provider_timezone_str: # SG: Si el proveedor no tiene timezone configurada
        current_app.logger.error(f"El proveedor {provider_id} no tiene una zona horaria configurada.")
        return jsonify({"msg": "La zona horaria del proveedor no está configurada."}), 500

    try:
        # Intentar con zoneinfo (Python 3.9+) - Preferido
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            provider_tz = ZoneInfo(provider_timezone_str)
            current_app.logger.info(f"Zona horaria obtenida para {provider_timezone_str} usando zoneinfo.")
        except ZoneInfoNotFoundError:
            current_app.logger.warning(f"ZoneInfo no pudo encontrar la zona horaria: '{provider_timezone_str}'. Intentando con pytz si está disponible.")
            provider_tz = None # Marcar para intentar con pytz
        except Exception as e_zi: # Capturar otros posibles errores de ZoneInfo
            current_app.logger.error(f"Error inesperado con ZoneInfo para '{provider_timezone_str}': {e_zi}")
            provider_tz = None

    except ImportError: # zoneinfo no disponible (Python < 3.9)
        current_app.logger.info("Módulo zoneinfo no disponible, intentando con pytz.")
        provider_tz = None # Marcar para intentar con pytz

    if provider_tz is None: # Si zoneinfo falló o no estaba disponible, intentar con pytz
        try:
            import pytz # Asegúrate de tener pytz instalado: pip install pytz
            provider_tz = pytz.timezone(provider_timezone_str)
            current_app.logger.info(f"Zona horaria obtenida para {provider_timezone_str} usando pytz.")
        except ImportError:
            current_app.logger.error("Librería pytz no instalada y zoneinfo no disponible. Se necesita una para el manejo de zonas horarias IANA.")
            # Como último recurso MUY BÁSICO, si la string es "UTC"
            if provider_timezone_str.upper() == 'UTC':
                provider_tz = timezone.utc
                current_app.logger.warning("Usando datetime.timezone.utc como fallback para 'UTC' debido a falta de librerías completas.")
            else:
                # No podemos manejar zonas IANA sin una librería adecuada.
                return jsonify({"msg": "Error de configuración del servidor: no se puede procesar la zona horaria del proveedor."}), 500
        except pytz.UnknownTimeZoneError:
            current_app.logger.error(f"Zona horaria desconocida '{provider_timezone_str}' para el proveedor {provider_id} usando pytz.")
            # Podrías decidir usar UTC como fallback con una advertencia, o fallar. Fallar es más seguro.
            return jsonify({"msg": f"La zona horaria '{provider_timezone_str}' del proveedor es inválida o no reconocida."}), 500
        except Exception as e_pytz: # Capturar otros posibles errores de pytz
            current_app.logger.error(f"Error inesperado con pytz para '{provider_timezone_str}': {e_pytz}")
            return jsonify({"msg": "Error al procesar la zona horaria del proveedor."}), 500
    
    # A este punto, provider_tz debería ser un objeto tzinfo válido o la función ya habría retornado un error.
    current_app.logger.info(f"Proveedor: {provider.business_name} (ID: {provider.provider_id}), Servicio: {service.name} (ID: {service.id}), Duración: {service_duration}, Timezone Proveedor (str): {provider_timezone_str}, Timezone Proveedor (obj resultante): {provider_tz}")

    # 4. Obtener Reglas de Disponibilidad, Bloqueos y Citas Existentes
    #    (Dentro del rango de fechas solicitado, ajustado para la zona horaria del proveedor)

    # TODO: Lógica para convertir start_date_obj y end_date_obj a datetimes en la zona horaria del proveedor
    #       para filtrar AvailabilityRule, TimeBlock y Appointment correctamente.


    all_available_slots = [] 
    current_date_iter = start_date_obj # Renombrar para evitar confusión con la variable del bucle
    
    # Mapeo de Python weekday() (Lunes=0 a Domingo=6) a los strings de tu ENUM
    # Asegúrate que estos strings coincidan EXACTAMENTE con tu ENUM
    python_weekday_to_enum_str = {
        0: 'LUNES', 1: 'MARTES', 2: 'MIERCOLES', 3: 'JUEVES', 
        4: 'VIERNES', 5: 'SABADO', 6: 'DOMINGO'
    }

    while current_date_iter <= end_date_obj:
        day_of_week_int = current_date_iter.weekday() 
        day_of_week_enum_value = python_weekday_to_enum_str.get(day_of_week_int)
        
        current_app.logger.debug(f"Procesando día: {current_date_iter}, DOW_int: {day_of_week_int}, DOW_enum: {day_of_week_enum_value}")

        # A. Obtener bloques base de AvailabilityRule para current_date_iter
        base_availability_intervals_for_day = []
        if day_of_week_enum_value: # Si el día es válido en nuestro mapeo
            # Filtrar reglas por provider_id Y el valor string del enum del día de la semana
            rules_for_day = AvailabilityRule.query.filter_by(
                provider_id=provider.provider_id,
                day_of_week=day_of_week_enum_value # Aquí se usa el valor string del ENUM
            ).all()

            current_app.logger.debug(f"Día {current_date_iter} ({day_of_week_enum_value}): {len(rules_for_day)} reglas encontradas.")

            for rule in rules_for_day:
                # Combinar la fecha actual con la hora de inicio/fin de la regla
                # y hacerlo "aware" con la zona horaria del proveedor
                start_dt_naive = datetime.combine(current_date_iter, rule.start_time)
                end_dt_naive = datetime.combine(current_date_iter, rule.end_time)
                
                # Hacerlos "aware" usando la zona horaria del proveedor
                start_dt_aware = provider_tz.localize(start_dt_naive) if hasattr(provider_tz, 'localize') else start_dt_naive.replace(tzinfo=provider_tz)
                end_dt_aware = provider_tz.localize(end_dt_naive) if hasattr(provider_tz, 'localize') else end_dt_naive.replace(tzinfo=provider_tz)
                
                # SG: Es buena práctica convertir todo a UTC para cálculos internos y comparaciones
                start_dt_utc = start_dt_aware.astimezone(timezone.utc)
                end_dt_utc = end_dt_aware.astimezone(timezone.utc)
                
                base_availability_intervals_for_day.append({'start': start_dt_utc, 'end': end_dt_utc})
                current_app.logger.debug(f"  Regla ID {rule.id}: {rule.start_time}-{rule.end_time} (Local TZ) -> UTC: {start_dt_utc} - {end_dt_utc}")
        
        # B. Aplicar TimeBlocks (excepciones) para current_date_iter
        # Primero, obtenemos los TimeBlocks relevantes para el día actual del proveedor
        # Un TimeBlock es relevante si su rango se solapa con el día actual.
        # current_date_iter es un objeto date. Necesitamos rangos datetime para el día.
        
        # Inicio del día actual en la zona horaria del proveedor
        day_start_naive = datetime.combine(current_date_iter, datetime.min.time())
        day_start_aware_provider_tz = provider_tz.localize(day_start_naive) if hasattr(provider_tz, 'localize') else day_start_naive.replace(tzinfo=provider_tz)
        day_start_utc = day_start_aware_provider_tz.astimezone(timezone.utc)

        # Fin del día actual (inicio del día siguiente) en la zona horaria del proveedor
        day_end_naive = datetime.combine(current_date_iter + timedelta(days=1), datetime.min.time())
        day_end_aware_provider_tz = provider_tz.localize(day_end_naive) if hasattr(provider_tz, 'localize') else day_end_naive.replace(tzinfo=provider_tz)
        day_end_utc = day_end_aware_provider_tz.astimezone(timezone.utc)

        # Obtener TimeBlocks que se solapan con el día actual
        # Un TimeBlock (tb_start, tb_end) se solapa con el día (day_start_utc, day_end_utc) si:
        # tb_start < day_end_utc AND tb_end > day_start_utc
        provider_time_blocks_for_day = TimeBlock.query.filter(
            TimeBlock.provider_id == provider.provider_id,
            TimeBlock.start_datetime < day_end_utc, # El bloqueo comienza antes de que termine el día
            TimeBlock.end_datetime > day_start_utc  # El bloqueo termina después de que comience el día
        ).all()

        current_app.logger.debug(f"  Día {current_date_iter}: {len(provider_time_blocks_for_day)} TimeBlocks encontrados que se solapan con el día.")

        # Inicializar los intervalos procesados con los intervalos base
        processed_intervals_for_day = list(base_availability_intervals_for_day) # Copiar la lista

        # Aplicar TimeBlocks que son is_available=False (bloqueos)
        for tb in provider_time_blocks_for_day:
            if not tb.is_available: # Es un bloqueo de "no disponible"
                current_app.logger.debug(f"    Aplicando TimeBlock de NO disponibilidad ID {tb.id}: {tb.start_datetime} - {tb.end_datetime}")
                
                # Necesitamos restar este tb (que ya está en UTC si se guardó correctamente)
                # de cada intervalo en processed_intervals_for_day
                tb_start_utc = tb.start_datetime # Asumiendo que ya está en UTC o con tzinfo correcto
                tb_end_utc = tb.end_datetime   # Asumiendo que ya está en UTC

                next_processed_intervals = []
                for interval in processed_intervals_for_day:
                    # Lógica para restar tb_start_utc, tb_end_utc del interval['start'], interval['end']
                    # Esto puede resultar en 0, 1 o 2 nuevos intervalos.
                    
                    # Caso 1: El bloqueo no se solapa con el intervalo -> el intervalo se mantiene
                    if tb_end_utc <= interval['start'] or tb_start_utc >= interval['end']:
                        next_processed_intervals.append(interval)
                        continue

                    # Caso 2: El bloqueo cubre parte del inicio del intervalo
                    # [tb_start --- tb_end]
                    #          [interval_start --- interval_end]
                    # Resultado: [tb_end --- interval_end]
                    if tb_start_utc <= interval['start'] < tb_end_utc < interval['end']:
                        new_interval_start = tb_end_utc
                        if new_interval_start < interval['end']: # Asegurar que el nuevo intervalo es válido
                             next_processed_intervals.append({'start': new_interval_start, 'end': interval['end']})
                    
                    # Caso 3: El bloqueo cubre parte del final del intervalo
                    #          [tb_start --- tb_end]
                    # [interval_start --- interval_end]
                    # Resultado: [interval_start --- tb_start]
                    elif interval['start'] < tb_start_utc < interval['end'] <= tb_end_utc:
                        new_interval_end = tb_start_utc
                        if interval['start'] < new_interval_end: # Asegurar que el nuevo intervalo es válido
                            next_processed_intervals.append({'start': interval['start'], 'end': new_interval_end})

                    # Caso 4: El bloqueo está completamente dentro del intervalo (lo divide en dos)
                    #    [tb_start --- tb_end]
                    # [interval_start --------- interval_end]
                    # Resultado: [interval_start --- tb_start] Y [tb_end --- interval_end]
                    elif interval['start'] < tb_start_utc and tb_end_utc < interval['end']:
                        # Primer trozo
                        if interval['start'] < tb_start_utc:
                            next_processed_intervals.append({'start': interval['start'], 'end': tb_start_utc})
                        # Segundo trozo
                        if tb_end_utc < interval['end']:
                            next_processed_intervals.append({'start': tb_end_utc, 'end': interval['end']})
                    
                    # Caso 5: El bloqueo cubre completamente el intervalo -> el intervalo se elimina
                    # [tb_start ------------- tb_end]
                    #    [interval_start --- interval_end]
                    # Resultado: Nada (no se añade a next_processed_intervals)
                    elif tb_start_utc <= interval['start'] and tb_end_utc >= interval['end']:
                        pass # No se añade el intervalo

                    # Caso 6: El intervalo está completamente dentro del bloqueo (similar al caso 5)
                    #    [tb_start --- tb_end]
                    # [interval_start --------- interval_end]
                    # Es el mismo que el caso 5 si se interpretan los límites correctamente
                    
                    else:
                        # Podría haber otros casos o una forma más genérica de manejar esto.
                        # Por ahora, si no cae en los anteriores, mantenemos el intervalo original
                        # (esto debería revisarse para asegurar que todos los solapamientos se manejan)
                        # current_app.logger.warning(f"      Caso de solapamiento no manejado explícitamente entre intervalo {interval} y bloqueo {tb_start_utc}-{tb_end_utc}")
                        next_processed_intervals.append(interval) # Fallback, revisar esta lógica

                processed_intervals_for_day = next_processed_intervals # Actualizar la lista para el siguiente bloqueo

        # TODO: Aplicar TimeBlocks que son is_available=True (disponibilidad extra)
        # Esto implicaría añadir estos bloques y luego fusionar intervalos solapados.
        # Por ahora, nos centramos en los bloqueos.

        # C. TODO: Restar Appointments existentes para current_date_iter
        
        # D. TODO: Generar slots de la duración del servicio a partir de los intervalos finales
        
        # Actualizar la salida temporal para ver los intervalos después de aplicar bloqueos
        for interval in processed_intervals_for_day: # Usar los intervalos procesados
             all_available_slots.append({
                 "start_datetime": interval['start'].isoformat(),
                 "end_datetime": interval['end'].isoformat(),
                 "comment": "Intervalo después de aplicar TimeBlocks (is_available=False)"
             })

        current_date_iter += timedelta(days=1)
    
    return jsonify(all_available_slots), 200

# SG: Necesitaremos una función helper o lógica compleja aquí dentro
# def calculate_slots_for_day(target_date, day_of_week_int, provider_obj, service_duration_td, provider_tz_obj):
#     # ... (lógica detallada) ...
#     return []