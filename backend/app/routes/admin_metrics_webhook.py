# backend/app/routes/admin_metrics_webhook.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, desc
from datetime import datetime, timedelta, timezone

from app import db
from app.models import User
from app.models.webhook_event import WebhookEvent

bp = Blueprint("admin_metrics_webhook", __name__)

@bp.get("/admin/metrics/webhook")
@jwt_required()
def webhook_metrics():
    """
    Métricas de eventos del webhook de WhatsApp en una ventana temporal (por defecto 60 min).
    - totals_by_type: conteo por event_type
    - recent.total_events / unique_senders
    - duplicates_guard: número de duplicados detectados (guard con message_id IS NULL)
    - invalid_signatures: número de firmas inválidas (event_type='webhook' y signature_valid=false)
    - top_senders: top N emisores por número de eventos
    Params:
      minutes (int) ventana, default=60
      top (int) top emisores, default=5
      debug=1 -> incluye una muestra de eventos recientes
    Requiere rol provider o admin.
    """
    # Auth y rol
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or user.role not in ("provider", "admin"):
        return jsonify({"msg": "No autorizado"}), 403

    # Ventana
    try:
        window_minutes = int(request.args.get("minutes", "60"))
    except Exception:
        window_minutes = 60
    window_minutes = max(1, min(window_minutes, 24 * 60))  # clamp 1..1440

    now = datetime.now(timezone.utc)
    since = now - timedelta(minutes=window_minutes)

    # Totales por tipo
    totals_rows = (
        db.session.query(
            WebhookEvent.event_type.label("event_type"),
            func.count().label("cnt")
        )
        .filter(WebhookEvent.created_at >= since)
        .group_by(WebhookEvent.event_type)
        .order_by(WebhookEvent.event_type)
        .all()
    )
    totals_by_type = [
        {"event_type": r.event_type, "count": int(r.cnt)} for r in totals_rows
    ]

    # Eventos recientes y emisores únicos
    total_events = (
        db.session.query(func.count())
        .select_from(WebhookEvent)
        .filter(WebhookEvent.created_at >= since)
        .scalar()
    ) or 0

    unique_senders = (
        db.session.query(func.count(func.distinct(WebhookEvent.from_msisdn)))
        .filter(WebhookEvent.created_at >= since, WebhookEvent.from_msisdn.isnot(None))
        .scalar()
    ) or 0

    # Duplicados robustos: guards sin message_id
    duplicates_guard = (
        db.session.query(func.count())
        .select_from(WebhookEvent)
        .filter(
            WebhookEvent.created_at >= since,
            WebhookEvent.event_type == "guard",
            WebhookEvent.message_id.is_(None),
        )
        .scalar()
    ) or 0

    # Firmas inválidas
    invalid_signatures = (
        db.session.query(func.count())
        .select_from(WebhookEvent)
        .filter(
            WebhookEvent.created_at >= since,
            WebhookEvent.event_type == "webhook",
            WebhookEvent.signature_valid.is_(False),
        )
        .scalar()
    ) or 0

    # Top emisores
    try:
        top_n = int(request.args.get("top", "5"))
    except Exception:
        top_n = 5
    top_n = max(1, min(top_n, 50))

    top_rows = (
        db.session.query(
            WebhookEvent.from_msisdn.label("sender"),
            func.count().label("events"),
        )
        .filter(WebhookEvent.created_at >= since, WebhookEvent.from_msisdn.isnot(None))
        .group_by(WebhookEvent.from_msisdn)
        .order_by(desc("events"))
        .limit(top_n)
        .all()
    )
    top_senders = [{"from": r.sender, "events": int(r.events)} for r in top_rows]

    resp = {
        "window_minutes": window_minutes,
        "since": since.isoformat(),
        "totals_by_type": totals_by_type,
        "recent": {
            "total_events": int(total_events),
            "unique_senders": int(unique_senders),
        },
        "duplicates_guard": int(duplicates_guard),
        "invalid_signatures": int(invalid_signatures),
        "top_senders": top_senders,
    }

    # Modo debug opcional: muestra una muestra de eventos recientes
    if request.args.get("debug") == "1":
        sample_rows = (
            db.session.query(
                WebhookEvent.event_type,
                WebhookEvent.message_id,
                WebhookEvent.from_msisdn,
                WebhookEvent.signature_valid,
                WebhookEvent.error_reason,
                WebhookEvent.created_at,
            )
            .filter(WebhookEvent.created_at >= since)
            .order_by(desc(WebhookEvent.created_at))
            .limit(20)
            .all()
        )
        resp["sample"] = [
            {
                "event_type": r.event_type,
                "message_id": r.message_id,
                "from_msisdn": r.from_msisdn,
                "signature_valid": r.signature_valid,
                "error_reason": r.error_reason,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in sample_rows
        ]

    return jsonify(resp), 200
