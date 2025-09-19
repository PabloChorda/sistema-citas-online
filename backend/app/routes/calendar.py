# backend/app/routes/calendar.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from datetime import datetime, time as time_cls, timezone
import os
import requests

from app import db
from app.models import CalendarBlackout, Establishment, User

# Igual que tus otros blueprints: SIN url_prefix aquí
# (se añade en create_app con app.register_blueprint(calendar_bp, url_prefix="/api"))
calendar_bp = Blueprint("calendar", __name__)

# ======================== Config ==========================
# Valor por defecto; si has puesto Config.CRON_SECRET en tu app, usaremos ese.
CRON_SECRET = os.getenv("CRON_SECRET", "change-me")  # Pon un secreto real en producción


# ======================== Helpers =========================
def _parse_date(s: str):
    try:
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

    try:
        ident = int(get_jwt_identity())
    except Exception:
        ident = None

    # Caso 1: identity es provider_id y coincide con el owner del establecimiento
    if ident and ident == establishment.provider_id:
        return True

    # Caso 2: identity es user_id -> comprobar que el usuario es provider y dueño
    if getattr(user, "role", None) == "provider" and getattr(user, "provider_profile", None):
        return establishment.provider_id == user.provider_profile.provider_id

    return False


# ======================== Blackouts =======================
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

    try:
        est_id = int(est_id)
    except (TypeError, ValueError):
        return jsonify({"msg": "establishment_id inválido."}), 400

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

        # --- NUEVO: coherencia entre full-day y parciales / solapes ---
        if is_full_day:
            # impedir full-day si ya hay parciales ese día
            partial_exists = CalendarBlackout.query.filter_by(
                establishment_id=est_id,
                fecha=fecha,
                es_dia_completo=False
            ).first()
            if partial_exists:
                return jsonify({"msg": "Ya existen bloqueos parciales ese día. Elimina los parciales antes de crear un bloqueo de día completo."}), 409
        else:
            # impedir parcial si ya hay full-day ese día
            full_exists = CalendarBlackout.query.filter_by(
                establishment_id=est_id,
                fecha=fecha,
                es_dia_completo=True
            ).first()
            if full_exists:
                return jsonify({"msg": "Ese día está bloqueado completo. Elimina el bloqueo de día completo antes de crear parciales."}), 409

            # impedir solape entre parciales del mismo día
            overlapping_partial = CalendarBlackout.query.filter(
                CalendarBlackout.establishment_id == est_id,
                CalendarBlackout.fecha == fecha,
                CalendarBlackout.es_dia_completo.is_(False),
                CalendarBlackout.hora_inicio < hora_fin,
                CalendarBlackout.hora_fin > hora_inicio,
            ).first()
            if overlapping_partial:
                return jsonify({"msg": "Ya existe un bloqueo parcial que se solapa con esa franja."}), 409
        # --- FIN NUEVO ---

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
        db.session.rollback()  # <-- faltaban paréntesis
        current_app.logger.error(f"Error eliminando blackout {blackout_id}: {e}", exc_info=True)
        return jsonify({"msg": "Error interno al eliminar el blackout."}), 500


# ======================== Festivos (Nager) =======================
def _nager_fetch_holidays(country: str, year: int):
    url = f"https://date.nager.at/api/v3/PublicHolidays/{year}/{country.upper()}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()  # lista de dicts


@calendar_bp.get("/calendar/holidays")
def proxy_nager_holidays():
    """
    GET /api/calendar/holidays?country=ES&year=2025&region=ES-VC
    Proxy simple a Nager.Date con filtrado opcional por región y tipos.
    """
    country = (request.args.get("country") or "ES").upper()
    year = request.args.get("year", type=int) or datetime.utcnow().year
    region = request.args.get("region")  # ej: ES-VC
    allowed_types = set((request.args.get("types") or "Public,Bank").split(","))

    try:
        data = _nager_fetch_holidays(country, year)
    except Exception as e:
        return jsonify({"msg": f"No se pudieron obtener festivos: {e}"}), 502

    out = []
    for h in data:
        types = set(h.get("types") or [])
        if not (types & allowed_types):
            continue
        counties = h.get("counties")  # None = global
        if region:
            if counties is not None and region not in counties:
                continue
        out.append({
            "date": h["date"],             # "YYYY-MM-DD"
            "localName": h.get("localName"),
            "name": h.get("name"),
            "countryCode": h.get("countryCode"),
            "global": h.get("global"),
            "counties": counties,
            "types": list(types),
        })
    return jsonify(out), 200


