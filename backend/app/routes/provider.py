# backend/app/routes/provider.py

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User, Provider

# Creamos un nuevo Blueprint para las rutas del proveedor.
# El 'url_prefix' asegura que todas las rutas aquí empiecen con '/api/provider'.
provider_bp = Blueprint('provider', __name__)


@provider_bp.route('/profile', methods=['GET'])
@jwt_required() # ¡Esta línea protege la ruta! Solo usuarios con un token JWT válido pueden acceder.
def get_provider_profile():
    """
    Obtiene el perfil completo del proveedor autenticado.
    """
    # 1. Obtenemos la identidad del usuario desde el token JWT.
    # get_jwt_identity() devuelve lo que pusimos en 'create_access_token', que fue el user_id.
    current_user_id = get_jwt_identity()

    # 2. Buscamos al usuario en la base de datos.
    user = User.query.get(current_user_id)

    # 3. Validaciones de seguridad y de datos.
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404

    if user.role != 'provider':
        # Un 'client' no debería poder acceder aquí.
        return jsonify({"msg": "Acceso no autorizado. Se requiere rol de proveedor."}), 403

    # 4. Obtenemos el perfil de proveedor usando la relación que creamos en models.py
    # Si la relación está bien definida, 'user.provider_profile' debería funcionar.
    provider_profile = user.provider_profile
    
    if not provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario."}), 404
        
    # 5. Devolvemos los datos del perfil.
    # El método .to_dict() que ya tienes en tu modelo Provider es perfecto para esto.
    return jsonify(provider_profile.to_dict()), 200

@provider_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_provider_profile():
    """
    Actualiza el perfil del proveedor autenticado.
    """
    # Obtenemos la identidad del usuario desde el token
    current_user_id = get_jwt_identity()
    
    # Buscamos el perfil del proveedor directamente por su ID
    provider_profile = Provider.query.get(current_user_id)

    if not provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado"}), 404

    # Obtenemos los datos que envía el frontend
    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos"}), 400

    # Actualizamos los campos del objeto con los nuevos datos.
    # Usamos .get(llave, valor_actual) para no borrar campos que no se envíen.
    provider_profile.nombre_comercial = data.get('nombre_comercial', provider_profile.nombre_comercial)
    provider_profile.telefono_contacto = data.get('telefono_contacto', provider_profile.telefono_contacto)
    provider_profile.web = data.get('web', provider_profile.web)
    # Aquí puedes añadir cualquier otro campo de la tarjeta que quieras que sea editable
    
    try:
        # Guardamos los cambios en la base de datos
        db.session.commit()
        # Devolvemos el perfil actualizado para que el frontend refresque la vista
        return jsonify(provider_profile.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        # En lugar de solo el log, podemos devolver un error más específico si queremos
        print(f"Error al actualizar perfil: {e}") 
        return jsonify({"msg": "Error interno al guardar los datos"}), 500