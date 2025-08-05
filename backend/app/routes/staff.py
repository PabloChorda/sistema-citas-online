# backend/app/routes/staff.py

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Establishment, User, Staff, Service

staff_bp = Blueprint('staff', __name__)

def get_provider_id_from_jwt():
    """Helper para obtener el ID del provider desde el token JWT."""
    try:
        return int(get_jwt_identity())
    except (ValueError, TypeError):
        return Non
    
# --- NUEVA RUTA PÚBLICA ---
@staff_bp.route('/public/establishments/<int:establishment_id>/staff', methods=['GET'])
def get_public_staff_for_establishment(establishment_id):
    """
    GET /api/public/establishments/<id>/staff
    -----------------------------------------
    Obtiene la lista pública de miembros del staff de un establecimiento.
    No requiere autenticación.
    """
    establishment = Establishment.query.filter_by(id=establishment_id, activo=True).first()
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado o inactivo."}), 404
        
    # Mostramos solo el personal que esté activo
    staff_members = establishment.staff_members.filter_by(activo=True).order_by(Staff.created_at).all()
    
    # Podríamos crear un to_dict_public() si no quisiéramos mostrar el email,
    # pero por ahora, el to_dict() normal está bien.
    return jsonify([member.to_dict() for member in staff_members]), 200

    
# --- RUTA GET (LEER) ---
@staff_bp.route('/establishments/<int:establishment_id>/staff', methods=['GET'])
@jwt_required()
def get_staff_for_establishment(establishment_id):
    """Obtiene la lista de miembros del staff de un establecimiento."""
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    establishment = Establishment.query.filter_by(id=establishment_id, provider_id=provider_id).first()
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado o no te pertenece."}), 404

    staff_members = establishment.staff_members.order_by(Staff.created_at).all()
    return jsonify([member.to_dict() for member in staff_members]), 200


# --- RUTA PARA AÑADIR UN NUEVO MIEMBRO DEL STAFF ---

@staff_bp.route('/establishments/<int:establishment_id>/staff', methods=['POST'])
@jwt_required()
def add_staff_member(establishment_id):
    """
    POST /api/establishments/<id>/staff
    Añade un nuevo miembro del staff a un establecimiento.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    # Verificar que el establecimiento existe y pertenece al proveedor
    establishment = Establishment.query.filter_by(id=establishment_id, provider_id=provider_id).first()
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado o no te pertenece."}), 404

    data = request.get_json()
    required_fields = ['email', 'first_name', 'last_name', 'rol', 'password']
    if not data or any(field not in data for field in required_fields):
        return jsonify({"msg": f"Faltan datos requeridos: {', '.join(required_fields)}"}), 400

    # Verificar que el email no esté ya en uso
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"msg": "Este email ya está registrado en el sistema."}), 409

    try:
        # 1. Crear la cuenta de usuario para el nuevo miembro
        new_user = User(
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            role='staff', # Asignamos el nuevo rol 'staff'
            is_active=True,
            email_verified=True # El proveedor lo verifica
        )
        new_user.set_password(data['password'])
        db.session.add(new_user)
        db.session.flush() # Para obtener el new_user.user_id

        # 2. Crear el perfil de Staff y vincularlo
        new_staff_profile = Staff(
            user_id=new_user.user_id,
            establishment_id=establishment.id,
            rol=data['rol']
        )
        db.session.add(new_staff_profile)
        
        db.session.commit()
        
        current_app.logger.info(f"Nuevo miembro del staff '{new_user.email}' añadido al establecimiento {establishment.id}")
        return jsonify(new_staff_profile.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al añadir staff: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al añadir el miembro del staff."}), 500
    
# --- RUTA PUT (ACTUALIZAR) ---
@staff_bp.route('/staff/<int:staff_id>', methods=['PUT'])
@jwt_required()
def update_staff_member(staff_id):
    """Actualiza los datos de un miembro del staff (rol, servicios, etc.)."""
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    staff_member = Staff.query.get(staff_id)
    if not staff_member:
        return jsonify({"msg": "Miembro del staff no encontrado."}), 404
        
    if staff_member.establishment.provider_id != provider_id:
        return jsonify({"msg": "No tienes permiso para editar este miembro del staff."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos."}), 400

    try:
        # Actualizamos el User asociado
        user_to_update = staff_member.user
        if 'first_name' in data: user_to_update.first_name = data['first_name']
        if 'last_name' in data: user_to_update.last_name = data['last_name']

        # Actualizamos el perfil de Staff
        if 'rol' in data: staff_member.rol = data['rol']
        if 'activo' in data: staff_member.activo = data['activo']

        # Actualizamos los servicios asignados
        if 'service_ids' in data and isinstance(data['service_ids'], list):
            services_to_assign = Service.query.filter(
                Service.establishment_id == staff_member.establishment_id,
                Service.id.in_(data['service_ids'])
            ).all()
            staff_member.services = services_to_assign
        
        db.session.commit()
        return jsonify(staff_member.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error actualizando staff ID {staff_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al actualizar."}), 500

# --- RUTA DELETE (BORRAR) ---
@staff_bp.route('/staff/<int:staff_id>', methods=['DELETE'])
@jwt_required()
def delete_staff_member(staff_id):
    """Elimina un miembro del staff."""
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    staff_member = Staff.query.get(staff_id)
    if not staff_member:
        return jsonify({"msg": "Miembro del staff no encontrado."}), 404
        
    if staff_member.establishment.provider_id != provider_id:
        return jsonify({"msg": "No tienes permiso para eliminar este miembro del staff."}), 403

    try:
        # Al eliminar el perfil de Staff, la cuenta de User asociada podría quedar
        # huérfana. Decidimos eliminar también el User.
        user_to_delete = staff_member.user
        db.session.delete(staff_member)
        if user_to_delete:
            db.session.delete(user_to_delete)
            
        db.session.commit()
        return jsonify({"msg": "Miembro del staff eliminado correctamente."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error eliminando staff ID {staff_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al eliminar."}), 500