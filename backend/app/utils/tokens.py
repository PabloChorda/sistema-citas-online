import jwt
import secrets
from datetime import datetime, timedelta
from flask import current_app


def generate_validation_token(email, expires_in=3600):
    """
    Genera un token JWT para validación de cuenta con expiración.

    :param email: Email del usuario a validar
    :param expires_in: Tiempo de expiración en segundos (default: 1 hora)
    :return: token JWT (str)
    """
    payload = {
        'email': email,
        'exp': datetime.utcnow() + timedelta(seconds=expires_in),
        'iat': datetime.utcnow()
    }
    secret = current_app.config['SECRET_KEY']
    token = jwt.encode(payload, secret, algorithm='HS256')
    return token


def verify_validation_token(token):
    """
    Verifica y decodifica el token JWT de validación.

    :param token: El token JWT (str)
    :return: email si es válido, None si no
    """
    try:
        secret = current_app.config['SECRET_KEY']
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return payload['email']
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
        current_app.logger.warning(f"Token de validación inválido o expirado: {e}")
        return None



def generate_reset_token(expiration_minutes=30):
    token = secrets.token_urlsafe(48)
    expiry = datetime.utcnow() + timedelta(minutes=expiration_minutes)
    return token, expiry
