# backend/app/routes/services.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from ..models import User, Service

bp = Blueprint('services', __name__)

@bp.route('', methods=['POST'])
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

@bp.route('', methods=['GET'])
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

@bp.route('/<int:service_id>', methods=['GET'])
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

@bp.route('/<int:service_id>', methods=['PUT'])
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

@bp.route('/<int:service_id>', methods=['DELETE'])
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