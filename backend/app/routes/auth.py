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
    try:
        from app import db
        from app.models import User, Provider

        data = request.get_json()
        if not data:
            return jsonify({"msg": "No se recibieron datos"}), 400

        required_fields = ['email', 'password', 'business_name']
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({"msg": f"Faltan datos requeridos: {', '.join(missing_fields)}"}), 400

        email = data.get('email')
        password = data.get('password')
        business_name = data.get('business_name')

        if User.query.filter_by(email=email).first():
            return jsonify({"msg": "El email ya está registrado"}), 409

        new_user = User(
            email=email,
            role='provider',
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            phone_number=data.get('phone_number')
        )
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.flush()

        new_provider_profile = Provider(
            provider_id=new_user.user_id,
            business_name=business_name,
            business_type=data.get('business_type', 'default_type'),
            timezone=data.get('timezone', 'UTC'),
            address=data.get('address'),
            bio=data.get('bio')
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

