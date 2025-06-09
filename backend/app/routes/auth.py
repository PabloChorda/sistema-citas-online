# backend/app/routes/auth.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)

bp = Blueprint('auth', __name__)

@bp.route('/test-db', methods=['GET']) 
def api_test_db():
    """Test de conexión a la base de datos"""
    try:
        # Importación tardía para evitar circulares
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
    """
    POST /auth/register/provider
    Registra un nuevo usuario con rol "provider" y crea automáticamente su perfil de proveedor.
    """
    try:
        # Importaciones tardías para evitar problemas circulares
        from app import db
        from app.models import User, Provider
        
        current_app.logger.info("Iniciando registro de proveedor")
        
        data = request.get_json()
        current_app.logger.info(f"Datos recibidos: {data}")
        
        if not data:
            current_app.logger.warning("No se recibieron datos JSON")
            return jsonify({"msg": "No se recibieron datos"}), 400
            
        required_fields = ['email', 'password', 'business_name']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            current_app.logger.warning(f"Campos faltantes: {missing_fields}")
            return jsonify({"msg": f"Faltan datos requeridos: {', '.join(missing_fields)}"}), 400

        email = data.get('email')
        password = data.get('password')
        business_name = data.get('business_name')

        # Verificar si el email ya existe
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            current_app.logger.warning(f"Email ya registrado: {email}")
            return jsonify({"msg": "El email ya está registrado"}), 409

        # Crear nuevo usuario
        new_user = User(
            email=email,
            role='provider',
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            phone_number=data.get('phone_number')
        )
        new_user.set_password(password)

        # Guardar el usuario primero para obtener el ID
        db.session.add(new_user)
        db.session.flush()  # Esto genera el user_id sin hacer commit
        
        # Crear perfil de proveedor con el user_id
        new_provider_profile = Provider(
            provider_id=new_user.user_id,  # Asignar explícitamente el user_id
            business_name=business_name,
            business_type=data.get('business_type', 'default_type'),
            timezone=data.get('timezone', 'UTC'),
            address=data.get('address'),
            bio=data.get('bio')
        )
        
        # Agregar el perfil de proveedor
        db.session.add(new_provider_profile)
        
        # Hacer commit de ambos
        db.session.commit()
        
        current_app.logger.info(f"Proveedor registrado exitosamente: {email}")
        
        user_data = new_user.to_dict()
        profile_data = new_provider_profile.to_dict()
        
        return jsonify({
            "msg": "Proveedor registrado exitosamente!",
            "user": user_data,
            "provider_profile": profile_data
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al registrar proveedor: {e}", exc_info=True)
        return jsonify({
            "msg": "Error interno del servidor al registrar el proveedor", 
            "error_details": str(e)
        }), 500

@bp.route('/register/client', methods=['POST'])
def register_client():
    """
    POST /auth/register/client
    Registra un nuevo usuario con rol "client".
    """
    try:
        # Importaciones tardías
        from app import db
        from app.models import User
        
        current_app.logger.info("Iniciando registro de cliente")
        
        data = request.get_json()
        current_app.logger.info(f"Datos recibidos: {data}")
        
        if not data:
            current_app.logger.warning("No se recibieron datos JSON")
            return jsonify({"msg": "No se recibieron datos"}), 400
            
        if not data.get('email') or not data.get('password'):
            current_app.logger.warning("Email o password faltantes")
            return jsonify({"msg": "Faltan datos requeridos: email, password"}), 400

        email = data.get('email')
        password = data.get('password')

        # Verificar si el email ya existe
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            current_app.logger.warning(f"Email ya registrado: {email}")
            return jsonify({"msg": "El email ya está registrado"}), 409

        # Crear nuevo usuario
        new_user = User(
            email=email,
            role='client',
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            phone_number=data.get('phone_number')
        )
        new_user.set_password(password)

        # Guardar en base de datos
        db.session.add(new_user)
        db.session.commit()
        
        current_app.logger.info(f"Cliente registrado exitosamente: {email}")
        
        user_data = new_user.to_dict()
        return jsonify({
            "msg": "Cliente registrado exitosamente!",
            "user": user_data
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al registrar cliente: {e}", exc_info=True)
        return jsonify({
            "msg": "Error interno del servidor al registrar el cliente", 
            "error_details": str(e)
        }), 500

@bp.route('/login', methods=['POST'])
def login():
    """
    POST /auth/login
    Inicia sesión de un usuario (cliente o proveedor) y genera un JWT válido.
    Además, envía un correo de bienvenida al usuario.
    """
    try:
        from app.models import User
        from flask_mail import Message
        from app import mail

        current_app.logger.info("Iniciando proceso de login")

        data = request.get_json()
        if not data:
            current_app.logger.warning("No se recibieron datos JSON para login")
            return jsonify({"msg": "No se recibieron datos"}), 400

        if not data.get('email') or not data.get('password'):
            current_app.logger.warning("Email o password faltantes en login")
            return jsonify({"msg": "Faltan email o contraseña"}), 400

        email = data.get('email')
        password = data.get('password')

        current_app.logger.info(f"Intentando login para: {email}")

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            current_app.logger.warning(f"Credenciales incorrectas para: {email}")
            return jsonify({"msg": "Credenciales incorrectas"}), 401

        # Crear token JWT
        identity_to_store = str(user.user_id)
        access_token = create_access_token(identity=identity_to_store)

        # Enviar correo de bienvenida
        nombre = user.first_name or 'usuario'
        msg = Message(
            subject="Inicio de sesión exitoso",
            recipients=[email],
            body=f"Hola {nombre}, has iniciado sesión correctamente en el sistema de citas online.",
        )
        try:
            mail.send(msg)
            current_app.logger.info(f"Correo enviado a {email}")
        except Exception as mail_error:
            current_app.logger.error(f"Error enviando correo a {email}: {mail_error}")

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
    """
    GET /auth/protected
    Ruta protegida de ejemplo que requiere autenticación JWT para acceder.
    """
    try:
        # Importación tardía
        from app.models import User
        
        current_app.logger.info("Accediendo a ruta protegida '/protected'")
        
        current_user_id_str = get_jwt_identity()
        current_app.logger.info(f"Identity del token: {current_user_id_str}")
        
        try:
            current_user_id_int = int(current_user_id_str)
        except ValueError:
            current_app.logger.error(f"Identidad del token inválida: {current_user_id_str}")
            return jsonify({"msg": "Identidad del token inválida"}), 422

        user = User.query.get(current_user_id_int)
        if not user:
            current_app.logger.warning(f"Usuario no encontrado para ID: {current_user_id_int}")
            return jsonify({"msg": "Usuario no encontrado"}), 404

        current_app.logger.info(f"Usuario autenticado: {user.email} (ID: {user.user_id})")
        
        return jsonify({
            "logged_in_as": user.email, 
            "user_id": user.user_id, 
            "role": user.role, 
            "message": "¡Acceso a ruta protegida concedido!"
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error en ruta protegida: {e}", exc_info=True)
        return jsonify({"msg": "Error interno del servidor", "error_details": str(e)}), 500