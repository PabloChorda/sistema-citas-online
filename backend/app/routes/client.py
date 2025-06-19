# backend/app/routes/client.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User

client_bp = Blueprint('client', __name__)

@client_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_client_profile():
    """
    Ruta protegida para obtener el perfil de un cliente autenticado.
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    if user.role != 'client':
        return jsonify({"msg": "Acceso no autorizado. Se requiere rol de cliente."}), 403

    return jsonify(user.to_dict()), 200

@client_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_client_profile():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user or user.role != 'client':
        return jsonify({"msg": "No autorizado"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos"}), 400

    user.first_name = data.get('first_name', user.first_name)
    user.last_name = data.get('last_name', user.last_name)
    user.phone_number = data.get('phone_number', user.phone_number)

    try:
        db.session.commit()
        return jsonify(user.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error al actualizar perfil del cliente: {e}")
        return jsonify({"msg": "Error interno al guardar los datos"}), 500