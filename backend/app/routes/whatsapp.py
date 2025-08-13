# backend/app/routes/whatsapp.py

from flask import Blueprint, request, jsonify, current_app
import os
from urllib.parse import urlencode

from app.services.magic_links import create_magic_link_for_phone
from app.services.whatsapp_api import send_text

bp = Blueprint("whatsapp_webhook", __name__, url_prefix="/webhooks/whatsapp")

VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "verify-me")
BOOKING_KEYWORDS = [w.strip().lower() for w in os.getenv("BOOKING_KEYWORDS", "RESERVAR,RESERVA,CITA").split(",")]
DEFAULT_NEXT = os.getenv("WHATSAPP_DEFAULT_NEXT", "/")  # adonde redirige tras canjear
ECHO_MAGIC_URL = os.getenv("ECHO_WEBHOOK_MAGIC_URL", "false").lower() == "true"

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

@bp.post("")
def receive_message():
    """
    Recibe mensajes entrantes. Si contienen palabras clave (RESERVAR/...), genera
    un enlace mágico y lo responde al remitente.
    Crea automáticamente el usuario si no existe y marca phone_verified_at.
    """
    payload = request.get_json(silent=True) or {}
    try:
        entries = payload.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {}) or {}
                messages = value.get("messages", []) or []

                for msg in messages:
                    from_number = msg.get("from")  # MSISDN (a veces sin '+')
                    text_body = (msg.get("text") or {}).get("body") if isinstance(msg.get("text"), dict) else ""
                    text = (text_body or "").strip()

                    if not from_number:
                        continue

                    # Palabras clave (config BOOKING_KEYWORDS)
                    if not any(k in text.lower() for k in BOOKING_KEYWORDS):
                        current_app.logger.info(f"[WhatsApp] Mensaje sin keyword: from={from_number} text={text!r}")
                        continue

                    try:
                        # allow_autocreate=True para primer uso (cliente nuevo)
                        token, user = create_magic_link_for_phone(
                            from_number, purpose="booking", allow_autocreate=True
                        )

                        base = os.getenv("MAGIC_LINK_BASE_URL", "http://localhost:5173/magic")
                        params = {"token": token}
                        if DEFAULT_NEXT:
                            params["next"] = DEFAULT_NEXT
                        magic_url = f"{base}?{urlencode(params)}"

                        reply = (
                            "¡Listo! Toca este enlace para reservar sin iniciar sesión:\n"
                            f"{magic_url}\n\n"
                            "Si caduca o ya se usó, escribe RESERVAR y te mando otro."
                        )
                        send_text(user.phone_number, reply)

                        # En modo debug o si ECHO_WEBHOOK_MAGIC_URL=true, devolvemos el enlace en la respuesta
                        if current_app.debug or ECHO_MAGIC_URL:
                            return jsonify({"status": "ok", "magic_url": magic_url}), 200

                    except ValueError as ve:
                        current_app.logger.warning(f"[WhatsApp] No se pudo generar link: {ve}")
                        try:
                            send_text(
                                from_number,
                                "No encuentro tu teléfono verificado. Regístrate en la web y verifica tu número para reservar por aquí."
                            )
                        except Exception:
                            pass
                    except Exception as e:
                        current_app.logger.error(f"[WhatsApp] Error generando/enviando enlace: {e}", exc_info=True)
                        try:
                            send_text(
                                from_number,
                                "Ahora mismo no puedo generar el enlace. Inténtalo en unos minutos."
                            )
                        except Exception:
                            pass

        # WhatsApp espera 200 aunque haya errores internos (para no reintentar en bucle).
        return jsonify({"status": "ok"}), 200

    except Exception as e:
        current_app.logger.error(f"[WhatsApp] Webhook parse error: {e}", exc_info=True)
        return jsonify({"status": "error"}), 200
