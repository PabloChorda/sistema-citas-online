# backend/app/routes/availability.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import time
from app import db
from app.models import AvailabilityRule, User
from .helpers import VALID_DAYS_OF_WEEK

bp = Blueprint('availability', __name__)

# --- Endpoints para AvailabilityRule (Disponibilidad Recurrente del Proveedor) ---
@bp.route('/rules', methods=['POST'])
@jwt_required()
def create_availability_rule():
    """
    POST /availability-rules
    =========================

    🔐 Ruta protegida para crear una regla de disponibilidad recurrente para un proveedor.

    Esta regla define en qué días de la semana y horarios un proveedor estará disponible.

    Requisitos:
    -----------
    - El usuario debe estar autenticado mediante JWT.
    - El usuario debe tener el rol "provider".
    - El proveedor debe tener un perfil asociado.

    JSON esperado (Body):
    ----------------------
    {
        "day_of_week": "MONDAY",          # Día de la semana (mayúsculas preferidas, e.g. MONDAY, TUESDAY...)
        "start_time": "09:00",            # Hora de inicio en formato HH:MM o HH:MM:SS
        "end_time": "17:00"               # Hora de fin en formato HH:MM o HH:MM:SS
    }

    Días válidos:
    -------------
    - MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY  # (Asegúrate que coincida con tu constante VALID_DAYS_OF_WEEK)

    Respuestas:
    -----------
    ✅ 201 Created:
        {
            "msg": "Regla de disponibilidad creada exitosamente",
            "rule": { ... } # Objeto de la regla creada
        }

    ⚠️ 400 Bad Request:
        - Faltan campos requeridos.
        - Formato de hora inválido.
        - day_of_week no válido.
        - start_time es posterior o igual a end_time.
        - El usuario no tiene perfil de proveedor.

    ⚠️ 403 Forbidden:
        - El usuario no tiene rol de proveedor.

    ❌ 422 Unprocessable Entity:
        - Identidad del token inválida.

    ❌ 500 Internal Server Error:
        - Fallo al guardar en la base de datos.
    """
    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    if not user or user.role != 'provider':
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden crear reglas de disponibilidad"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 400

    data = request.get_json(force=True, silent=True)
    if not data: 
        return jsonify({"msg": "No se enviaron datos o JSON inválido"}), 400

    day_of_week_from_request = data.get('day_of_week') 
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')

    if day_of_week_from_request is None or start_time_str is None or end_time_str is None:
        return jsonify({"msg": "Faltan datos requeridos: day_of_week, start_time, end_time"}), 400
    
    if not isinstance(day_of_week_from_request, str) or day_of_week_from_request.upper() not in VALID_DAYS_OF_WEEK:
        return jsonify({"msg": f"day_of_week debe ser uno de los siguientes valores: {', '.join(VALID_DAYS_OF_WEEK)}"}), 400
    
    day_of_week_for_db = day_of_week_from_request.upper()

    try:
        # Asumiendo que 'time' está importado de 'from datetime import time' al principio del archivo
        start_time_obj = time.fromisoformat(start_time_str)
        end_time_obj = time.fromisoformat(end_time_str)
    except ValueError:
        return jsonify({"msg": "Formato de start_time o end_time inválido. Usar HH:MM o HH:MM:SS"}), 400

    if start_time_obj >= end_time_obj:
        return jsonify({"msg": "start_time debe ser anterior a end_time"}), 400

    new_rule = AvailabilityRule(
        provider_id=user.provider_profile.provider_id,
        day_of_week=day_of_week_for_db,
        start_time=start_time_obj,
        end_time=end_time_obj
    )
    try:
        db.session.add(new_rule)
        db.session.commit()
        return jsonify({"msg": "Regla de disponibilidad creada exitosamente", "rule": new_rule.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear regla de disponibilidad: {e}", exc_info=True) # exc_info=True para traceback completo en logs
        return jsonify({"msg": "Error interno al crear la regla de disponibilidad."}), 500

@bp.route('/rules', methods=['GET'])
@jwt_required()
def get_availability_rules():
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
    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)

    if not user: # Chequeo añadido por consistencia
        return jsonify({"msg": "Usuario del token no encontrado."}), 404
    if user.role != 'provider':
        return jsonify({"msg": "Acceso denegado."}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado."}), 404

    rules = user.provider_profile.availability_rules.order_by(AvailabilityRule.day_of_week, AvailabilityRule.start_time).all()
    return jsonify([rule.to_dict() for rule in rules]), 200

# El endpoint DELETE que ya habías añadido (está correcto):
@bp.route('/rules/<int:rule_id>', methods=['DELETE'])
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

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"DELETE /availability-rules: Identidad del token inválida '{current_user_id_str}'")
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} intentando borrar AvailabilityRule ID {rule_id}")

    if not user: 
        current_app.logger.warning(f"DELETE /availability-rules: Usuario del token no encontrado (ID: {current_user_id_int})")
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        current_app.logger.warning(f"DELETE /availability-rules: Usuario ID {user.user_id} no es proveedor (rol: {user.role})")
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden eliminar reglas de disponibilidad"}), 403
    if not user.provider_profile:
        current_app.logger.error(f"DELETE /availability-rules: Usuario proveedor (ID: {user.user_id}) no tiene un perfil de proveedor asociado.")
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 400 

    rule = AvailabilityRule.query.get(rule_id)
    if not rule:
        current_app.logger.info(f"DELETE /availability-rules: Regla de disponibilidad ID {rule_id} no encontrada.")
        return jsonify({"msg": "Regla de disponibilidad no encontrada para eliminar"}), 404
    
    if rule.provider_id != user.provider_profile.provider_id:
        current_app.logger.warning(f"DELETE /availability-rules: Usuario ID {user.user_id} intentó borrar regla ID {rule_id} que no le pertenece (pertenece a Provider ID {rule.provider_id})")
        return jsonify({"msg": "Acceso denegado: no puede eliminar una regla que no le pertenece"}), 403

    try:
        db.session.delete(rule)
        db.session.commit()
        current_app.logger.info(f"Usuario ID {user.user_id} eliminó exitosamente AvailabilityRule ID {rule_id}")
        return jsonify({"msg": "Regla de disponibilidad eliminada exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al eliminar regla de disponibilidad ID {rule_id}: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno al eliminar la regla de disponibilidad", "error_details": str(e)}), 500
    
