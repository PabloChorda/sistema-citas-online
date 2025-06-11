# backend/app/routes/auth.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from .email_service import send_login_notification, send_account_validation_email
from app.utils.tokens import generate_validation_token
from datetime import datetime

bp = Blueprint('auth', __name__)

@bp.route('/test-db', methods=['GET'])
def api_test_db():
    try:
        from app import db
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

    from app import db
    from app.models import User, Provider

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
            last_name=data.get('last_name'),
            phone_number=data.get('phone_number')
        )
        new_user.set_password(data.get('password'))
        
        db.session.add(new_user)
        
        # Hacemos un "flush" para enviar el usuario a la BD y obtener su ID generado,
        # sin confirmar la transacción todavía.
        db.session.flush()

        # Ahora que new_user.user_id tiene un valor, lo usamos para la clave primaria de Provider.
        new_provider_profile = Provider(
            provider_id=new_user.user_id,  # Asignamos explícitamente la Clave Primaria
            user=new_user,                 # Mantenemos la asignación del objeto para la relación
            nombre_comercial=data.get('nombre_comercial'),
            cif=cif,
            tipo_empresa=data.get('tipo_empresa'),
            bio=data.get('bio'),
            telefono_contacto=data.get('telefono_contacto'),
            email_contacto=data.get('email_contacto'),
            web=data.get('web'),
            timezone=data.get('timezone', 'Europe/Madrid'),
            idiomas_hablados=data.get('idiomas_hablados'),
            direccion_fiscal=data.get('direccion_fiscal')
        )
        
        db.session.add(new_provider_profile)
        db.session.commit()

        token = generate_validation_token(new_user.email)
        send_account_validation_email(new_user, token)

        return jsonify({
            "msg": "Proveedor registrado exitosamente!",
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
        from app import db
        from app.models import User

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
        from app.models import User

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
        from app.models import User

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
    GET /auth/validate/<token>
    Valida una cuenta de usuario a través del token enviado por correo.
    """
    from app import db
    from app.models import User
    from app.utils.tokens import verify_validation_token

    email = verify_validation_token(token)
    if not email:
        return jsonify({"msg": "Token inválido o expirado"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    # ⚠️ Suponemos que agregaste la columna is_active en tu modelo User
    if getattr(user, 'is_active', None) is False:
        user.is_active = True
        db.session.commit()

    return jsonify({"msg": "Cuenta validada exitosamente."}), 200

@bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    from app import db
    from app.models import User
    from app.routes.email_service import send_password_reset_email
    from app.utils.tokens import generate_reset_token

    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({"msg": "Email requerido"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"msg": "No existe un usuario con ese email"}), 404

    token, expiry = generate_reset_token()
    user.reset_token = token
    user.reset_token_expiry = expiry
    db.session.commit()

    send_password_reset_email(user, token)
    return jsonify({"msg": "Se ha enviado un correo para restablecer la contraseña"}), 200

@bp.route('/reset-password/<token>', methods=['POST'])
def reset_password(token):
    from app import db
    from app.models import User
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



