# backend/app/routes/availability.py

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
#from datetime import time
from app import db
from app.models import AvailabilityRule, Establishment, User

# Renombramos el blueprint para mayor claridad, ya que está en su propio archivo.
availability_bp = Blueprint('availability', __name__)

def get_provider_id_from_jwt():
    """Helper para obtener el ID del provider desde el token."""
    try:
        return int(get_jwt_identity())
    except (ValueError, TypeError):
        return None

@availability_bp.route('/establishments/<int:establishment_id>/availability', methods=['POST'])
@jwt_required()
def create_availability_rule(establishment_id):
    """
    POST /establishments/<id>/availability
    Crea una regla de disponibilidad para un establecimiento específico.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    establishment = Establishment.query.get(establishment_id)
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado"}), 404

    if establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado. No eres el propietario de este establecimiento."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se enviaron datos o JSON inválido"}), 400

    required_fields = ['dia_semana', 'hora_inicio', 'hora_fin']
    if any(field not in data for field in required_fields):
        return jsonify({"msg": f"Faltan datos requeridos: {', '.join(required_fields)}"}), 400

    try:
        # Pasamos los strings directamente. El modelo se encarga de la validación.
        new_rule = AvailabilityRule(
            establishment_id=establishment_id,
            dia_semana=data['dia_semana'].upper(),
            hora_inicio=data['hora_inicio'],
            hora_fin=data['hora_fin']
        )
        db.session.add(new_rule)
        db.session.commit()
        
        # Devolvemos un 201 Created con los datos de la nueva regla
        return jsonify({
            "msg": "Regla de disponibilidad creada exitosamente",
            "rule": new_rule.to_dict()
        }), 201
        
    except ValueError as ve:
        db.session.rollback()
        # Este error viene de los validadores del modelo
        current_app.logger.warning(f"Error de validación al crear regla de disponibilidad: {ve}")
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        # Cualquier otro error (ej. de la base de datos)
        current_app.logger.error(f"Error inesperado al crear regla para est. {establishment_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al crear la regla."}), 500


@availability_bp.route('/establishments/<int:establishment_id>/availability', methods=['GET'])
@jwt_required()
def get_availability_rules(establishment_id):
    """
    GET /availability-rules
    ========================

    🔐 Ruta protegida que devuelve la lista de reglas de disponibilidad recurrente
    asociadas al proveedor autenticado.

    Cada regla indica un día de la semana y un rango horario en el que el proveedor está disponible.

    Requisitos:
    -----------
    - El usuario debe estar autenticado mediante JWT.
    - El usuario debe tener el rol "provider".
    - El proveedor debe tener un perfil asociado.

    Respuesta:
    ----------
    ✅ 200 OK:
        [
            {
                "id": 1,
                "day_of_week": "MONDAY", // O el valor string del ENUM
                "start_time": "09:00:00",
                "end_time": "17:00:00"
                // ... otros campos del to_dict() ...
            },
            // ... más reglas ...
        ]

    ⚠️ 403 Forbidden:
        - El usuario no tiene rol de proveedor o no está autorizado.

    ⚠️ 404 Not Found:
        - El proveedor no tiene un perfil asociado o el usuario del token no existe.

    ❌ 422 Unprocessable Entity:
        - Identidad del token inválida.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    establishment = Establishment.query.filter_by(id=establishment_id, provider_id=provider_id).first()
    if not establishment:
        return jsonify({"msg": "Establecimiento no encontrado o acceso denegado."}), 404

    rules = establishment.availability_rules.order_by(AvailabilityRule.hora_inicio).all()
    return jsonify([rule.to_dict() for rule in rules]), 200


