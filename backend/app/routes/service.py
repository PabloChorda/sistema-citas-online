# backend/app/routes/service.py
"""
Define las rutas para la gestión de Servicios (CRUD).
Un Servicio siempre está asociado a un Establecimiento.
"""
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Service, Establishment, User

# Blueprint renombrado a singular para consistencia con 'provider_bp', 'client_bp', etc.
service_bp = Blueprint('service', __name__)

def get_provider_id_from_jwt():
    """Función helper para obtener y validar el ID del usuario desde el token JWT."""
    try:
        current_user_id_str = get_jwt_identity()
        return int(current_user_id_str)
    except (ValueError, TypeError):
        return None

@service_bp.route('/establishments/<int:establishment_id>/services', methods=['POST'])
@jwt_required()
def create_service(establishment_id):
    """
    POST /establishments/<establishment_id>/services
    -------------------------------------------------
    Crea un nuevo servicio para un establecimiento específico.

    🔐 Requiere autenticación JWT:
        - Solo usuarios con rol `provider` pueden acceder.
        - El usuario debe ser el propietario del establecimiento.

    📥 Parámetros URL:
        - establishment_id (int): ID del establecimiento al que se asociará el servicio.

    📥 Cuerpo JSON requerido:
        {
            "nombre": "Corte de cabello",
            "descripcion": "Servicio de peluquería profesional",
            "duracion_minutos": 30,
            "precio": "15.50",
            "categoria": "Peluquería",        // Opcional
            "is_active": true,                // Opcional, por defecto True
            "orden": 1                        // Opcional
        }

    📤 Respuesta exitosa (201):
        {
            "msg": "Servicio creado exitosamente!",
            "service": { ...datos del servicio... }
        }

    ❌ Errores posibles: 400, 401, 403, 404, 409, 422, 500.
    
    📚 Propósito:
        Permite a proveedores crear nuevos servicios dentro de uno de sus establecimientos
        para que los clientes los puedan reservar.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    user = User.query.get(provider_id)
    if not user or user.role != 'provider':
        return jsonify({"msg": "Acceso denegado. Se requiere rol de proveedor."}), 403

    establishment = Establishment.query.get(establishment_id)
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado"}), 404

    # *** Medida de Seguridad Clave ***
    if establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado. No eres el propietario de este establecimiento."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos (payload vacío)"}), 400

    required_fields = ['nombre', 'duracion_minutos', 'precio']
    if any(field not in data for field in required_fields):
        return jsonify({"msg": f"Faltan datos requeridos: {', '.join(required_fields)}"}), 400

    try:
        new_service = Service(
            establishment_id=establishment_id,
            nombre=data['nombre'],
            duracion_minutos=data['duracion_minutos'],
            precio=data['precio'],
            descripcion=data.get('descripcion'),
            categoria=data.get('categoria'),
            is_active=data.get('is_active', True),
            orden=data.get('orden'),
            requiere_confirmacion_manual=data.get('requiere_confirmacion_manual', False),
            limite_reservas_diarias=data.get('limite_reservas_diarias')
        )
        db.session.add(new_service)
        db.session.commit()
        current_app.logger.info(f"Servicio '{new_service.nombre}' creado para el establecimiento {establishment_id}.")
        return jsonify({"msg": "Servicio creado exitosamente!", "service": new_service.to_dict()}), 201
    except ValueError as e: # Captura errores de las validaciones del modelo
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear servicio para est. {establishment_id}: {e}", exc_info=True)
        if 'uix_establishment_nombre' in str(e).lower():
             return jsonify({"msg": "Ya existe un servicio con ese nombre en este establecimiento."}), 409
        return jsonify({"msg": "Error interno al crear el servicio"}), 500


@service_bp.route('/establishments/<int:establishment_id>/services', methods=['GET'])
@jwt_required()
def get_services_for_establishment(establishment_id):
    """
    GET /establishments/<establishment_id>/services
    -----------------------------------------------
    Obtiene la lista de servicios para un establecimiento específico.

    🔐 Requiere autenticación JWT:
        - Solo usuarios con rol `provider` pueden acceder.
        - El usuario debe ser el propietario del establecimiento.

    📤 Respuesta exitosa (200):
        [
            { "id": 1, "nombre": "Corte de cabello", ... },
            { "id": 2, "nombre": "Manicura", ... }
        ]

    ❌ Errores posibles: 401, 403, 404, 422.

    📚 Propósito:
        Permite al proveedor autenticado ver todos los servicios que ha registrado
        para un establecimiento concreto.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    # Hacemos la query más segura, filtrando por ID de establecimiento Y de proveedor
    establishment = Establishment.query.filter_by(id=establishment_id, provider_id=provider_id).first()
    if not establishment:
        # No revelamos si el establecimiento no existe o no pertenece al usuario.
        return jsonify({"msg": "Establecimiento no encontrado o acceso denegado."}), 404

    services = establishment.services.order_by(Service.orden, Service.nombre).all()
    return jsonify([service.to_dict() for service in services]), 200


