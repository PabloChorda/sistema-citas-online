#backend/app/routes/calendar.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from app.models import CalendarBlackout

# Igual que tus otros blueprints: SIN url_prefix aquí
calendar_bp = Blueprint("calendar", __name__)

@calendar_bp.get("/calendar/blackouts")
def list_blackouts():
    """
    GET /api/calendar/blackouts?establishment_id=...&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    """
    est_id = request.args.get("establishment_id", type=int)
    if not est_id:
        return jsonify({"msg": "Falta establishment_id"}), 400

    date_from = request.args.get("date_from")
    date_to   = request.args.get("date_to")

    q = CalendarBlackout.query.filter(CalendarBlackout.establishment_id == est_id)
    if date_from:
        df = datetime.fromisoformat(date_from).date()
        q = q.filter(CalendarBlackout.fecha >= df)
    if date_to:
        dt = datetime.fromisoformat(date_to).date()
        q = q.filter(CalendarBlackout.fecha <= dt)

    items = q.order_by(CalendarBlackout.fecha.asc()).all()
    return jsonify([b.to_dict() for b in items]), 200
