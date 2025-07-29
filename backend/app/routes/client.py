# backend/app/routes/client.py
"""
Define las rutas para la gestión del perfil del cliente.
"""
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User

# Creamos un nuevo Blueprint para las rutas del cliente.
client_bp = Blueprint('client', __name__)


@client_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_client_profile():
    """
    Obtiene el perfil del cliente autenticado.
    El token JWT contiene el user_id.
    """
    try:
        current_user_id = int(get_jwt_identity())
    except (ValueError, TypeError):
        return jsonify({"msg": "Identidad del token inválida"}), 422

    user = User.query.get(current_user_id)

    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    # Aunque esta ruta es para clientes, un proveedor también es un usuario.
    # No es necesario restringir por rol aquí, ya que solo devuelve datos del User.
    return jsonify(user.to_dict()), 200


@client_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_client_profile():
    """
    Actualiza el perfil del cliente (o cualquier usuario) autenticado.
    """
    try:
        current_user_id = int(get_jwt_identity())
    except (ValueError, TypeError):
        return jsonify({"msg": "Identidad del token inválida"}), 422
    
    user = User.query.get(current_user_id)

    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos (payload vacío)"}), 400

    # Campos del modelo User que permitimos editar desde el perfil
    editable_fields = ['first_name', 'last_name', 'phone_number', 'avatar_url']

    for field in editable_fields:
        if field in data:
            setattr(user, field, data.get(field))
    
    try:
        db.session.commit()
        current_app.logger.info(f"Perfil del usuario {user.user_id} actualizado exitosamente.")
        return jsonify(user.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al actualizar perfil del usuario {user.user_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al guardar los datos"}), 500