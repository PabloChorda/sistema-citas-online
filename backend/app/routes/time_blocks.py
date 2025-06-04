# backend/app/routes/time_blocks.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, time
from app import db
from app.models import TimeBlock, User

bp = Blueprint('time_blocks', __name__)

@bp.route('', methods=['POST'])
@jwt_required()
def create_time_block():
    """
    POST /time-blocks
    =================

    🔐 Ruta protegida que permite a un proveedor autenticado crear un bloque de tiempo (disponible o no disponible)
    en su calendario.

    Este endpoint sirve para marcar disponibilidad o indisponibilidad específica en momentos concretos, complementando
    la disponibilidad recurrente semanal.

    Requisitos:
    -----------
    - Usuario autenticado mediante JWT.
    - Usuario con rol "provider".
    - El proveedor debe tener un perfil creado.

    Cuerpo JSON requerido:
    ----------------------
    {
        "start_datetime": "2025-06-01T09:00:00+02:00",  # Obligatorio
        "end_datetime": "2025-06-01T11:00:00+02:00",    # Obligatorio
        "is_available": false,                          # Opcional (por defecto: false)
        "reason": "Vacaciones"                          # Opcional (texto explicativo)
    }

    Notas importantes:
    ------------------
    - Los campos `start_datetime` y `end_datetime` deben incluir zona horaria (ej: `+02:00` o `Z`).
    - `start_datetime` debe ser anterior a `end_datetime`.
    - `is_available` debe ser booleano (true / false).

    Respuestas:
    -----------
    ✅ 201 Created:
        {
            "msg": "Bloque de tiempo creado exitosamente",
            "time_block": { ... }
        }

    ⚠️ 400 Bad Request:
        - Falta alguno de los campos obligatorios.
        - Fechas mal formateadas o sin zona horaria.
        - `is_available` no es booleano.
        - `start_datetime` no es anterior a `end_datetime`.

    ⚠️ 403 Forbidden:
        - El usuario autenticado no es proveedor.

    ⚠️ 404 Not Found:
        - El usuario autenticado no tiene perfil de proveedor.

    ❌ 422 Unprocessable Entity:
        - El token JWT es inválido.

    ❌ 500 Internal Server Error:
        - Fallo inesperado en la base de datos o validaciones del modelo.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        current_app.logger.error(f"POST /time-blocks: Identidad del token inválida '{current_user_id_str}'")
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} intentando crear TimeBlock.")

    if not user:
        current_app.logger.warning(f"POST /time-blocks: Usuario del token no encontrado (ID: {current_user_id_int})")
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        current_app.logger.warning(f"POST /time-blocks: Usuario ID {user.user_id} no es proveedor (rol: {user.role})")
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden crear bloques de tiempo"}), 403
    if not user.provider_profile:
        current_app.logger.error(f"POST /time-blocks: Usuario proveedor (ID: {user.user_id}) no tiene un perfil.")
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 400

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se enviaron datos"}), 400

    start_datetime_str = data.get('start_datetime')
    end_datetime_str = data.get('end_datetime')
    is_available = data.get('is_available', False) # Default a False (no disponible) si no se especifica
    reason = data.get('reason')

    if not start_datetime_str or not end_datetime_str:
        return jsonify({"msg": "Faltan datos requeridos: start_datetime, end_datetime"}), 400
    
    if not isinstance(is_available, bool):
        return jsonify({"msg": "is_available debe ser un valor booleano (true/false)"}), 400

    try:
        # Intenta parsear las fechas. datetime.fromisoformat() maneja bien las zonas horarias si están en el string.
        # Si no tienen zona horaria, se asumen como "naive", lo cual podría ser problemático
        # si tu base de datos espera "aware" datetimes.
        # El modelo DateTime(timezone=True) espera datetimes "aware".
        # Es RECOMENDABLE que el frontend envíe los datetimes con información de zona horaria (ej. Z para UTC o +/-HH:MM)
        start_datetime_obj = datetime.fromisoformat(start_datetime_str)
        end_datetime_obj = datetime.fromisoformat(end_datetime_str)
    except ValueError:
        return jsonify({"msg": "Formato de start_datetime o end_datetime inválido. Usar formato ISO 8601 (ej. YYYY-MM-DDTHH:MM:SSZ o YYYY-MM-DDTHH:MM:SS+/-HH:MM)"}), 400

    # Validar que los datetimes sean "aware" (tengan zona horaria) si tu DB lo requiere
    # (DateTime(timezone=True) en el modelo lo sugiere)
    if start_datetime_obj.tzinfo is None or end_datetime_obj.tzinfo is None:
        # Podrías asumir UTC por defecto si son naive, o devolver un error.
        # Por ahora, devolvamos un error para forzar que el cliente envíe la info de timezone.
        # Alternativamente, podrías hacer:
        # from datetime import timezone
        # if start_datetime_obj.tzinfo is None: start_datetime_obj = start_datetime_obj.replace(tzinfo=timezone.utc)
        # if end_datetime_obj.tzinfo is None: end_datetime_obj = end_datetime_obj.replace(tzinfo=timezone.utc)
        current_app.logger.warning(f"POST /time-blocks: start_datetime o end_datetime recibidos sin información de zona horaria.")
        return jsonify({"msg": "start_datetime y end_datetime deben incluir información de zona horaria (ej. 'Z' para UTC o +/-HH:MM)."}), 400


    if start_datetime_obj >= end_datetime_obj:
        return jsonify({"msg": "start_datetime debe ser anterior a end_datetime"}), 400

    new_time_block = TimeBlock(
        provider_id=user.provider_profile.provider_id,
        start_datetime=start_datetime_obj,
        end_datetime=end_datetime_obj,
        is_available=is_available,
        reason=reason
    )

    try:
        db.session.add(new_time_block)
        db.session.commit()
        current_app.logger.info(f"Usuario ID {user.user_id} creó exitosamente TimeBlock ID {new_time_block.id}")
        return jsonify({"msg": "Bloque de tiempo creado exitosamente", "time_block": new_time_block.to_dict()}), 201
    except ValueError as ve: # Capturar ValueErrors de los validadores del modelo
        db.session.rollback()
        current_app.logger.error(f"Error de validación al crear TimeBlock: {ve}")
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear TimeBlock: {e}\nTraceback: {e.__traceback__}")
        return jsonify({"msg": "Error interno al crear el bloque de tiempo", "error_details": str(e)}), 500

@bp.route('', methods=['GET'])
@jwt_required()
def get_time_blocks():
    """
    GET /time-blocks
    =================

    🔐 Ruta protegida que permite a un proveedor autenticado obtener la lista de sus bloques de tiempo
    (disponibles o no disponibles).

    Esta información es útil para visualizar y gestionar la disponibilidad puntual definida por el proveedor.

    Requisitos:
    -----------
    - Usuario autenticado mediante JWT.
    - Usuario con rol "provider".
    - El proveedor debe tener un perfil creado.

    Parámetros opcionales (query string):
    -------------------------------------
    (Nota: actualmente comentados en el código, pero listos para habilitar)
    - `start_date`: Filtra bloques cuyo `start_datetime` sea igual o posterior a la fecha dada (formato YYYY-MM-DD).
    - `end_date`: Filtra bloques cuyo `end_datetime` sea anterior a la fecha dada (formato YYYY-MM-DD).

    Respuesta:
    ----------
    ✅ 200 OK:
        [
            {
                "id": 1,
                "provider_id": 2,
                "start_datetime": "2025-06-01T09:00:00+02:00",
                "end_datetime": "2025-06-01T11:00:00+02:00",
                "is_available": false,
                "reason": "Vacaciones"
            },
            ...
        ]

    ⚠️ 400 Bad Request:
        - (Si se habilitan los filtros por fecha y están mal formateados).

    ⚠️ 403 Forbidden:
        - El usuario autenticado no es proveedor.

    ⚠️ 404 Not Found:
        - El usuario autenticado no tiene perfil de proveedor.

    ❌ 422 Unprocessable Entity:
        - El token JWT es inválido.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} solicitando sus TimeBlocks.")

    if not user:
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden ver sus bloques de tiempo"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado para este usuario"}), 400

    # Opcional: Añadir filtros por fecha si se desea
    # start_date_filter_str = request.args.get('start_date') # ej. YYYY-MM-DD
    # end_date_filter_str = request.args.get('end_date')     # ej. YYYY-MM-DD
    
    query = user.provider_profile.time_blocks # Esto es un BaseQuery (lazy='dynamic')

    # Ejemplo de cómo podrías filtrar (necesitarías parsear las fechas y manejar errores)
    # if start_date_filter_str:
    #     try:
    #         start_filter = datetime.strptime(start_date_filter_str, '%Y-%m-%d').date()
    #         # Ajustar para que el filtro incluya todo el día o comparar con la parte de fecha de start_datetime
    #         # Por simplicidad, aquí podríamos filtrar si el start_datetime del bloque es >= start_filter
    #         query = query.filter(TimeBlock.start_datetime >= datetime.combine(start_filter, datetime.min.time()))
    #     except ValueError:
    #         return jsonify({"msg": "Formato de start_date inválido, usar YYYY-MM-DD"}), 400
    # if end_date_filter_str:
    #     try:
    #         end_filter = datetime.strptime(end_date_filter_str, '%Y-%m-%d').date()
    #         # Ajustar para que el filtro incluya todo el día o comparar con la parte de fecha de end_datetime
    #         # Por simplicidad, aquí podríamos filtrar si el end_datetime del bloque es <= end_filter + 1 día (para incluir todo el día)
    #         from datetime import timedelta
    #         query = query.filter(TimeBlock.end_datetime < datetime.combine(end_filter + timedelta(days=1), datetime.min.time()))
    #     except ValueError:
    #         return jsonify({"msg": "Formato de end_date inválido, usar YYYY-MM-DD"}), 400

    time_blocks_list = query.order_by(TimeBlock.start_datetime).all()
    
    return jsonify([block.to_dict() for block in time_blocks_list]), 200

