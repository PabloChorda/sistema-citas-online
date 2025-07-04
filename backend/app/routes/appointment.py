# backend/app/routes/appointment.py

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Appointment, Service, User
from datetime import datetime, timedelta

appointment_bp = Blueprint('appointment', __name__)

def get_user_id_from_jwt():
    try:
        return int(get_jwt_identity())
    except (ValueError, TypeError):
        return None

@appointment_bp.route('appointments', methods=['POST'])
@jwt_required()
def create_appointment():
    """
    POST /api/appointments
    =======================

    📆 Crea una nueva cita para un cliente autenticado.

    Este endpoint permite a un usuario con rol `client` reservar una cita para un servicio activo,
    en una franja horaria disponible y sin colisiones con otras reservas en el mismo establecimiento.

    Requisitos:
    -----------
    - El usuario debe estar autenticado mediante JWT.
    - El usuario debe tener rol `client`.
    - El servicio debe existir y estar activo.
    - La franja horaria debe estar libre (sin solapamientos con otras citas activas).

    Entrada (JSON):
    ---------------
    {
        "service_id": int,           # ID del servicio que se desea reservar.
        "start_time": str,           # Fecha/hora de inicio en formato ISO UTC (ej: "2025-07-01T10:00:00Z").
        "notes_client": str | null   # (Opcional) Notas que desea añadir el cliente.
    }

    Validaciones importantes:
    -------------------------
    - `service_id` debe ser un entero válido y referenciar un servicio activo.
    - `start_time` debe ser una fecha en formato ISO 8601 con zona horaria (ej. "Z" o "+00:00").
    - La cita no debe solaparse con otra ya existente en el mismo establecimiento.

    Respuestas:
    -----------
    ✅ 201 Created:
        - Cita creada exitosamente.
        - Devuelve los datos de la cita (`appointment.to_dict()`).

    ⚠️ 400 Bad Request:
        - Datos inválidos o faltantes (`service_id`, `start_time`).

    ⚠️ 403 Forbidden:
        - El usuario no tiene permiso (no es `client`).

    ⚠️ 404 Not Found:
        - El servicio no existe o está inactivo.

    ⚠️ 409 Conflict:
        - El slot solicitado ya está ocupado por otra cita.

    ❌ 422 Unprocessable Entity:
        - El token JWT es inválido o malformado.
    """
    user_id = get_user_id_from_jwt()
    if not user_id: return jsonify({"msg": "Token inválido"}), 422

    client = User.query.get(user_id)
    if not client or client.role != 'client':
        return jsonify({"msg": "Solo los clientes pueden crear citas."}), 403

    data = request.get_json()
    required_fields = ['service_id', 'start_time']
    if not data or any(f not in data for f in required_fields):
        return jsonify({"msg": f"Faltan datos requeridos: {', '.join(required_fields)}"}), 400

    try:
        service_id = int(data['service_id'])
        start_time_obj = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return jsonify({"msg": "Formato de service_id o start_time inválido."}), 400
    
    service = Service.query.get(service_id)
    if not service or not service.is_active:
        return jsonify({"msg": "Servicio no encontrado o inactivo."}), 404
        
    end_time_obj = start_time_obj + timedelta(minutes=service.duracion_minutos)

    # --- VALIDACIÓN DE SEGURIDAD FINAL ANTI-COLISIÓN ---
    overlapping = Appointment.query.join(Service).filter(
        Service.establishment_id == service.establishment_id,
        Appointment.start_time < end_time_obj,
        Appointment.end_time > start_time_obj,
        Appointment.estado.in_(['CONFIRMED', 'PENDING_PROVIDER'])
    ).first()

    if overlapping:
        return jsonify({"msg": "Este horario acaba de ser reservado. Por favor, elige otro."}), 409

    new_appointment = Appointment(
        user_id=user_id, service_id=service_id, start_time=start_time_obj,
        end_time=end_time_obj, estado='CONFIRMED', precio_final=service.precio,
        notas_cliente=data.get('notes_client')
    )
    db.session.add(new_appointment)
    db.session.commit()
    return jsonify(new_appointment.to_dict()), 201

@appointment_bp.route('appointments/client', methods=['GET'])
@jwt_required()
def get_client_appointments():
    """
    GET /api/appointments/client
    ============================

    📋 Obtiene el historial de citas del cliente autenticado.

    Devuelve una lista de citas ordenadas por fecha descendente (más recientes primero) 
    para el usuario autenticado con rol `client`.

    Requisitos:
    -----------
    - El usuario debe estar autenticado mediante JWT.
    - El usuario debe ser un cliente (rol `client`).

    Parámetros:
    -----------
    - Ninguno (el usuario se identifica vía JWT).

    Respuestas:
    -----------
    ✅ 200 OK:
        - Lista de citas del cliente (array de `appointment.to_dict()`).

    ❌ 422 Unprocessable Entity:
        - Token JWT inválido.
    """
    user_id = get_user_id_from_jwt()
    if not user_id: return jsonify({"msg": "Token inválido"}), 422

    appointments = Appointment.query.filter_by(user_id=user_id).order_by(Appointment.start_time.desc()).all()
    return jsonify([appt.to_dict() for appt in appointments]), 200

@appointment_bp.route('appointments/<int:appointment_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_appointment(appointment_id):
    """
    PUT /api/appointments/<appointment_id>/cancel
    =============================================

    ❌ Cancela una cita existente.

    Este endpoint permite cancelar una cita si el usuario autenticado es:
    - El cliente que reservó la cita.
    - El proveedor que gestiona el establecimiento donde se realizará.

    Requisitos:
    -----------
    - Autenticación vía JWT.
    - El usuario debe ser el cliente que reservó la cita o el proveedor propietario.

    Cambios aplicados:
    ------------------
    - El estado de la cita se actualiza a:
        - `CANCELLED_BY_CLIENT` si la cancelación la hace el cliente.
        - `CANCELLED_BY_PROVIDER` si la hace el proveedor.

    Respuestas:
    -----------
    ✅ 200 OK:
        - Cita cancelada exitosamente (estado actualizado).

    ⚠️ 400 Bad Request:
        - La cita ya estaba cancelada anteriormente.

    ⚠️ 403 Forbidden:
        - El usuario no tiene permisos para cancelar esta cita.

    ⚠️ 404 Not Found:
        - La cita no existe.

    ❌ 422 Unprocessable Entity:
        - Token JWT inválido.
    """
    user_id = get_user_id_from_jwt()
    if not user_id: return jsonify({"msg": "Token inválido"}), 422

    user = User.query.get(user_id)
    appointment = Appointment.query.get(appointment_id)

    if not appointment: return jsonify({"msg": "Cita no encontrada."}), 404

    is_client_owner = (user.role == 'client' and appointment.user_id == user_id)
    is_provider_owner = (user.role == 'provider' and appointment.service.establishment.provider_id == user_id)

    if not (is_client_owner or is_provider_owner):
        return jsonify({"msg": "No tienes permiso para cancelar esta cita."}), 403

    if str(appointment.estado).startswith('CANCELLED'):
        return jsonify({"msg": "Esta cita ya ha sido cancelada."}), 400

    new_status = 'CANCELLED_BY_CLIENT' if is_client_owner else 'CANCELLED_BY_PROVIDER'
    appointment.estado = new_status
    
    db.session.commit()
    return jsonify(appointment.to_dict()), 200