@availability_bp.route('/availability/<int:rule_id>', methods=['PUT'])
@jwt_required()
def update_availability_rule(rule_id):
    """
    PUT /availability-rules/<int:rule_id>
    =====================================

    🔐 Ruta protegida que permite a un proveedor autenticado actualizar una regla de disponibilidad existente.

    Solo el proveedor que creó la regla puede modificarla. Los campos que pueden actualizarse son:
    - day_of_week (str): Día de la semana (ej: "MONDAY", "TUESDAY", etc.)
    - start_time (str): Hora de inicio en formato HH:MM o HH:MM:SS.
    - end_time (str): Hora de fin en formato HH:MM o HH:MM:SS.

    Parámetros:
    -----------
    - rule_id (int): ID de la regla a actualizar.
    - JSON Body (al menos uno requerido):
        {
            "day_of_week": "MONDAY",
            "start_time": "09:00",
            "end_time": "17:00"
        }

    Requisitos:
    -----------
    - Usuario autenticado con JWT.
    - Usuario con rol "provider".
    - El ID de la regla debe pertenecer al proveedor autenticado.

    Respuestas:
    -----------
    ✅ 200 OK:
        {
            "msg": "Regla de disponibilidad actualizada exitosamente",
            "rule": { ... }
        }

    ⚠️ 200 OK (sin cambios):
        {
            "msg": "Los datos proporcionados no modifican la regla actual.",
            "rule": { ... }
        }

    ⚠️ 400 Bad Request:
        - No se proporcionaron datos válidos.
        - day_of_week inválido.
        - Formato de hora incorrecto.
        - start_time posterior o igual a end_time.

    ⚠️ 403 Forbidden:
        - El usuario no es proveedor o intenta modificar reglas ajenas.

    ⚠️ 404 Not Found:
        - Usuario o regla no encontrada.

    ❌ 422 Unprocessable Entity:
        - La identidad del JWT no es válida.

    ❌ 500 Internal Server Error:
        - Error inesperado al guardar cambios.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    rule = AvailabilityRule.query.get(rule_id)
    if not rule:
        return jsonify({"msg": "Regla de disponibilidad no encontrada."}), 404

    if rule.establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado."}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se recibieron datos."}), 400

    try:
        # Asignamos los valores directamente. El validador del modelo hará todo el trabajo.
        if 'dia_semana' in data:
            rule.dia_semana = data['dia_semana'].upper()
        if 'hora_inicio' in data:
            rule.hora_inicio = data['hora_inicio']
        if 'hora_fin' in data:
            rule.hora_fin = data['hora_fin']
        if 'activo' in data and isinstance(data['activo'], bool):
            rule.activo = data['activo']
        
        # El validador del modelo ya ha hecho la comprobación del rango de horas.
        # Si hubiera un error, ya habría lanzado una excepción.
        db.session.commit()
        return jsonify({"msg": "Regla actualizada exitosamente", "rule": rule.to_dict()}), 200
        
    except ValueError as ve:
        # Capturamos los errores de nuestro validador personalizado.
        db.session.rollback()
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error actualizando regla {rule_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al actualizar."}), 500


@availability_bp.route('/availability/<int:rule_id>', methods=['DELETE'])
@jwt_required()
def delete_availability_rule(rule_id):
    """
    DELETE /availability-rules/<int:rule_id>
    ========================================

    🔐 Ruta protegida que permite a un proveedor eliminar una regla de disponibilidad recurrente
    previamente creada.

    Solo el proveedor que creó la regla puede eliminarla.

    Parámetros:
    -----------
    - rule_id (int): ID de la regla de disponibilidad a eliminar.

    Requisitos:
    -----------
    - El usuario debe estar autenticado mediante JWT.
    - El usuario debe tener rol "provider".
    - La regla debe pertenecer al proveedor autenticado.

    Respuesta:
    ----------
    ✅ 200 OK:
        {
            "msg": "Regla de disponibilidad eliminada exitosamente"
        }

    ⚠️ 400 Bad Request:
        - El proveedor no tiene perfil asociado.

    ⚠️ 403 Forbidden:
        - El usuario no es proveedor o intenta eliminar una regla ajena.

    ⚠️ 404 Not Found:
        - La regla de disponibilidad no existe.
        - El usuario no existe en base de datos.

    ❌ 422 Unprocessable Entity:
        - La identidad extraída del token no es válida.

    ❌ 500 Internal Server Error:
        - Error inesperado al intentar eliminar la regla.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    rule = AvailabilityRule.query.get(rule_id)
    if not rule:
        return jsonify({"msg": "Regla no encontrada."}), 404

    if rule.establishment.provider_id != provider_id:
        return jsonify({"msg": "Acceso denegado."}), 403

    try:
        db.session.delete(rule)
        db.session.commit()
        return jsonify({"msg": "Regla de disponibilidad eliminada correctamente."}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error eliminando regla {rule_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al eliminar."}), 500