@bp.route('/<int:block_id>', methods=['DELETE'])
@jwt_required()
def delete_time_block(block_id):
    """
    DELETE /time-blocks/<block_id>
    ==============================

    🔐 Ruta protegida que permite a un proveedor autenticado eliminar uno de sus bloques de tiempo personalizados.

    Esta operación se utiliza para eliminar bloques de disponibilidad o no disponibilidad previamente definidos
    (por ejemplo, cancelación de vacaciones o cambios en la agenda).

    Requisitos:
    -----------
    - Usuario autenticado mediante JWT.
    - Usuario con rol "provider".
    - El proveedor debe tener un perfil asociado.
    - El bloque debe existir y pertenecer al proveedor autenticado.

    Parámetros de ruta:
    -------------------
    - `block_id` (int): ID del bloque de tiempo a eliminar.

    Respuestas:
    -----------
    ✅ 200 OK:
        {
            "msg": "Bloque de tiempo eliminado exitosamente"
        }

    ⚠️ 403 Forbidden:
        - El usuario no es proveedor.
        - El bloque no pertenece al proveedor autenticado.

    ⚠️ 404 Not Found:
        - Usuario no encontrado.
        - Perfil de proveedor no encontrado.
        - Bloque de tiempo con `block_id` no existe.

    ❌ 422 Unprocessable Entity:
        - El token JWT contiene una identidad inválida.

    ❌ 500 Internal Server Error:
        - Error inesperado durante la eliminación en base de datos.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} intentando borrar TimeBlock ID {block_id}")

    if not user:
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden eliminar bloques de tiempo"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado"}), 400

    time_block = TimeBlock.query.get(block_id)
    if not time_block:
        return jsonify({"msg": "Bloque de tiempo no encontrado para eliminar"}), 404
    
    if time_block.provider_id != user.provider_profile.provider_id:
        return jsonify({"msg": "Acceso denegado: no puede eliminar un bloque de tiempo que no le pertenece"}), 403

    try:
        db.session.delete(time_block)
        db.session.commit()
        current_app.logger.info(f"Usuario ID {user.user_id} eliminó exitosamente TimeBlock ID {block_id}")
        return jsonify({"msg": "Bloque de tiempo eliminado exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al eliminar TimeBlock ID {block_id}: {e}")
        return jsonify({"msg": "Error interno al eliminar el bloque de tiempo", "error_details": str(e)}), 500

@bp.route('/<int:block_id>', methods=['PUT'])
@jwt_required()
def update_time_block(block_id):
    """
    PUT /time-blocks/<block_id>
    ============================

    🔐 Ruta protegida que permite a un proveedor autenticado actualizar uno de sus bloques de tiempo personalizados.

    Los bloques de tiempo permiten definir intervalos específicos de disponibilidad o no disponibilidad. 
    Este endpoint permite actualizar campos como el inicio, fin, si está disponible y el motivo del bloqueo.

    Requisitos:
    -----------
    - Usuario autenticado mediante JWT.
    - Usuario con rol "provider".
    - El bloque debe existir y pertenecer al proveedor autenticado.

    Parámetros de ruta:
    -------------------
    - `block_id` (int): ID del bloque de tiempo a actualizar.

    Cuerpo de la solicitud (JSON):
    ------------------------------
    - `start_datetime` (str, opcional): Fecha y hora de inicio en formato ISO 8601 (con zona horaria).
    - `end_datetime` (str, opcional): Fecha y hora de fin en formato ISO 8601 (con zona horaria).
    - `is_available` (bool, opcional): Si el bloque indica disponibilidad o no.
    - `reason` (str | null, opcional): Razón del bloqueo, puede ser `null`.

    Reglas de validación:
    ---------------------
    - `start_datetime` debe ser anterior a `end_datetime`.
    - Ambos deben incluir zona horaria.
    - `is_available` debe ser booleano.

    Respuestas:
    -----------
    ✅ 200 OK:
        - Cuando el bloque se actualiza exitosamente.
        - Cuando los datos enviados no modifican el bloque (sin cambios efectivos).

    ⚠️ 400 Bad Request:
        - Datos inválidos (ej. fechas mal formateadas, zonas horarias faltantes, etc.).
        - No se proporcionaron campos válidos para actualizar.

    ⚠️ 403 Forbidden:
        - El usuario no es proveedor o el bloque no le pertenece.

    ⚠️ 404 Not Found:
        - Usuario, perfil o bloque no encontrado.

    ❌ 422 Unprocessable Entity:
        - Token inválido (identidad no es un entero).

    ❌ 500 Internal Server Error:
        - Fallo inesperado durante la actualización.
    """

    current_user_id_str = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id_str)
    except ValueError:
        return jsonify({"msg": "Identidad del token inválida"}), 422
        
    user = User.query.get(current_user_id_int)
    current_app.logger.info(f"Usuario ID {current_user_id_int} intentando actualizar TimeBlock ID {block_id}")

    if not user:
        return jsonify({"msg": "Usuario del token no encontrado"}), 404
    if user.role != 'provider':
        return jsonify({"msg": "Acceso denegado: solo los proveedores pueden actualizar bloques de tiempo"}), 403
    if not user.provider_profile:
        return jsonify({"msg": "Perfil de proveedor no encontrado"}), 400

    time_block = TimeBlock.query.get(block_id)
    if not time_block:
        return jsonify({"msg": "Bloque de tiempo no encontrado para actualizar"}), 404
    
    if time_block.provider_id != user.provider_profile.provider_id:
        return jsonify({"msg": "Acceso denegado: no puede actualizar un bloque que no le pertenece"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "No se enviaron datos para actualizar"}), 400

    final_start_datetime = time_block.start_datetime
    final_end_datetime = time_block.end_datetime
    updated_fields_count = 0

    if 'start_datetime' in data:
        try:
            dt_obj = datetime.fromisoformat(data['start_datetime'])
            if dt_obj.tzinfo is None: # Forzar zona horaria si es naive
                return jsonify({"msg": "start_datetime debe incluir información de zona horaria."}), 400
            final_start_datetime = dt_obj
            updated_fields_count += 1
        except ValueError:
            return jsonify({"msg": "Formato de start_datetime inválido."}), 400
            
    if 'end_datetime' in data:
        try:
            dt_obj = datetime.fromisoformat(data['end_datetime'])
            if dt_obj.tzinfo is None: # Forzar zona horaria si es naive
                return jsonify({"msg": "end_datetime debe incluir información de zona horaria."}), 400
            final_end_datetime = dt_obj
            updated_fields_count += 1
        except ValueError:
            return jsonify({"msg": "Formato de end_datetime inválido."}), 400

    if final_start_datetime >= final_end_datetime:
        return jsonify({"msg": "start_datetime debe ser anterior a end_datetime"}), 400

    # Asignar y dejar que los validadores del modelo actúen
    time_block.start_datetime = final_start_datetime
    time_block.end_datetime = final_end_datetime

    if 'is_available' in data:
        if not isinstance(data['is_available'], bool):
            return jsonify({"msg": "is_available debe ser un valor booleano"}), 400
        time_block.is_available = data['is_available']
        updated_fields_count += 1
    
    if 'reason' in data: # Permite establecer reason a None/null o a un string
        time_block.reason = data['reason']
        updated_fields_count += 1
    
    if not updated_fields_count and data:
         return jsonify({"msg": "No se proporcionaron campos válidos para actualizar."}), 400
    if not db.session.is_modified(time_block) and updated_fields_count > 0:
        return jsonify({"msg": "Los datos proporcionados no modifican el bloque de tiempo actual.", "time_block": time_block.to_dict()}), 200

    try:
        db.session.commit()
        current_app.logger.info(f"Usuario ID {user.user_id} actualizó exitosamente TimeBlock ID {block_id}")
        return jsonify({"msg": "Bloque de tiempo actualizado exitosamente", "time_block": time_block.to_dict()}), 200
    except ValueError as ve:
        db.session.rollback()
        return jsonify({"msg": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al actualizar TimeBlock ID {block_id}: {e}")
        return jsonify({"msg": "Error interno al actualizar el bloque de tiempo", "error_details": str(e)}), 500
