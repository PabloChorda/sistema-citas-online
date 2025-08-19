# backend/app/routes/admin_metrics.py
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from datetime import datetime, timedelta, timezone

from app import db
from app.models import User
from app.models.whatsapp_invite import WhatsAppInvite

bp = Blueprint("admin_metrics", __name__)

@bp.get("/admin/metrics/whatsapp")
@jwt_required()
def whatsapp_metrics():
    """
    Devuelve métricas simples de WhatsApp Invite para los últimos 14 días:
    - invites creadas por día
    - invites consumidas por día
    - totales y ratio de conversión (consumidas / creadas)
    Requiere rol provider o admin.
    """
    # Auth & roles
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or user.role not in ("provider", "admin"):
        return jsonify({"msg": "No autorizado"}), 403

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=13)  # 14 días ventana (incluye hoy)

    # Buckets por día (Postgres)
    created_rows = (
        db.session.query(
            func.date_trunc('day', WhatsAppInvite.created_at).label('day'),
            func.count().label('cnt')
        )
        .filter(WhatsAppInvite.created_at >= start)
        .group_by('day')
        .order_by('day')
        .all()
    )

    consumed_rows = (
        db.session.query(
            func.date_trunc('day', WhatsAppInvite.used_at).label('day'),
            func.count().label('cnt')
        )
        .filter(WhatsAppInvite.used_at.isnot(None))
        .filter(WhatsAppInvite.used_at >= start)
        .group_by('day')
        .order_by('day')
        .all()
    )

    def to_series(rows):
        return [
            {
                "day": (r.day if hasattr(r, "day") else r[0]).date().isoformat(),
                "count": int(r.cnt if hasattr(r, "cnt") else r[1]),
            }
            for r in rows
        ]

    created_series = to_series(created_rows)
    consumed_series = to_series(consumed_rows)

    total_created = sum(x["count"] for x in created_series)
    total_consumed = sum(x["count"] for x in consumed_series)
    conv = (total_consumed / total_created) if total_created else 0.0

    return jsonify({
        "range_days": 14,
        "created_per_day": created_series,
        "consumed_per_day": consumed_series,
        "totals": {
            "created": total_created,
            "consumed": total_consumed,
            "conversion_rate": round(conv, 4),
        }
    }), 200
