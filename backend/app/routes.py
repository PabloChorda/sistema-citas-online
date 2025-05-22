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
from datetime import time as dt_time # Para convertir strings a objetos time

bp_api = Blueprint('api', __name__)

# --- Ruta de prueba ---
@bp_api.route('/test-db', methods=['GET']) # Añadido methods=['GET'] por claridad, aunque es el default
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
    if not user.provider_profile: # Aunque si es proveedor, debería tenerlo.
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

    day_of_week = data.get('day_of_week')
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')

    if day_of_week is None or start_time_str is None or end_time_str is None:
        return jsonify({"msg": "Faltan datos requeridos: day_of_week, start_time, end_time"}), 400
    if not isinstance(day_of_week, int) or not (0 <= day_of_week <= 6):
        return jsonify({"msg": "day_of_week debe ser un entero entre 0 (Lunes) y 6 (Domingo)"}), 400

    try:
        start_time_obj = dt_time.fromisoformat(start_time_str)
        end_time_obj = dt_time.fromisoformat(end_time_str)
    except ValueError:
        return jsonify({"msg": "Formato de start_time o end_time inválido. Usar HH:MM o HH:MM:SS"}), 400

    if start_time_obj >= end_time_obj:
        return jsonify({"msg": "start_time debe ser anterior a end_time"}), 400

    new_rule = AvailabilityRule(
        provider_id=user.provider_profile.provider_id,
        day_of_week=day_of_week,
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

# --- Aquí añadirías PUT y DELETE para /availability-rules/{rule_id} ---
# --- Y luego los endpoints para TimeBlock y Appointment ---