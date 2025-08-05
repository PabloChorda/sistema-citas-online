# backend/app/routes/staff_availability.py

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Staff, StaffAvailabilityRule

# Creamos un blueprint específico para la disponibilidad del staff
staff_availability_bp = Blueprint('staff_availability', __name__)

def get_provider_id_from_jwt():
    """Helper para obtener el ID del provider desde el token JWT."""
    try:
        return int(get_jwt_identity())
    except (ValueError, TypeError):
        return None

# --- RUTA PARA OBTENER LOS HORARIOS DE UN EMPLEADO ---
@staff_availability_bp.route('/staff/<int:staff_id>/availability', methods=['GET'])
@jwt_required()
def get_staff_availability(staff_id):
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    # Verificar que el staff existe y pertenece a un establecimiento del proveedor
    staff_member = Staff.query.get(staff_id)
    if not staff_member or staff_member.establishment.provider_id != provider_id:
        return jsonify({"msg": "Miembro del staff no encontrado o no te pertenece."}), 404

    # Obtenemos las reglas a través de la relación
    rules = staff_member.availability_rules.order_by(StaffAvailabilityRule.dia_semana, StaffAvailabilityRule.hora_inicio).all()
    return jsonify([rule.to_dict() for rule in rules]), 200

# --- RUTA PARA CREAR UN NUEVO HORARIO PARA UN EMPLEADO ---
@staff_availability_bp.route('/staff/<int:staff_id>/availability', methods=['POST'])
@jwt_required()
def add_staff_availability_rule(staff_id):
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422
    
    staff_member = Staff.query.get(staff_id)
    if not staff_member or staff_member.establishment.provider_id != provider_id:
        return jsonify({"msg": "Miembro del staff no encontrado o no te pertenece."}), 404
        
    data = request.get_json()
    required_fields = ['dia_semana', 'hora_inicio', 'hora_fin']
    if not data or any(field not in data for field in required_fields):
        return jsonify({"msg": f"Faltan datos requeridos: {', '.join(required_fields)}"}), 400
        
    try:
        new_rule = StaffAvailabilityRule(
            staff_id=staff_id,
            dia_semana=data['dia_semana'].upper(),
            hora_inicio=data['hora_inicio'],
            hora_fin=data['hora_fin']
        )
        db.session.add(new_rule)
        db.session.commit()
        return jsonify(new_rule.to_dict()), 201
    except ValueError as ve:
        db.session.rollback()
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear regla de disponibilidad para staff {staff_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al crear la regla."}), 500
    
# --- NUEVA RUTA PARA ACTUALIZAR UN HORARIO DE STAFF ---
@staff_availability_bp.route('/staff-availability/<int:rule_id>', methods=['PUT'])
@jwt_required()
def update_staff_availability_rule(rule_id):
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    rule = StaffAvailabilityRule.query.get(rule_id)
    if not rule or rule.staff_member.establishment.provider_id != provider_id:
        return jsonify({"msg": "Regla no encontrada o no te pertenece."}), 404

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos."}), 400
        
    try:
        if 'dia_semana' in data: rule.dia_semana = data['dia_semana'].upper()
        if 'hora_inicio' in data: rule.hora_inicio = data['hora_inicio']
        if 'hora_fin' in data: rule.hora_fin = data['hora_fin']
        
        db.session.commit()
        return jsonify(rule.to_dict()), 200
    except ValueError as ve:
        db.session.rollback()
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error actualizando regla de staff {rule_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al actualizar."}), 500

# --- NUEVA RUTA PARA ELIMINAR UN HORARIO DE STAFF ---
@staff_availability_bp.route('/staff-availability/<int:rule_id>', methods=['DELETE'])
@jwt_required()
def delete_staff_availability_rule(rule_id):
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    rule = StaffAvailabilityRule.query.get(rule_id)
    if not rule or rule.staff_member.establishment.provider_id != provider_id:
        return jsonify({"msg": "Regla no encontrada o no te pertenece."}), 404
        
    try:
        db.session.delete(rule)
        db.session.commit()
        return jsonify({"msg": "Horario eliminado correctamente."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error eliminando regla de staff {rule_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al eliminar."}), 500
