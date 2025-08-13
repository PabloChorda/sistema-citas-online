# backend/app/routes/client.py
"""
Define las rutas para la gestión del perfil del cliente.
"""
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError

from app import db
from app.models import User
from app.utils.tokens import generate_validation_token
from app.routes.email_service import send_account_validation_email
from app.utils.phones import normalize_e164

# Nota: este blueprint se registra bajo /client desde app.routes.__init__
client_bp = Blueprint('client', __name__)


@client_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_client_profile():
    """
    Obtiene el perfil del usuario autenticado (cliente o no).
    """
    try:
        current_user_id = int(get_jwt_identity())
    except (ValueError, TypeError):
        return jsonify({"msg": "Identidad del token inválida"}), 422

    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    return jsonify(user.to_dict()), 200


@client_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_client_profile():
    """
    Actualiza el perfil del usuario autenticado.
    - first_name, last_name, avatar_url: texto libre (si vienen no vacíos)
    - email: editable; si cambia => email_verified=False y se envía email de validación
    - phone_number: normalizado a E.164; UNIQUE; si cambia => phone_verified_at = None
    """
    try:
        current_user_id = int(get_jwt_identity())
    except (ValueError, TypeError):
        return jsonify({"msg": "Identidad del token inválida"}), 422

    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    data = request.get_json(silent=True) or {}

    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    avatar_url = (data.get('avatar_url') or '').strip()
    email_new = (data.get('email') or '').strip()
    phone_raw = (data.get('phone_number') or '').strip()

    # Normalización/validación de teléfono si viene (no aceptamos vacío para borrar)
    phone_new = None
    if phone_raw:
        try:
            phone_new = normalize_e164(phone_raw)
        except Exception as e:
            return jsonify({"msg": f"Teléfono inválido: {e}"}), 400

    # Detectar cambios
    email_changed = bool(email_new and email_new != user.email)
    phone_changed = bool(phone_new and phone_new != (user.phone_number or ''))

    # Asignaciones (solo si vienen y no están vacíos)
    if first_name:
        user.first_name = first_name
    if last_name:
        user.last_name = last_name
    if avatar_url:
        user.avatar_url = avatar_url

    if email_new:
        user.email = email_new
        if email_changed:
            user.email_verified = False  # forzar re-verificación

    if phone_new:
        user.phone_number = phone_new
        if phone_changed:
            # ⚠️ Si cambias el número, invalida verificación previa
            user.phone_verified_at = None

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        # Colisiones por UNIQUE (email o phone_number)
        return jsonify({"msg": "Email o teléfono ya están en uso"}), 409
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(
            f"Error al actualizar perfil del usuario {user.user_id}: {e}",
            exc_info=True
        )
        return jsonify({"msg": "Error interno al guardar los datos"}), 500

    # Si el email cambió, intentar enviar email de validación
    if email_changed:
        try:
            token = generate_validation_token(user.email)
            send_account_validation_email(user, token)
        except Exception as e:
            current_app.logger.warning(
                f"No se pudo enviar email de validación a {user.email}: {e}"
            )

    return jsonify({"msg": "Perfil actualizado", "user": user.to_dict()}), 200
