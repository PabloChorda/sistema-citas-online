# backend/app/routes/provider.py
"""
Define las rutas para la gestión del perfil del proveedor.
"""
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User, Provider  # Gracias a la modularización, esto sigue funcionando

# Creamos un nuevo Blueprint para las rutas del proveedor.
provider_bp = Blueprint('provider', __name__)


@provider_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_provider_profile():
    """
    Obtiene el perfil completo del proveedor autenticado.
    El token JWT contiene el user_id.
    """
    try:
        current_user_id_str = get_jwt_identity()
        current_user_id = int(current_user_id_str)
    except (ValueError, TypeError):
        return jsonify({"msg": "Identidad del token inválida"}), 422

    user = User.query.get(current_user_id)

    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    if user.role != 'provider':
        return jsonify({"msg": "Acceso denegado. Se requiere rol de proveedor."}), 403

    provider_profile = user.provider_profile
    
    if not provider_profile:
        # Esto podría pasar si hay una inconsistencia en los datos
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario."}), 404
        
    return jsonify(provider_profile.to_dict()), 200


@provider_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_provider_profile():
    """
    Actualiza el perfil del proveedor autenticado.
    """
    try:
        current_user_id_str = get_jwt_identity()
        current_user_id = int(current_user_id_str)
    except (ValueError, TypeError):
        return jsonify({"msg": "Identidad del token inválida"}), 422
    
    provider_profile = Provider.query.get(current_user_id)

    if not provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos (payload vacío)"}), 400

    # Lista de campos que se pueden editar desde esta ruta
    editable_fields = [
        'nombre_comercial', 'telefono_contacto', 'email_contacto', 'web', 'bio',
        'imagen_perfil_url', 'timezone', 'idiomas_hablados'
    ]

    for field in editable_fields:
        if field in data:
            setattr(provider_profile, field, data[field])
    
    try:
        db.session.commit()
        current_app.logger.info(f"Perfil del proveedor {provider_profile.provider_id} actualizado exitosamente.")
        return jsonify(provider_profile.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al actualizar perfil del proveedor {provider_profile.provider_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al guardar los datos"}), 500