# backend/app/routes/client.py

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
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