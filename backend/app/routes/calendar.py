# backend/app/routes/calendar.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from datetime import datetime, time as time_cls
from app import db
from app.models import CalendarBlackout, Establishment, User

# Igual que tus otros blueprints: SIN url_prefix aquí
# (se añade en create_app con app.register_blueprint(calendar_bp, url_prefix="/api"))
calendar_bp = Blueprint("calendar", __name__)

# ----------------- Helpers -----------------

def _parse_date(s: str):
    try:
        # Acepta "YYYY-MM-DD"
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        raise ValueError("Formato de fecha inválido. Usa 'YYYY-MM-DD'.")

def _parse_time(s: str):
    # Acepta "HH:MM" u "HH:MM:SS"
    try:
        parts = [int(p) for p in s.split(":")]
        if len(parts) == 2:
            h, m = parts
            sec = 0
        elif len(parts) == 3:
            h, m, sec = parts
        else:
            raise ValueError
        return time_cls(hour=h, minute=m, second=sec)
    except Exception:
        raise ValueError("Formato de hora inválido. Usa 'HH:MM' o 'HH:MM:SS'.")

def _get_current_user():
    try:
        uid = int(get_jwt_identity())
    except Exception:
        uid = None
    return User.query.get(uid) if uid else None

def _provider_owns_establishment(user: User, establishment: Establishment) -> bool:
    """
    Soporta dos esquemas de identidad:
    - identity = provider_id (algunas rutas tuyas funcionan así)
    - identity = user_id  (y validamos vía user.provider_profile.provider_id)
    """
    if not user or not establishment:
        return False

    # Caso 1: identity es provider_id y coincide con el owner del establecimiento
    try:
        ident = int(get_jwt_identity())
    except Exception:
        ident = None

    if ident and ident == establishment.provider_id:
        return True

    # Caso 2: identity es user_id -> comprobar que el usuario es provider y dueño
    if user.role == "provider" and user.provider_profile:
        return establishment.provider_id == user.provider_profile.provider_id

    return False

# ----------------- Rutas -----------------

@calendar_bp.get("/calendar/blackouts")
def list_blackouts():
    """
    GET /api/calendar/blackouts?establishment_id=...&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    Público: lista blackouts por establecimiento y (opcional) rango de fechas.
    """
    est_id = request.args.get("establishment_id", type=int)
    if not est_id:
        return jsonify({"msg": "Falta establishment_id"}), 400

    date_from = request.args.get("date_from")
    date_to   = request.args.get("date_to")

    q = CalendarBlackout.query.filter(CalendarBlackout.establishment_id == est_id)

    try:
        if date_from:
            df = _parse_date(date_from)
            q = q.filter(CalendarBlackout.fecha >= df)
        if date_to:
            dt = _parse_date(date_to)
            q = q.filter(CalendarBlackout.fecha <= dt)
    except ValueError as ve:
        return jsonify({"msg": str(ve)}), 400

    items = q.order_by(CalendarBlackout.fecha.asc()).all()
    return jsonify([b.to_dict() for b in items]), 200


@calendar_bp.post("/calendar/blackouts")
@jwt_required()
def create_blackout():
    """
    POST /api/calendar/blackouts
    Body JSON:
    {
      "establishment_id": int,              (requerido)
      "date": "YYYY-MM-DD",                 (requerido)
      "is_full_day": bool,                  (requerido)
      "start_time": "HH:MM" | "HH:MM:SS",   (si is_full_day=false)
      "end_time": "HH:MM" | "HH:MM:SS",     (si is_full_day=false)
      "name": str?,                         (opcional)
      "category": str?                      (opcional)
    }
    Requiere ser provider dueño del establecimiento.
    """
    user = _get_current_user()
    if not user:
        return jsonify({"msg": "Token inválido."}), 422

    data = request.get_json() or {}

    est_id = data.get("establishment_id")
    date_str = data.get("date")
    is_full_day = bool(data.get("is_full_day"))
    start_time_str = data.get("start_time")
    end_time_str   = data.get("end_time")
    name = data.get("name")
    category = data.get("category")

    if not est_id or not date_str:
        return jsonify({"msg": "Campos 'establishment_id' y 'date' son requeridos."}), 400

    est = Establishment.query.get(est_id)
    if not est or not est.activo:
        return jsonify({"msg": "Establecimiento no encontrado o inactivo."}), 404

    if not _provider_owns_establishment(user, est):
        return jsonify({"msg": "No tienes permisos sobre este establecimiento."}), 403

    try:
        fecha = _parse_date(date_str)

        if is_full_day:
            hora_inicio = None
            hora_fin = None
        else:
            if not start_time_str or not end_time_str:
                return jsonify({"msg": "Para bloqueos parciales debes indicar 'start_time' y 'end_time'."}), 400
            hora_inicio = _parse_time(start_time_str)
            hora_fin = _parse_time(end_time_str)
            if hora_inicio >= hora_fin:
                return jsonify({"msg": "'start_time' debe ser menor que 'end_time'."}), 400

        blackout = CalendarBlackout(
            establishment_id=est_id,
            fecha=fecha,
            es_dia_completo=is_full_day,
            hora_inicio=hora_inicio,
            hora_fin=hora_fin,
            nombre=name,
            categoria=category
        )
        db.session.add(blackout)
        db.session.commit()
        return jsonify(blackout.to_dict()), 201

    except ValueError as ve:
        db.session.rollback()
        return jsonify({"msg": str(ve)}), 400
    except IntegrityError:
        db.session.rollback()
        # Por el índice único (establishment_id, fecha, es_dia_completo)
        return jsonify({"msg": "Ya existe un blackout igual para ese día."}), 409
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creando blackout: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al crear el blackout."}), 500


@calendar_bp.delete("/calendar/blackouts/<int:blackout_id>")
@jwt_required()
def delete_blackout(blackout_id: int):
    """
    DELETE /api/calendar/blackouts/<id>
    Requiere ser provider dueño del establecimiento.
    """
    user = _get_current_user()
    if not user:
        return jsonify({"msg": "Token inválido."}), 422

    blackout = CalendarBlackout.query.get(blackout_id)
    if not blackout:
        return jsonify({"msg": "Blackout no encontrado."}), 404

    est = Establishment.query.get(blackout.establishment_id)
    if not _provider_owns_establishment(user, est):
        return jsonify({"msg": "No tienes permisos para eliminar este blackout."}), 403

    try:
        db.session.delete(blackout)
        db.session.commit()
        return jsonify({"msg": "Eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error eliminando blackout {blackout_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al eliminar el blackout."}), 500
