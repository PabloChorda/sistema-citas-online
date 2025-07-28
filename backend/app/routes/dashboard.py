# backend/app/routes/dashboard.py

from flask import Blueprint, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Appointment, Service, Establishment
from sqlalchemy import func
from datetime import datetime, timedelta, timezone

dashboard_bp = Blueprint('dashboard', __name__)

def get_provider_id_from_jwt():
    """Helper para obtener el ID del provider desde el token JWT."""
    try:
        return int(get_jwt_identity())
    except (ValueError, TypeError):
        return None

# --- RUTA RESTAURADA A SU ESTADO FINAL ---
@dashboard_bp.route('/dashboard-summary', methods=['GET'])
@jwt_required() # <-- Restauramos la autenticación
def get_provider_dashboard_summary():
    """
    GET /api/provider/dashboard-summary
    Obtiene un resumen de datos para el panel de control del proveedor.
    """
    provider_id = get_provider_id_from_jwt()
    if not provider_id:
        return jsonify({"msg": "Identidad del token inválida"}), 422

    try:
        # Paso 1: Obtener los IDs de los establecimientos del proveedor
        establishment_ids_tuples = db.session.query(Establishment.id).filter_by(provider_id=provider_id).all()
        establishment_ids = [eid[0] for eid in establishment_ids_tuples]

        if not establishment_ids:
            return jsonify({
                "today_appointments": [],
                "upcoming_week_count": 0,
                "latest_booking": None,
            }), 200

        # Paso 2: Calcular las métricas
        now_utc = datetime.now(timezone.utc)
        start_of_today_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_today_utc = start_of_today_utc + timedelta(days=1)
        end_of_week_utc = start_of_today_utc + timedelta(days=7)

        # Citas para hoy
        today_appointments = Appointment.query.join(Service).filter(
            Service.establishment_id.in_(establishment_ids),
            Appointment.start_time >= start_of_today_utc,
            Appointment.start_time < end_of_today_utc,
            Appointment.estado == 'CONFIRMED'
        ).order_by(Appointment.start_time).all()

        # Conteo de citas para la semana
        upcoming_week_count = db.session.query(func.count(Appointment.id)).join(Service).filter(
            Service.establishment_id.in_(establishment_ids),
            Appointment.start_time >= now_utc,
            Appointment.start_time < end_of_week_utc,
            Appointment.estado == 'CONFIRMED'
        ).scalar() or 0

        # Última cita reservada
        latest_booking = Appointment.query.join(Service).filter(
            Service.establishment_id.in_(establishment_ids)
        ).order_by(Appointment.created_at.desc()).first()

        summary = {
            "today_appointments": [appt.to_dict() for appt in today_appointments],
            "upcoming_week_count": upcoming_week_count,
            "latest_booking": latest_booking.to_dict() if latest_booking else None,
        }
        
        return jsonify(summary), 200

    except Exception as e:
        current_app.logger.error(f"Error generando resumen para proveedor {provider_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al generar el resumen."}), 500