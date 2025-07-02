# backend/app/routes/establishment.py

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Establishment, Provider

establishment_bp = Blueprint('establishment', __name__)

def get_provider_id_from_jwt():
    """Función helper para obtener y validar el ID del provider desde el token JWT."""
    try:
        return int(get_jwt_identity())
    except (ValueError, TypeError):
        return None

# --- RUTA PARA CREAR UN ESTABLECIMIENTO ---

@establishment_bp.route('/establishments/<int:establishment_id>', methods=['GET'])
@jwt_required()
def get_establishment(establishment_id):
    """Obtiene los detalles de un establecimiento específico."""
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    establishment = Establishment.query.get(establishment_id)
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado"}), 404

    # Medida de seguridad
    if establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado."}), 403

    return jsonify(establishment.to_dict()), 200

@establishment_bp.route('/establishments', methods=['POST'])
@jwt_required()
def create_establishment():
    """Crea un nuevo establecimiento para el proveedor autenticado."""
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    provider = Provider.query.get(provider_id)
    if not provider:
        return jsonify({"msg": "Acceso denegado. Se requiere perfil de proveedor."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos (payload vacío)"}), 400

    required_fields = ['nombre', 'direccion_completa', 'provincia', 'localidad']
    if any(field not in data for field in required_fields):
        return jsonify({"msg": f"Faltan datos requeridos: {', '.join(required_fields)}"}), 400

    try:
        new_establishment = Establishment(
            provider_id=provider_id,
            nombre=data['nombre'],
            direccion_completa=data['direccion_completa'],
            provincia=data['provincia'],
            localidad=data['localidad'],
            codigo_postal=data.get('codigo_postal'),
            telefono=data.get('telefono'),
            email=data.get('email')
        )
        db.session.add(new_establishment)
        db.session.commit()
        current_app.logger.info(f"Establecimiento '{new_establishment.nombre}' creado para el proveedor {provider_id}.")
        return jsonify(new_establishment.to_dict()), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear establecimiento para proveedor {provider_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al crear el establecimiento"}), 500


# --- RUTA PARA ACTUALIZAR UN ESTABLECIMIENTO ---
@establishment_bp.route('/establishments/<int:establishment_id>', methods=['PUT'])
@jwt_required()
def update_establishment(establishment_id):
    """Actualiza la información de un establecimiento existente."""
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    establishment = Establishment.query.get(establishment_id)
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado"}), 404

    if establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado. No eres el propietario."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos"}), 400

    editable_fields = [
        'nombre', 'direccion_completa', 'provincia', 'localidad', 'codigo_postal',
        'telefono', 'email', 'web', 'descripcion_publica', 'activo'
    ]
    
    for field in editable_fields:
        if field in data:
            setattr(establishment, field, data[field])

    try:
        db.session.commit()
        current_app.logger.info(f"Establecimiento {establishment_id} actualizado.")
        return jsonify(establishment.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al actualizar establecimiento {establishment_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al actualizar"}), 500


# --- RUTA PARA ELIMINAR UN ESTABLECIMIENTO ---
@establishment_bp.route('/establishments/<int:establishment_id>', methods=['DELETE'])
@jwt_required()
def delete_establishment(establishment_id):
    """Elimina un establecimiento."""
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    establishment = Establishment.query.get(establishment_id)
    if not establishment:
        return jsonify({"msg": "Operación no permitida"}), 404

    if establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado."}), 403

    try:
        db.session.delete(establishment)
        db.session.commit()
        current_app.logger.info(f"Establecimiento {establishment_id} eliminado.")
        return jsonify({"msg": "Establecimiento eliminado correctamente"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al eliminar establecimiento {establishment_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al eliminar"}), 500