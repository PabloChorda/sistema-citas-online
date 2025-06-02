from flask import request, jsonify, current_app
from ...models import User, Provider
from ... import db
from . import auth_bp

@auth_bp.route('/register/provider', methods=['POST'])
def register_provider():
    """
    POST /auth/register/provider
    -----------------------------

    Registra un nuevo usuario con rol "provider" y crea automáticamente su perfil de proveedor.

    ✅ Campos requeridos (en JSON):
        - email: str — Email del usuario.
        - password: str — Contraseña del usuario (se guarda hasheada).
        - business_name: str — Nombre del negocio del proveedor.

    🟡 Campos opcionales:
        - first_name: str — Nombre del usuario.
        - last_name: str — Apellido del usuario.
        - phone_number: str — Teléfono de contacto.
        - business_type: str — Tipo de negocio. Por defecto 'default_type'.
        - timezone: str — Zona horaria. Por defecto 'UTC'.
        - address: str — Dirección del negocio.
        - bio: str — Descripción o biografía del proveedor.

    📤 Respuesta (201):
        {
            "msg": "Proveedor registrado exitosamente!",
            "user": { ...datos del usuario... },
            "provider_profile": { ...datos del perfil proveedor... }
        }

    ❌ Errores posibles:
        - 400: Si falta algún campo obligatorio.
        - 409: Si el email ya está registrado.
        - 500: Si ocurre un error interno al guardar en base de datos.
    """
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('business_name'):
        return jsonify({"msg": "Faltan datos requeridos: email, password, business_name"}), 400

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

    new_provider_profile = Provider(
        business_name=business_name,
        business_type=data.get('business_type', 'default_type'),
        timezone=data.get('timezone', 'UTC'),
        address=data.get('address'),
        bio=data.get('bio')
    )
    new_user.provider_profile = new_provider_profile

    try:
        db.session.add(new_user)
        db.session.commit()
        user_data = new_user.to_dict()
        profile_data = new_provider_profile.to_dict()
        return jsonify({
            "msg": "Proveedor registrado exitosamente!",
            "user": user_data,
            "provider_profile": profile_data
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al registrar proveedor: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno del servidor al registrar el proveedor", "error_details": str(e)}), 500

@auth_bp.route('/register/client', methods=['POST'])
def register_client():
    """
    POST /auth/register/client
    ---------------------------

    Registra un nuevo usuario con rol "client".

    ✅ Campos requeridos (en JSON):
        - email: str — Email del usuario.
        - password: str — Contraseña del usuario (se guarda de forma segura).

    🟡 Campos opcionales:
        - first_name: str — Nombre del cliente.
        - last_name: str — Apellido del cliente.
        - phone_number: str — Teléfono de contacto.

    📤 Respuesta (201):
        {
            "msg": "Cliente registrado exitosamente!",
            "user": { ...datos del usuario... }
        }

    ❌ Errores posibles:
        - 400: Si falta el email o la contraseña.
        - 409: Si ya existe un usuario con ese email.
        - 500: Si ocurre un error interno al guardar en base de datos.
    """
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
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

    try:
        db.session.add(new_user)
        db.session.commit()
        user_data = new_user.to_dict()
        return jsonify({
            "msg": "Cliente registrado exitosamente!",
            "user": user_data
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al registrar cliente: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno del servidor al registrar el cliente", "error_details": str(e)}), 500