@calendar_bp.post("/calendar/blackouts/seed-holidays")
@jwt_required()
def seed_holidays_to_blackouts():
    """
    POST /api/calendar/blackouts/seed-holidays
    Body: { establishment_id, country?:'ES', year?:2025, region?:'ES-VC', category?:'holiday' }
    Crea blackouts de día completo por cada festivo que aplique (idempotente con el UNIQUE).
    """
    user = _get_current_user()
    if not user:
        return jsonify({"msg": "Token inválido."}), 422

    payload = request.get_json() or {}
    est_id = payload.get("establishment_id")
    if not est_id:
        return jsonify({"msg": "Falta establishment_id"}), 400

    est = Establishment.query.get(est_id)
    if not est or not est.activo:
        return jsonify({"msg": "Establecimiento no encontrado o inactivo."}), 404
    if not _provider_owns_establishment(user, est):
        return jsonify({"msg": "No tienes permisos sobre este establecimiento."}), 403

    country = (payload.get("country") or "ES").upper()
    year = int(payload.get("year") or datetime.utcnow().year)
    region = payload.get("region")  # ej: ES-VC
    category = payload.get("category") or "holiday"
    allowed_types = set((payload.get("types") or "Public,Bank").split(","))

    try:
        data = _nager_fetch_holidays(country, year)
    except Exception as e:
        return jsonify({"msg": f"No se pudieron obtener festivos: {e}"}), 502

    created = []
    inserted, skipped = 0, 0
    for h in data:
        types = set(h.get("types") or [])
        if not (types & allowed_types):
            continue
        counties = h.get("counties")
        if region and (counties is not None) and (region not in counties):
            continue

        fecha = h["date"]  # "YYYY-MM-DD"
        nombre = h.get("localName") or h.get("name") or "Festivo"

        try:
            b = CalendarBlackout(
                establishment_id=est_id,
                fecha=datetime.strptime(fecha, "%Y-%m-%d").date(),
                es_dia_completo=True,
                hora_inicio=None,
                hora_fin=None,
                nombre=nombre,
                categoria=category
            )
            db.session.add(b)
            db.session.commit()
            created.append(b.to_dict())
            inserted += 1
        except IntegrityError:
            db.session.rollback()
            skipped += 1
        except Exception as e:
            db.session.rollback()
            return jsonify({"msg": f"Error creando blackout para {fecha}: {e}"}), 500

    return jsonify({
        "inserted": inserted,
        "skipped": skipped,
        "items": created
    }), 201


# ================== Cron interno (auto-holidays) ==================
def _seed_holidays_for_establishment(est: Establishment, year: int, types_set: set, category: str):
    """
    Siembra festivos (día completo) para un establecimiento y año.
    Usa preferencias guardadas en el establecimiento (country/region).
    Idempotente gracias al UNIQUE de calendar_blackouts.
    """
    country = (est.holiday_country_code or "ES").upper()
    region = est.holiday_region_code

    data = _nager_fetch_holidays(country, year)
    inserted = skipped = 0

    for h in data:
        types = set(h.get("types") or [])
        if not (types & types_set):
            continue
        counties = h.get("counties")  # None = global
        if region and (counties is not None) and (region not in counties):
            continue

        fecha = h["date"]
        nombre = h.get("localName") or h.get("name") or "Festivo"

        try:
            blackout = CalendarBlackout(
                establishment_id=est.id,
                fecha=datetime.strptime(fecha, "%Y-%m-%d").date(),
                es_dia_completo=True,
                hora_inicio=None,
                hora_fin=None,
                nombre=nombre,
                categoria=category
            )
            db.session.add(blackout)
            db.session.commit()
            inserted += 1
        except IntegrityError:
            db.session.rollback()
            skipped += 1

    # Tracking (sellamos último año y última sync)
    try:
        est.holiday_last_seed_year = max(filter(None, [est.holiday_last_seed_year, year]))
        est.holiday_last_sync_at = datetime.now(timezone.utc)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return inserted, skipped


@calendar_bp.post("/internal/cron/seed-holidays")
def internal_cron_seed_holidays():
    """
    POST /api/internal/cron/seed-holidays
    Header: X-CRON-SECRET: <CRON_SECRET>
    - Recorre establecimientos con holiday_auto_enabled y siembra festivos
      para [año_actual .. año_actual + holiday_years_ahead]
    - Idempotente gracias al UNIQUE de CalendarBlackout.
    - Actualiza holiday_last_seed_year y holiday_last_sync_at en cada establecimiento.
    """
    # coge el secreto de la app (si está) o del fallback del módulo
    expected = current_app.config.get("CRON_SECRET", CRON_SECRET)
    secret = request.headers.get("X-CRON-SECRET")
    if not expected or secret != expected:
        return jsonify({"msg": "Unauthorized"}), 401

    now_utc = datetime.now(timezone.utc)
    current_year = now_utc.year

    ests = Establishment.query.filter_by(holiday_auto_enabled=True, activo=True).all()

    total_inserted = 0
    total_skipped = 0
    total_processed = 0

    for est in ests:
        types = set((est.holiday_types or "Public,Bank").split(","))
        years_ahead = est.holiday_years_ahead or 0

        # años objetivo
        years = range(current_year, current_year + years_ahead + 1)

        inserted_sum = skipped_sum = 0
        max_year_seeded = est.holiday_last_seed_year or 0

        for y in years:
            ins, skp = _seed_holidays_for_establishment(est, y, types, "holiday")
            inserted_sum += ins
            skipped_sum += skp
            if y > max_year_seeded:
                max_year_seeded = y

        # marca sync y último año sembrado (aunque no haya inserts, sirve de “sellado”)
        try:
            est.holiday_last_seed_year = max_year_seeded if max_year_seeded else est.holiday_last_seed_year
            est.holiday_last_sync_at = now_utc
            db.session.commit()
        except Exception:
            db.session.rollback()

        total_inserted += inserted_sum
        total_skipped += skipped_sum
        total_processed += 1

    return jsonify({
        "count": total_processed,
        "inserted": total_inserted,
        "skipped": total_skipped
    }), 200
