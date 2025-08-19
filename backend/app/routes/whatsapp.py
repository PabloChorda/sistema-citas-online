# backend/app/routes/whatsapp.py
from flask import Blueprint, request, jsonify, current_app
import os
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone

from app import db
from app.models.whatsapp_invite import WhatsAppInvite
from app.services.whatsapp_api import send_text

# ⬇️ Rate limiting
from app import limiter

bp = Blueprint("whatsapp_webhook", __name__, url_prefix="/webhooks/whatsapp")

VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "verify-me")
BOOKING_KEYWORDS = [
    w.strip().lower()
    for w in os.getenv("BOOKING_KEYWORDS", "RESERVAR,RESERVA,CITA").split(",")
]
DEFAULT_NEXT = os.getenv("WHATSAPP_DEFAULT_NEXT", "/")  # redirección tras canjear

@bp.get("")
def verify_webhook():
    """
    Verificación inicial de webhook (setup en Meta):
    Meta hará GET con hub.mode, hub.verify_token, hub.challenge
    """
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")
    if mode == "subscribe" and token == VERIFY_TOKEN:
        return challenge or "", 200
    return "forbidden", 403

# 🔒 key-func por remitente (MSISDN) para rate limit fino
def _key_from_msisdn():
    payload = request.get_json(silent=True) or {}
    try:
        msg = payload["entry"][0]["changes"][0]["value"]["messages"][0]
        from_number = (msg.get("from") or "").strip()
        return f"wa_from:{from_number}" if from_number else request.remote_addr
    except Exception:
        return request.remote_addr

@bp.post("")
@limiter.limit("30 per minute")                 # por IP
@limiter.limit("5 per minute", key_func=_key_from_msisdn)  # por emisor
def receive_message():
    """
    Recibe mensajes entrantes. Si contienen palabras clave (RESERVAR/...), genera
    una invitación OTP y responde con un enlace de consumo.
    En dev o si ECHO_WEBHOOK_INVITE_URL=true, devuelve invite_url en la respuesta JSON.
    """
    payload = request.get_json(silent=True) or {}
    try:
        entries = payload.get("entry", []) or []
        for entry in entries:
            changes = entry.get("changes", []) or []
            for change in changes:
                value = change.get("value", {}) or {}
                messages = value.get("messages", []) or []

                for msg in messages:
                    from_number = msg.get("from")  # MSISDN (a veces sin '+')

                    # "text" puede venir como objeto {"body": "..."} o no venir
                    text_field = msg.get("text")
                    if isinstance(text_field, dict):
                        text_body = text_field.get("body", "")
                    elif isinstance(text_field, str):
                        text_body = text_field
                    else:
                        text_body = ""
                    text = (text_body or "").strip()

                    if not from_number:
                        continue

                    # Palabras clave (config BOOKING_KEYWORDS)
                    if not any(k in text.lower() for k in BOOKING_KEYWORDS):
                        current_app.logger.info(
                            f"[WhatsApp] Mensaje sin keyword: from={from_number} text={text!r}"
                        )
                        continue

                    try:
                        # Normalizar número a formato +E.164
                        phone_e164 = "+" + from_number.lstrip("+")

                        # Crear invitación OTP usando el método estático
                        ttl = int(os.getenv("WHATSAPP_INVITE_TTL_MINUTES", "60"))
                        inv = WhatsAppInvite.generate(phone_e164, ttl)

                        # Construcción de URL de invitación (siempre sobre el backend)
                        base_url = request.url_root.rstrip("/")
                        invite_url = f"{base_url}/api/whatsapp/invite/{inv.token}/consume"

                        # next opcional
                        params = {"send": "1"}
                        if DEFAULT_NEXT:
                            params["next"] = DEFAULT_NEXT
                        if params:
                            invite_url += "?" + urlencode(params)

                        current_app.logger.info(
                            f"[WhatsApp] Invite creada token={inv.token} phone={phone_e164} url={invite_url}"
                        )

                        # Intentar enviar por WhatsApp (si falla, no bloquea el eco en dev)
                        try:
                            reply = (
                                "¡Listo! Toca este enlace para continuar tu reserva con tu teléfono precargado:\n"
                                f"{invite_url}\n\n"
                                "Si caduca o ya se usó, escribe RESERVAR y te mando otro."
                            )
                            send_text(inv.phone_e164, reply)
                        except Exception as se:
                            current_app.logger.warning(
                                f"[WhatsApp] Falla send_text: {se}", exc_info=True
                            )

                        # En debug o si ECHO_WEBHOOK_INVITE_URL=true, devolvemos el enlace
                        if current_app.debug or os.getenv("ECHO_WEBHOOK_INVITE_URL", "false").lower() == "true":
                            return jsonify({"status": "ok", "invite_url": invite_url}), 200

                        # Sin eco: respondemos 200 simple tras procesar el primer mensaje válido
                        return jsonify({"status": "ok"}), 200

                    except Exception as e:
                        current_app.logger.error(
                            f"[WhatsApp] Error generando invitación: {e}", exc_info=True
                        )
                        # Intentar informar al usuario por WhatsApp, pero sin bloquear el 200 al webhook
                        try:
                            send_text(
                                "+" + from_number.lstrip("+"),
                                "Ahora mismo no puedo generar el enlace. Inténtalo en unos minutos.",
                            )
                        except Exception:
                            pass
                        # devolvemos ok para que Meta no reintente
                        return jsonify({"status": "ok"}), 200

        # Si no hubo mensajes o ninguno matcheó, devolver 200 igualmente
        return jsonify({"status": "ok"}), 200

    except Exception as e:
        current_app.logger.error(f"[WhatsApp] Webhook parse error: {e}", exc_info=True)
        # WhatsApp Cloud API no quiere reintentos infinitos: mejor 200
        return jsonify({"status": "ok"}), 200
