from flask import Blueprint, jsonify, request, current_app, redirect
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from .email_service import send_login_notification, send_account_validation_email
from app.utils.tokens import generate_validation_token
from datetime import datetime, timezone
from app import db
from app.models import User, Provider
from google.oauth2 import id_token
from google.auth.transport import requests
from flask_cors import cross_origin
import os
from urllib.parse import urlencode
from app.services.magic_links import create_magic_link_for_phone, redeem_magic_token
from app.services.otp_service import request_otp as otp_request, verify_otp as otp_verify

# ⬇️ Rate limiting
from app import limiter

bp = Blueprint('auth', __name__)

def _profile_complete(user):
    # Consideramos incompleto si falta nombre/apellidos o si el email es autogenerado
    if not user.first_name or not user.last_name:
        return False
    if not user.email or user.email.endswith("@autogen.local"):
        return False
    return True

# 🔒 key-func para limitar por teléfono (body JSON)
def _key_phone_from_body():
    data = request.get_json(silent=True) or {}
    raw = (data.get("phone_number") or "").strip()
    return f"phone:{raw}" if raw else request.remote_addr

@bp.route('/test-db', methods=['GET'])
def api_test_db():
    try:
        from app.models import User
        user_count = User.query.count()
        current_app.logger.info(f"Test DB exitoso: {user_count} usuarios encontrados")
        return jsonify({"message": "Conexión a DB exitosa!", "user_count": user_count}), 200
    except Exception as e:
        current_app.logger.error(f"Error conectando a DB: {e}", exc_info=True)
        return jsonify({"message": "Error conectando a DB", "error": str(e)}), 500