@service_bp.route('/services/<int:service_id>', methods=['PUT'])
@jwt_required()
def update_service(service_id):
    """
    PUT /services/<service_id>
    --------------------------
    Actualiza un servicio existente.

    🔐 Requiere autenticación JWT:
        - Solo accesible para usuarios con rol `provider`.
        - El servicio debe pertenecer a un establecimiento del proveedor autenticado.

    📥 Parámetros:
        - service_id (int): ID del servicio a actualizar.
        - Body JSON opcional con los campos a modificar.

    📤 Respuesta exitosa (200):
        {
            "msg": "Servicio actualizado exitosamente",
            "service": { ...datos actualizados del servicio... }
        }

    ❌ Errores posibles: 400, 401, 403, 404, 409, 422, 500.

    📚 Propósito:
        Permite al proveedor modificar los datos de sus servicios desde la interfaz.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    service = Service.query.get(service_id)
    if not service:
        return jsonify({"msg": "Servicio no encontrado"}), 404

    # *** Medida de Seguridad Clave ***
    if service.establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado. No eres el propietario de este servicio."}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos (payload vacío)"}), 400
        
    editable_fields = [
        'nombre', 'descripcion', 'duracion_minutos', 'precio', 'categoria',
        'is_active', 'orden', 'requiere_confirmacion_manual', 'limite_reservas_diarias'
    ]

    for field in editable_fields:
        if field in data:
            setattr(service, field, data[field])
    
    try:
        db.session.commit()
        current_app.logger.info(f"Servicio {service_id} actualizado exitosamente.")
        return jsonify({"msg": "Servicio actualizado exitosamente", "service": service.to_dict()}), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al actualizar servicio {service_id}: {e}", exc_info=True)
        if 'uix_establishment_nombre' in str(e).lower():
             return jsonify({"msg": "Ya existe un servicio con ese nombre en este establecimiento."}), 409
        return jsonify({"msg": "Error interno al guardar los datos"}), 500


@service_bp.route('/services/<int:service_id>', methods=['DELETE'])
@jwt_required()
def delete_service(service_id):
    """
    DELETE /services/<service_id>
    -----------------------------
    Elimina un servicio.

    🔐 Requiere autenticación JWT:
        - Solo accesible para usuarios con rol `provider`.
        - El servicio debe pertenecer a un establecimiento del proveedor autenticado.

    📥 Parámetros:
        - service_id (int): ID del servicio a eliminar.

    📤 Respuesta exitosa (200):
        { "msg": "Servicio eliminado correctamente" }

    ❌ Errores posibles: 401, 403, 404, 422, 500.

    📚 Propósito:
        Permite a un proveedor eliminar un servicio que ya no ofrece.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    service = Service.query.get(service_id)
    if not service:
        # Para no revelar información, damos una respuesta genérica.
        return jsonify({"msg": "Operación no permitida."}), 404

    # *** Medida de Seguridad Clave ***
    if service.establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado."}), 403

    try:
        db.session.delete(service)
        db.session.commit()
        current_app.logger.info(f"Servicio {service_id} eliminado exitosamente.")
        return jsonify({"msg": "Servicio eliminado correctamente"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al eliminar servicio {service_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al eliminar el servicio"}), 500