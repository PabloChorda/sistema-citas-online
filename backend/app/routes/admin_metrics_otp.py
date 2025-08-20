from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from datetime import datetime, timedelta, timezone

from app import db
from app.models import User, PhoneOTP

bp = Blueprint("admin_metrics_otp", __name__)

@bp.get("/admin/metrics/otp")
@jwt_required()
def otp_metrics():
    """
    Métricas de OTP de los últimos 14 días (incluye hoy):
      - issued_per_day: OTP emitidos (PhoneOTP.created_at)
      - verified_per_day: OTP verificados (used_at no nulo)
      - expired_per_day: OTP que expiraron sin usarse (expires_at < now & used_at es NULL)
      - totals: issued, verified, expired, verify_rate y avg_attempts_verified
    Requiere rol provider o admin.
    """
    # Auth & roles
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or user.role not in ("provider", "admin"):
        return jsonify({"msg": "No autorizado"}), 403

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=13)  # ventana de 14 días

    # Emitidos por día (created_at)
    issued_rows = (
        db.session.query(
            func.date_trunc('day', PhoneOTP.created_at).label('day'),
            func.count().label('cnt')
        )
        .filter(PhoneOTP.created_at >= start)
        .group_by('day')
        .order_by('day')
        .all()
    )

    # Verificados por día (used_at)
    verified_rows = (
        db.session.query(
            func.date_trunc('day', PhoneOTP.used_at).label('day'),
            func.count().label('cnt')
        )
        .filter(PhoneOTP.used_at.isnot(None))
        .filter(PhoneOTP.used_at >= start)
        .group_by('day')
        .order_by('day')
        .all()
    )

    # Expirados (no usados) por día (agrupamos por expires_at)
    expired_rows = (
        db.session.query(
            func.date_trunc('day', PhoneOTP.expires_at).label('day'),
            func.count().label('cnt')
        )
        .filter(PhoneOTP.used_at.is_(None))
        .filter(PhoneOTP.expires_at < now)
        .filter(PhoneOTP.created_at >= start)  # expirados creados dentro de la ventana
        .group_by('day')
        .order_by('day')
        .all()
    )

    # Promedio de intentos entre los verificados en la ventana
    avg_attempts = (
        db.session.query(func.avg(PhoneOTP.attempts))
        .filter(PhoneOTP.used_at.isnot(None))
        .filter(PhoneOTP.used_at >= start)
        .scalar()
    ) or 0.0

    def to_series(rows):
        return [
            {
                "day": (r.day if hasattr(r, "day") else r[0]).date().isoformat(),
                "count": int(r.cnt if hasattr(r, "cnt") else r[1]),
            }
            for r in rows
        ]

    issued_series = to_series(issued_rows)
    verified_series = to_series(verified_rows)
    expired_series = to_series(expired_rows)

    total_issued = sum(x["count"] for x in issued_series)
    total_verified = sum(x["count"] for x in verified_series)
    total_expired = sum(x["count"] for x in expired_series)
    verify_rate = (total_verified / total_issued) if total_issued else 0.0

    return jsonify({
        "range_days": 14,
        "issued_per_day": issued_series,
        "verified_per_day": verified_series,
        "expired_per_day": expired_series,
        "totals": {
            "issued": total_issued,
            "verified": total_verified,
            "expired": total_expired,
            "verify_rate": round(verify_rate, 4),
            "avg_attempts_verified": round(float(avg_attempts), 2),
        }
    }), 200