@bp.route('/register/provider', methods=['POST'])
def register_provider():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos (payload vacío)"}), 400

    required_fields = ['email', 'password', 'nombre_comercial', 'cif', 'first_name']
    missing_fields = [field for field in required_fields if not data.get(field)]
    if missing_fields:
        return jsonify({"msg": f"Faltan datos requeridos: {', '.join(missing_fields)}"}), 400

    email = data.get('email')
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "El email ya está registrado"}), 409
    
    cif = data.get('cif')
    if Provider.query.filter_by(cif=cif).first():
        return jsonify({"msg": "El CIF ya está registrado"}), 409

    try:
        new_user = User(
            email=email,
            role='provider',
            first_name=data.get('first_name'),
            last_name=data.get('last_name')
        )
        new_user.set_password(data.get('password'))
        
        new_provider_profile = Provider(
            user=new_user,
            nombre_comercial=data.get('nombre_comercial'),
            cif=cif,
            tipo_empresa=data.get('tipo_empresa'),
            bio=data.get('bio'),
            telefono_contacto=data.get('telefono_contacto'),
            email_contacto=data.get('email_contacto'),
            web=data.get('web'),
            timezone=data.get('timezone', 'Europe/Madrid'),
            idiomas_hablados=data.get('idiomas_hablados', []),
            direccion_fiscal=data.get('direccion_fiscal')
        )
        
        db.session.add(new_user)
        db.session.add(new_provider_profile)
        db.session.commit()

        # Enviar email de verificación (no criticamos si falla)
        try:
            token = generate_validation_token(new_user.email)
            send_account_validation_email(new_user, token)
            current_app.logger.info(f"Email de validación enviado a {new_user.email}")
        except Exception as email_error:
            current_app.logger.error(f"FALLO al enviar email de validación a {new_user.email}: {email_error}")

        return jsonify({
            "msg": "Proveedor registrado exitosamente! Se ha enviado un correo de validación.",
            "user": new_user.to_dict(),
            "provider_profile": new_provider_profile.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al registrar proveedor: {e}", exc_info=True)
        return jsonify({"msg": "Error interno del servidor", "error_details": str(e)}), 500

@bp.route('/register/client', methods=['POST'])
def register_client():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"msg": "No se recibieron datos"}), 400

        if not data.get('email') or not data.get('password'):
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

        db.session.add(new_user)
        db.session.commit()

        token = generate_validation_token(new_user.email)
        send_account_validation_email(new_user, token)

        return jsonify({"msg": "Cliente registrado exitosamente!", "user": new_user.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al registrar cliente: {e}", exc_info=True)
        return jsonify({"msg": "Error interno del servidor", "error_details": str(e)}), 500

@bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"msg": "No se recibieron datos"}), 400

        email = data.get('email')
        password = data.get('password')
        if not email or not password:
            return jsonify({"msg": "Faltan email o contraseña"}), 400

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return jsonify({"msg": "Credenciales incorrectas"}), 401

        access_token = create_access_token(identity=str(user.user_id))
        send_login_notification(user)

        return jsonify({
            "access_token": access_token,
            "user_id": user.user_id,
            "role": user.role
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error en login: {e}", exc_info=True)
        return jsonify({"msg": "Error interno del servidor", "error_details": str(e)}), 500

@bp.route('/protected', methods=['GET'])
@jwt_required()
def protected_route_example():
    try:
        current_user_id_str = get_jwt_identity()
        try:
            current_user_id_int = int(current_user_id_str)
        except ValueError:
            return jsonify({"msg": "Identidad del token inválida"}), 422

        user = User.query.get(current_user_id_int)
        if not user:
            return jsonify({"msg": "Usuario no encontrado"}), 404

        return jsonify({
            "logged_in_as": user.email,
            "user_id": user.user_id,
            "role": user.role,
            "message": "¡Acceso a ruta protegida concedido!"
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error en ruta protegida: {e}", exc_info=True)
        return jsonify({"msg": "Error interno del servidor", "error_details": str(e)}), 500
    

@bp.route('/validate/<token>', methods=['GET'])
def validate_account(token):
    """
    Valida el email usando el token enviado por correo.
    - Marca email_verified=True
    - (Opcional) is_active=True si existe ese campo
    """
    from app.utils.tokens import verify_validation_token

    email = verify_validation_token(token)
    if not email:
        return jsonify({"msg": "Token inválido o expirado"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    user.email_verified = True
    if hasattr(user, 'is_active') and (user.is_active is False):
        user.is_active = True

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error validando cuenta {email}: {e}", exc_info=True)
        return jsonify({"msg": "No se pudo validar la cuenta ahora"}), 500

    return jsonify({"msg": "Cuenta validada exitosamente.", "email_verified": True}), 200

@bp.route('/reset-password/<token>', methods=['POST'])
def reset_password(token):
    from datetime import datetime

    data = request.get_json()
    new_password = data.get('password')

    if not new_password:
        return jsonify({"msg": "Nueva contraseña requerida"}), 400

    user = User.query.filter_by(reset_token=token).first()
    if not user or not user.reset_token_expiry or user.reset_token_expiry.replace(tzinfo=None) < datetime.utcnow():
        return jsonify({"msg": "Token inválido o expirado"}), 400

    user.set_password(new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.session.commit()

    return jsonify({"msg": "Contraseña actualizada correctamente"}), 200

@bp.route('/oauth/google', methods=['POST'])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
def google_oauth_login():
    try:
        data = request.get_json()
        token = data.get('token')

        if not token:
            return jsonify({"msg": "Token requerido"}), 400

        idinfo = id_token.verify_oauth2_token(token, requests.Request())
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            return jsonify({"msg": "Emisor no válido"}), 400

        email = idinfo.get('email')
        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')
        picture = idinfo.get('picture', '')

        if not email:
            return jsonify({"msg": "No se pudo obtener el email del token"}), 400

        user = User.query.filter_by(email=email).first()

        if not user:
            user = User(
                email=email,
                role='client',
                first_name=first_name,
                last_name=last_name,
                avatar_url=picture,
                email_verified=True,
                is_active=True,
                social_id=idinfo.get('sub')
            )
            db.session.add(user)
            db.session.commit()

        access_token = create_access_token(identity=str(user.user_id))
        send_login_notification(user)

        return jsonify({
            "access_token": access_token,
            "user_id": user.user_id,
            "role": user.role
        }), 200

    except ValueError as e:
        current_app.logger.error(f"Token inválido de Google: {e}")
        return jsonify({"msg": "Token inválido"}), 400
    except Exception as e:
        current_app.logger.error(f"Error en login social: {e}", exc_info=True)
        return jsonify({"msg": "Error en login social", "error": str(e)}), 500

@bp.route('/whatsapp/init', methods=['POST'])
@jwt_required()
def whatsapp_init():
    """
    Crea un enlace mágico para que un cliente reserve desde WhatsApp.
    Body: { "phone_number": "+34...", "next": "/booking/123?prefill=true" }  # 'next' opcional
    Respuesta: { "url": "http://localhost:5173/magic?token=..." , "user_id": <id_cliente> }
    """
    current_user_id_str = get_jwt_identity()
    try:
        current_user_id = int(current_user_id_str)
    except (TypeError, ValueError):
        return jsonify({"msg": "Identidad del token inválida"}), 422

    caller = User.query.get(current_user_id)
    if not caller:
        return jsonify({"msg": "No autorizado"}), 401

    if caller.role not in ("provider", "staff", "admin"):
        return jsonify({"msg": "No autorizado"}), 403

    data = request.get_json(silent=True) or {}
    phone = (data.get("phone_number") or "").strip()
    next_path = (data.get("next") or "").strip()  # opcional

    if not phone:
        return jsonify({"msg": "phone_number requerido"}), 400

    # Seguridad: evita open redirects. Solo permitimos rutas relativas comenzando por "/"
    if next_path and not next_path.startswith("/"):
        current_app.logger.warning(f"Ignorando 'next' no relativo: {next_path!r}")
        next_path = ""

    try:
        token, target_user = create_magic_link_for_phone(phone, purpose="booking")
    except ValueError as e:
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        current_app.logger.error(f"Error creando magic link: {e}", exc_info=True)
        return jsonify({"msg": "Error interno creando enlace"}), 500

    base = os.getenv("MAGIC_LINK_BASE_URL", "http://localhost:5173/magic")
    params = {"token": token}
    if next_path:
        params["next"] = next_path

    url = f"{base}?{urlencode(params)}"
    return jsonify({"url": url, "user_id": target_user.user_id}), 201

@bp.route('/magic', methods=['GET'])
def magic():
    """
    Valida el token mágico y emite un access_token normal.
    Query: /auth/magic?token=...
    Respuesta: { "access_token": "...", "user_id": ..., "role": "...", "profile_complete": bool }
    """
    token = (request.args.get("token") or "").strip()
    if not token:
        return jsonify({"msg": "token requerido"}), 400

    try:
        user = redeem_magic_token(token)
    except ValueError as e:
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        current_app.logger.error(f"Error validando magic link: {e}", exc_info=True)
        return jsonify({"msg": "Error interno validando enlace"}), 500

    access_token = create_access_token(identity=str(user.user_id))

    return jsonify({
        "access_token": access_token,
        "user_id": user.user_id,
        "role": user.role,
        "profile_complete": _profile_complete(user)
    }), 200

@bp.route('/email/resend-verification', methods=['POST'], endpoint='email_resend_verification')
@jwt_required()
def resend_email_verification():
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return jsonify({"msg": "Identidad del token inválida"}), 422

    user = User.query.get(user_id)
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    if user.email_verified:
        return jsonify({"msg": "El correo ya está verificado"}), 400

    if not user.email:
        return jsonify({"msg": "No hay correo en tu perfil"}), 400

    if user.email.endswith("@autogen.local"):
        return jsonify({"msg": "Cambia tu correo por uno real antes de reenviar la verificación"}), 400

    try:
        token = generate_validation_token(user.email)
        send_account_validation_email(user, token)
    except Exception as e:
        current_app.logger.error(f"No se pudo reenviar verificación: {e}", exc_info=True)
        return jsonify({"msg": "No se pudo reenviar la verificación ahora"}), 500

    return jsonify({"msg": "Te hemos enviado un email para verificar tu correo"}), 200

@bp.route('/phone/request-otp', methods=['POST'])
@limiter.limit("10 per 10 minutes")  # por IP
@limiter.limit("5 per 10 minutes", key_func=_key_phone_from_body)  # por teléfono
def phone_request_otp():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone_number") or "").strip()
    if not phone:
        return jsonify({"msg": "phone_number requerido"}), 400
    try:
        result = otp_request(phone, purpose="login")
        return jsonify(result), 200
    except ValueError as ve:
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"request_otp error: {e}", exc_info=True)
        return jsonify({"msg": "No se pudo enviar el código"}), 500

@bp.route('/phone/verify-otp', methods=['POST'])
def phone_verify_otp():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone_number") or "").strip()
    code = (data.get("code") or "").strip()
    if not phone or not code:
        return jsonify({"msg": "phone_number y code requeridos"}), 400
    try:
        user = otp_verify(phone, code, purpose="login")
        access_token = create_access_token(identity=str(user.user_id))
        return jsonify({
            "access_token": access_token,
            "user_id": user.user_id,
            "role": user.role,
            "profile_complete": _profile_complete(user),
        }), 200
    except ValueError as ve:
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"verify_otp error: {e}", exc_info=True)
        return jsonify({"msg": "No se pudo verificar el código"}), 500
