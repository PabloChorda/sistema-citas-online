# backend/app/routes/auth.py
from flask import Blueprint, jsonify, request, current_app, redirect
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
from .email_service import send_login_notification, send_account_validation_email, send_password_reset_email
import secrets
from app.utils.tokens import generate_validation_token
from datetime import datetime, timezone, timedelta
from app import db
from app.models import User, Provider, Establishment, Service
from google.oauth2 import id_token
from google.auth.transport import requests
from flask_cors import cross_origin
import os
from urllib.parse import urlencode
from app.services.magic_links import create_magic_link_for_phone, redeem_magic_token
from app.services.otp_service import request_otp as otp_request, verify_otp as otp_verify
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

# 🔒 key-func para limitar por email (body JSON)
def _key_email_from_body():
    data = request.get_json(silent=True) or {}
    raw = (data.get("email") or "").strip().lower()
    return f"email:{raw}" if raw else request.remote_addr


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

        # ⬇️ Generamos ambos tokens
        access_token = create_access_token(identity=str(user.user_id))
        refresh_token = create_refresh_token(identity=str(user.user_id))

        # Notificación opcional
        send_login_notification(user)

        # ⬇️ Devolvemos también el refresh_token
        return jsonify({
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user_id": user.user_id,
            "role": user.role
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error en login: {e}", exc_info=True)
        return jsonify({"msg": "Error interno del servidor", "error_details": str(e)}), 500
    
@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh_token():
    """Devuelve un nuevo access_token usando el refresh_token."""
    identity = get_jwt_identity()
    access = create_access_token(identity=identity)
    return jsonify(access_token=access), 200

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
    """
    Establece una nueva contraseña si el token es válido y no ha expirado.
    Body: { "password": "NuevaClave123!" }
    """
    data = request.get_json(silent=True) or {}
    new_password = (data.get('password') or '').strip()

    if len(new_password) < 8:
        return jsonify({"msg": "La contraseña debe tener al menos 8 caracteres"}), 400

    try:
        now = datetime.now(timezone.utc)
        user = User.query.filter_by(reset_token=token).first()

        if (not user) or (not user.reset_token_expiry):
            return jsonify({"msg": "Token inválido o expirado"}), 400

        # Asegura comparación con aware datetimes
        expiry = user.reset_token_expiry
        if expiry.tzinfo is None:
            # si por lo que sea estuviera naive en la BD, lo tratamos como UTC
            expiry = expiry.replace(tzinfo=timezone.utc)

        if expiry < now:
            return jsonify({"msg": "Token inválido o expirado"}), 400

        # OK: actualizamos contraseña y limpiamos token
        user.set_password(new_password)
        user.reset_token = None
        user.reset_token_expiry = None
        db.session.commit()

        return jsonify({"msg": "Contraseña actualizada correctamente"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"reset_password error: {e}", exc_info=True)
        return jsonify({"msg": "No se pudo actualizar la contraseña ahora"}), 500

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
        refresh_token = create_refresh_token(identity=str(user.user_id))

        # (opcional) send_login_notification(user)

        return jsonify({
            "access_token": access_token,
            "refresh_token": refresh_token,
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
    Respuesta: { "access_token": "...", "refresh_token": "...", ... }
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

    access_token  = create_access_token(identity=str(user.user_id))
    refresh_token = create_refresh_token(identity=str(user.user_id))

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
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
@limiter.limit("30 per 10 minutes")
@limiter.limit("8 per 10 minutes", key_func=_key_phone_from_body)
@limiter.limit("3 per 30 seconds", key_func=_key_phone_from_body)
def phone_verify_otp():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone_number") or "").strip()
    code = (data.get("code") or "").strip()
    if not phone or not code:
        return jsonify({"msg": "phone_number y code requeridos"}), 400
    try:
        user = otp_verify(phone, code, purpose="login")
        access_token = create_access_token(identity=str(user.user_id))
        refresh_token = create_refresh_token(identity=str(user.user_id))

        return jsonify({
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user_id": user.user_id,
            "role": user.role,
            "profile_complete": _profile_complete(user),
        }), 200
    except ValueError as ve:
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        current_app.logger.error(f"verify_otp error: {e}", exc_info=True)
        return jsonify({"msg": "No se pudo verificar el código"}), 500
    
@bp.route('/forgot-password', methods=['POST'])
@limiter.limit("5 per hour")                   # por IP
@limiter.limit("5 per hour", key_func=_key_email_from_body)  # por email
def forgot_password():
    """
    Solicita restablecimiento de contraseña.
    Siempre responde 200 para no filtrar existencia del email.
    Si el usuario existe y su email es 'real' (no autogen), genera token, guarda y envía correo.
    """
    try:
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        if not email:
            # Devolvemos 200 igualmente para no revelar nada
            return jsonify({"msg": "Si el correo existe, te hemos enviado instrucciones para restablecer la contraseña."}), 200

        user = User.query.filter_by(email=email).first()

        # No revelamos existencia. Solo actuamos si tiene un email "real".
        if user and user.email and not user.email.endswith("@autogen.local"):
            token = secrets.token_urlsafe(32)
            ttl_min = 60
            try:
                ttl_min = int(os.getenv("PASSWORD_RESET_TTL_MINUTES", "60"))
            except Exception:
                pass

            expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_min)

            # Guardamos token y expiración
            user.reset_token = token
            user.reset_token_expiry = expires
            db.session.commit()

            try:
                ok = send_password_reset_email(user, token)
                if not ok:
                    current_app.logger.error(f"[forgot-password] Falló el envío de email a {email}")
            except Exception as e:
                current_app.logger.error(f"[forgot-password] Excepción enviando email a {email}: {e}", exc_info=True)

        # Respuesta genérica
        return jsonify({"msg": "Si el correo existe, te hemos enviado instrucciones para restablecer la contraseña."}), 200

    except Exception as e:
        current_app.logger.error(f"[forgot-password] Error inesperado: {e}", exc_info=True)
        # Aun así mantenemos respuesta genérica 200 (anti-enumeración)
        return jsonify({"msg": "Si el correo existe, te hemos enviado instrucciones para restablecer la contraseña."}), 200


@bp.route('/change-password', methods=['POST'])
@jwt_required()
@limiter.limit("5 per minute")
def change_password():
    """
    Cambia la contraseña del usuario autenticado.
    Body: { "current_password": "...", "new_password": "..." }
    - Si el usuario ya tiene contraseña local, se exige current_password válida.
    - Si el usuario NO tiene contraseña local (p.ej. alta por Google/Phone), no se exige current_password.
    """
    try:
        data = request.get_json(silent=True) or {}
        current_password = (data.get("current_password") or "").strip()
        new_password = (data.get("new_password") or "").strip()

        # Validaciones básicas
        if not new_password or len(new_password) < 8:
            return jsonify({"msg": "La nueva contraseña debe tener al menos 8 caracteres."}), 400

        # Identidad
        try:
            user_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return jsonify({"msg": "Identidad del token inválida"}), 422

        user = User.query.get(user_id)
        if not user:
            return jsonify({"msg": "Usuario no encontrado"}), 404

        # ¿Tiene contraseña local ya establecida?
        has_local_password = getattr(user, "password_hash", None) not in (None, "")

        if has_local_password:
            # Requerir current_password correcta
            if not current_password:
                return jsonify({"msg": "Debes indicar tu contraseña actual."}), 400
            if not user.check_password(current_password):
                return jsonify({"msg": "La contraseña actual no es correcta."}), 401

            # Evitar reutilizar la misma contraseña
            if user.check_password(new_password):
                return jsonify({"msg": "La nueva contraseña no puede ser igual a la actual."}), 400
        else:
            # Alta por Google/Phone: permitimos establecer una primera contraseña sin current_password
            if current_password:
                # Si mandan current_password y no hay hash, lo ignoramos (o podrías forzar error 400 si prefieres)
                pass

        # Establecer nueva contraseña
        user.set_password(new_password)
        db.session.commit()

        return jsonify({"msg": "Contraseña actualizada correctamente."}), 200

    except Exception as e:
        current_app.logger.error(f"Error en change-password: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"msg": "Error interno del servidor"}), 500

@bp.get("/me")
@jwt_required()
def me():
    try:
        uid = int(get_jwt_identity())
    except (TypeError, ValueError):
        return jsonify({"msg": "Identidad del token inválida"}), 422

    user = User.query.get(uid)
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    payload = {
        "user_id": user.user_id,
        "role": user.role,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email_verified": bool(getattr(user, "email_verified", False)),
        "phone_number": getattr(user, "phone_number", None),
        "phone_verified": bool(getattr(user, "phone_verified_at", None)),
        "avatar_url": getattr(user, "avatar_url", None),
        "is_active": getattr(user, "is_active", True),
    }

    # --------- ONBOARDING (solo para proveedores) ---------
    onboarding = None
    if user.role == "provider":
        # Relación típica: user.provider -> provider.establishments -> establishment.services
        provider = getattr(user, "provider", None)

        if provider:
            ests = list(getattr(provider, "establishments", []) or [])
            has_establishment = len(ests) > 0

            # Cualquier establecimiento que tenga al menos un servicio
            has_service = any(
                len(getattr(est, "services", []) or []) > 0
                for est in ests
            )

            # TODO: ajusta esta lógica a tu modelo real de disponibilidad/horarios
            # Ejemplos posibles:
            #  - hasattr(est, "opening_hours") and est.opening_hours
            #  - hasattr(est, "availabilities") and est.availabilities
            has_availability = False

            onboarding = {
                "has_establishment": has_establishment,
                "has_service": has_service,
                "has_availability": has_availability,
                "complete": has_establishment and has_service and has_availability,
            }

    payload["onboarding"] = onboarding
    # ------------------------------------------------------

    return jsonify(payload), 200
