# backend/app/routes/whatsapp_invite.py
from flask import Blueprint, request, jsonify, current_app, redirect
from datetime import datetime, timezone
from urllib.parse import urlencode
import os

from app import db
from app.models.whatsapp_invite import WhatsAppInvite
from app.utils.phones import normalize_e164

# ⬇️ Rate limiting
from app import limiter

# Este blueprint se monta bajo /api/whatsapp desde routes/__init__.py
bp = Blueprint("whatsapp_invite_api", __name__)

def _invite_to_dict(inv: WhatsAppInvite):
    return {
        "phone_e164": inv.phone_e164,
        "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
        "used": inv.used_at is not None,
        "next_path": inv.next_path,
    }

def _sanitize_next(next_raw: str | None) -> str | None:
    """
    Acepta solo rutas relativas que empiecen por '/' (evita open redirect).
    Devuelve la ruta limpia o None si no es válida.
    """
    if not next_raw:
        return None
    next_raw = next_raw.strip()
    if next_raw.startswith("/"):
        return next_raw
    return None

# 🔒 key-func por teléfono para rate limit
def _key_phone_from_body():
    data = request.get_json(silent=True) or {}
    raw = (data.get("phone_number") or "").strip()
    return f"wa_invite:{raw}" if raw else request.remote_addr

@bp.post("/invite")
@limiter.limit("30 per 10 minutes")  # por IP
@limiter.limit("5 per 10 minutes", key_func=_key_phone_from_body)  # por teléfono
def create_invite():
    """
    Crea una invitación temporal para flujo WhatsApp ➜ login-phone.
    Body: {"phone_number":"+34...", "ttl_minutes": 60, "next": "/booking/123"}
    Respuesta 201: {"token":"...", "phone_e164":"+34...", "expires_at":"...", "next_path": "..."}
    """
    data = request.get_json(silent=True) or {}
    raw_phone = (data.get("phone_number") or "").strip()
    ttl_minutes = int(data.get("ttl_minutes") or 60)
    next_path = _sanitize_next(data.get("next"))

    if not raw_phone:
        return jsonify({"msg": "phone_number requerido"}), 400

    try:
        phone = normalize_e164(raw_phone)
    except Exception as e:
        return jsonify({"msg": f"Teléfono inválido: {e}"}), 400

    # Usar el generador del modelo (maneja token, expiración y commit)
    try:
        inv = WhatsAppInvite.generate(phone_e164=phone, ttl_minutes=ttl_minutes, next_path=next_path)
    except Exception as e:
        current_app.logger.error(f"[invite.create] Error creando invitación: {e}", exc_info=True)
        return jsonify({"msg": "No se pudo crear la invitación"}), 500

    return jsonify({
        "token": inv.token,
        "phone_e164": inv.phone_e164,
        "expires_at": inv.expires_at.isoformat(),
        "next_path": inv.next_path,
    }), 201

@bp.get("/invite/<token>")
def get_invite(token):
    """
    Consulta estado de una invitación.
    """
    inv = WhatsAppInvite.query.filter_by(token=token).first()
    if not inv:
        return jsonify({"msg": "Invitación no válida o caducada"}), 404

    if not inv.is_valid():
        return jsonify({"msg": "Invitación no válida o caducada"}), 400

    return jsonify(_invite_to_dict(inv)), 200

@bp.get("/invite/<token>/consume")
def consume_invite(token):
    """
    Marca como usada y redirige al frontend /login-phone con el número precargado.
    Si viene ?send=1, se propaga para auto-solicitar OTP en el front.
    También se respeta ?next=/ruta si es relativa; si no, inv.next_path; si no, WHATSAPP_DEFAULT_NEXT.
    """
    FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
    LOGIN_PHONE_PATH  = os.getenv("LOGIN_PHONE_PATH", "/login-phone")
    DEFAULT_NEXT      = _sanitize_next(os.getenv("WHATSAPP_DEFAULT_NEXT", "/"))

    inv = WhatsAppInvite.query.filter_by(token=token).first()
    if not inv:
        target = f"{FRONTEND_BASE_URL}{LOGIN_PHONE_PATH}?{urlencode({'error': 'invalid_invite'})}"
        return redirect(target, code=302)

    if not inv.is_valid():
        target = f"{FRONTEND_BASE_URL}{LOGIN_PHONE_PATH}?{urlencode({'error': 'invalid_invite'})}"
        return redirect(target, code=302)

    # Marcar usada
    try:
        inv.mark_used()
        db.session.commit()
    except Exception as e:
        current_app.logger.error(f"[invite.consume] Error al marcar usada: {e}", exc_info=True)
        target = f"{FRONTEND_BASE_URL}{LOGIN_PHONE_PATH}?{urlencode({'error': 'server_error'})}"
        return redirect(target, code=302)

    # Resolver next (prioridad: querystring -> inv.next_path -> DEFAULT_NEXT)
    next_qs = _sanitize_next(request.args.get("next"))
    final_next = next_qs or inv.next_path or DEFAULT_NEXT

    # Propagar send=1 si llega en la query (?send=1)
    send_flag = request.args.get("send")
    params = {"phone": inv.phone_e164}
    if final_next:
        params["next"] = final_next
    if send_flag == "1":
        params["send"] = "1"

    target = f"{FRONTEND_BASE_URL}{LOGIN_PHONE_PATH}?{urlencode(params)}"
    current_app.logger.info(f"[Invite] Consumida {token}, redirect -> {target}")

    return redirect(target, code=302)
