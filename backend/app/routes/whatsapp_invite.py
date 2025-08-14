# backend/app/routes/whatsapp_invite.py
from flask import Blueprint, request, jsonify, current_app, redirect
from datetime import datetime, timezone, timedelta
from secrets import token_hex
from urllib.parse import urlencode
import os

from app import db
from app.models.whatsapp_invite import WhatsAppInvite
from app.utils.phones import normalize_e164

# Este blueprint se montará bajo /api/whatsapp desde routes/__init__.py
bp = Blueprint("whatsapp_invite_api", __name__)

def _invite_to_dict(inv: WhatsAppInvite):
    return {
        "phone_e164": inv.phone_e164,
        "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
        "used": bool(getattr(inv, "used", False) or inv.used_at is not None),
    }

@bp.post("/invite")
def create_invite():
    """
    Crea una invitación temporal para flujo WhatsApp ➜ login-phone.
    Body: {"phone_number":"+34...", "ttl_minutes": 60}
    Respuesta 200: {"token":"...", "phone_e164":"+34...", "expires_at":"..."}
    """
    data = request.get_json(silent=True) or {}
    raw_phone = (data.get("phone_number") or "").strip()
    ttl_minutes = int(data.get("ttl_minutes") or 60)

    if not raw_phone:
        return jsonify({"msg": "phone_number requerido"}), 400

    try:
        phone = normalize_e164(raw_phone)
    except Exception as e:
        return jsonify({"msg": f"Teléfono inválido: {e}"}), 400

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=ttl_minutes)

    tok = token_hex(16)  # 32 chars
    inv = WhatsAppInvite(
        token=tok,
        phone_e164=phone,
        expires_at=expires_at,
        used_at=None
    )
    # si tu modelo tiene columna booleana 'used', la dejamos en False por defecto
    if hasattr(inv, "used"):
        inv.used = False

    db.session.add(inv)
    db.session.commit()

    return jsonify({
        "token": tok,
        "phone_e164": phone,
        "expires_at": expires_at.isoformat(),
    }), 200

@bp.get("/invite/<token>")
def get_invite(token):
    """
    Consulta estado de una invitación.
    """
    inv = WhatsAppInvite.query.filter_by(token=token).first()
    if not inv:
        return jsonify({"msg": "Invitación no válida o caducada"}), 404

    now = datetime.now(timezone.utc)
    expired = inv.expires_at and now >= inv.expires_at
    used_flag = bool(getattr(inv, "used", False) or inv.used_at)

    if expired:
        return jsonify({"msg": "Invitación no válida o caducada"}), 400

    return jsonify(_invite_to_dict(inv)), 200

@bp.get("/invite/<token>/consume")
def consume_invite(token):
    """
    Marca como usada y redirige al frontend /login-phone con el número precargado.
    FRONTEND_BASE_URL (default http://localhost:5173)
    LOGIN_PHONE_PATH  (default /login-phone)
    """
    FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
    LOGIN_PHONE_PATH  = os.getenv("LOGIN_PHONE_PATH", "/login-phone")

    inv = WhatsAppInvite.query.filter_by(token=token).first()
    now = datetime.now(timezone.utc)

    if (not inv) or (inv.expires_at and now >= inv.expires_at) or (getattr(inv, "used", False) or inv.used_at):
        target = f"{FRONTEND_BASE_URL}{LOGIN_PHONE_PATH}?{urlencode({'error':'invalid_invite'})}"
        return redirect(target, code=302)

    # marcar como usada
    if hasattr(inv, "used"):
        inv.used = True
    inv.used_at = now

    try:
        db.session.commit()
    except Exception as e:
        current_app.logger.error(f"[invite.consume] Error al marcar usada: {e}", exc_info=True)
        target = f"{FRONTEND_BASE_URL}{LOGIN_PHONE_PATH}?{urlencode({'error':'server_error'})}"
        return redirect(target, code=302)

    target = f"{FRONTEND_BASE_URL}{LOGIN_PHONE_PATH}?{urlencode({'phone': inv.phone_e164})}"
    current_app.logger.info(f"[Invite] Consumida {token}, redirect -> {target}")
    return redirect(target, code=302)