@bp.route('/rules/<int:rule_id>', methods=['PUT'])
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

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"PUT /availability-rules: Identidad del token inválida '{current_user_id_str}'")
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} intentando actualizar AvailabilityRule ID {rule_id}")

    if not user:
        current_app.logger.warning(f"PUT /availability-rules: Usuario del token no encontrado (ID: {current_user_id_int})")
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        current_app.logger.warning(f"PUT /availability-rules: Usuario ID {user.user_id} no es proveedor (rol: {user.role})")
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden actualizar reglas"}), 403
    if not user.provider_profile:
        current_app.logger.error(f"PUT /availability-rules: Usuario proveedor (ID: {user.user_id}) no tiene un perfil.")
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 400

    rule = AvailabilityRule.query.get(rule_id)
    if not rule:
        current_app.logger.info(f"PUT /availability-rules: Regla ID {rule_id} no encontrada.")
        return jsonify({"msg": "Regla de disponibilidad no encontrada para actualizar"}), 404
    
    if rule.provider_id != user.provider_profile.provider_id:
        current_app.logger.warning(f"PUT /availability-rules: Usuario ID {user.user_id} intentó actualizar regla ID {rule_id} que no le pertenece.")
        return jsonify({"msg": "Acceso denegado: no puede actualizar una regla que no le pertenece"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se enviaron datos para actualizar"}), 400

    # Inicializar con los valores actuales de la regla
    # Estos se usarán para la validación final del rango y para la asignación.
    final_day_of_week = rule.day_of_week 
    final_start_time = rule.start_time
    final_end_time = rule.end_time
    updated_fields_count = 0 # Contador para saber si realmente se envió algún dato para actualizar

    if 'day_of_week' in data:
        day_of_week_from_request = data['day_of_week']
        if not isinstance(day_of_week_from_request, str) or day_of_week_from_request.upper() not in VALID_DAYS_OF_WEEK:
            return jsonify({"msg": f"day_of_week debe ser uno de: {', '.join(VALID_DAYS_OF_WEEK)}"}), 400
        final_day_of_week = day_of_week_from_request.upper()
        updated_fields_count += 1

    if 'start_time' in data:
        try:
            final_start_time = time.fromisoformat(data['start_time'])
            updated_fields_count += 1
        except ValueError:
            return jsonify({"msg": "Formato de start_time inválido. Usar HH:MM o HH:MM:SS"}), 400
    
    if 'end_time' in data:
        try:
            final_end_time = time.fromisoformat(data['end_time'])
            updated_fields_count += 1
        except ValueError:
            return jsonify({"msg": "Formato de end_time inválido. Usar HH:MM o HH:MM:SS"}), 400

    # Si no se envió ningún campo conocido en 'data' para actualizar.
    if not updated_fields_count and data: # 'data' no está vacío pero no contenía campos actualizables
        # Comprobar si hay otros campos desconocidos en data, o si simplemente no se envió nada útil
        # Si 'data' es un JSON vacío {}, updated_fields_count será 0 y 'data' será False,
        # por lo que el if de arriba (if not data:) ya lo habría capturado.
        # Este if es por si se envían campos que no son 'day_of_week', 'start_time', o 'end_time'.
        # Aunque, si solo se envían campos válidos pero con los mismos valores, updated_fields_count podría ser >0.
        # El check de "updated" abajo es más para la lógica de "realmente cambió algo?".
        pass # Se podría añadir lógica aquí si se quiere ser más estricto con campos desconocidos.

    # Validar el rango de tiempo ANTES de asignar a la regla
    if final_start_time >= final_end_time:
        return jsonify({"msg": "start_time debe ser anterior a end_time"}), 400
    
    # Asignar los valores finales a la regla.
    # Los validadores del modelo se dispararán aquí.
    rule.day_of_week = final_day_of_week
    rule.start_time = final_start_time 
    rule.end_time = final_end_time

    # Verificar si realmente hubo un cambio semántico después de las asignaciones.
    # db.session.is_modified(rule) podría ser útil aquí si los valores asignados
    # son diferentes de los originales.
    # Si updated_fields_count es 0 y data no estaba vacío, significa que no había campos válidos.
    # Pero si updated_fields_count > 0, significa que se intentó una actualización.
    
    if not db.session.is_modified(rule) and updated_fields_count > 0 : # Si se enviaron datos pero no modificaron el objeto
        return jsonify({"msg": "Los datos proporcionados no modifican la regla actual.", "rule": rule.to_dict()}), 200
    elif not updated_fields_count and data: # Si se enviaron datos, pero ninguno era un campo actualizable
         return jsonify({"msg": "No se proporcionaron campos válidos para actualizar."}), 400


    try:
        db.session.commit()
        current_app.logger.info(f"Usuario ID {user.user_id} actualizó exitosamente AvailabilityRule ID {rule_id}")
        return jsonify({"msg": "Regla de disponibilidad actualizada exitosamente", "rule": rule.to_dict()}), 200
    except ValueError as ve: # Captura específica de ValueErrors de los validadores del modelo
        db.session.rollback()
        current_app.logger.error(f"Error de validación al actualizar regla ID {rule_id}: {ve}")
        return jsonify({"msg": str(ve)}), 400 # Devuelve el mensaje del validador
    except Exception as e: 
        db.session.rollback()
        current_app.logger.error(f"Error interno al actualizar regla de disponibilidad ID {rule_id}: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno al actualizar la regla", "error_details": str(e)}), 500
    
