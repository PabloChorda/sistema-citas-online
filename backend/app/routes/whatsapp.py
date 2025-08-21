# backend/app/routes/whatsapp.py
from flask import Blueprint, request, jsonify, current_app
import os
import hmac
import hashlib
from urllib.parse import urlencode

from sqlalchemy.exc import IntegrityError

from app import db, limiter
from app.models.whatsapp_invite import WhatsAppInvite
from app.services.whatsapp_api import send_text

# Opcional: si ya tienes el modelo, esto funcionará.
try:
    from app.models.webhook_event import WebhookEvent
except Exception:  # pragma: no cover
    WebhookEvent = None  # fallback

bp = Blueprint("whatsapp_webhook", __name__, url_prefix="/webhooks/whatsapp")

VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "verify-me")
BOOKING_KEYWORDS = [
    w.strip().lower()
    for w in os.getenv("BOOKING_KEYWORDS", "RESERVAR,RESERVA,CITA").split(",")
]
DEFAULT_NEXT = os.getenv("WHATSAPP_DEFAULT_NEXT", "/")  # redirección tras canjear

# Soportamos ambos nombres de env para el secreto HMAC
_APP_SECRET_RAW = os.getenv("WHATSAPP_APP_SECRET") or os.getenv("WHATSAPP_HMAC_SECRET", "")
APP_SECRET = (_APP_SECRET_RAW or "").encode("utf-8")

REQUIRE_VALID_SIGNATURE = (os.getenv("WHATSAPP_REQUIRE_VALID_SIGNATURE", "true").lower() == "true")


def _signature_valid(req) -> bool:
    """
    Valida X-Hub-Signature-256 = 'sha256=<hexdigest>' con APP_SECRET.
    """
    header = (req.headers.get("X-Hub-Signature-256") or "").strip()
    if not APP_SECRET:
        return False
    if not header.startswith("sha256="):
        return False
    sent_hex = header.split("=", 1)[1]
    body = req.get_data(cache=True)  # bytes del raw payload
    calc_hex = hmac.new(APP_SECRET, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sent_hex, calc_hex)


def _key_sender_msisdn():
    """
    Key-func para limitar por emisor (MSISDN) además del límite global por IP.
    Si no podemos extraerlo, caemos al remote_addr.
    """
    try:
        payload = request.get_json(silent=True) or {}
        entries = payload.get("entry", []) or []
        for entry in entries:
            changes = entry.get("changes", []) or []
            for change in changes:
                value = change.get("value", {}) or {}
                messages = value.get("messages", []) or []
                if messages:
                    frm = messages[0].get("from")
                    if frm:
                        return f"wa:{frm}"
    except Exception:
        pass
    return request.remote_addr or "unknown"


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
@limiter.limit("60 per minute")                              # límite global por IP (Meta)
@limiter.limit("5 per minute", key_func=_key_sender_msisdn)  # extra por número emisor
def receive_message():
    """
    Recibe mensajes entrantes. Si contienen palabras clave (RESERVAR/...), genera
    una invitación OTP y responde con un enlace de consumo.
    En dev o si ECHO_WEBHOOK_INVITE_URL=true, devuelve invite_url en la respuesta JSON.
    """
    # 1) Validar firma
    sig_ok = _signature_valid(request)
    if REQUIRE_VALID_SIGNATURE and not sig_ok:
        current_app.logger.warning("[WhatsApp] Firma inválida, rechazando payload.")

        # Guardamos evento de firma inválida (no bloqueante)
        try:
            if WebhookEvent:
                ev = WebhookEvent(
                    event_type="webhook",
                    message_id=None,
                    from_msisdn=None,
                    keyword_detected=False,
                    invite_token=None,
                    sent_ok=False,
                    signature_valid=False,
                    error_reason="invalid_signature",
                )
                db.session.add(ev)
                db.session.commit()
        except Exception:
            db.session.rollback()

        # Rechazamos para no aceptar cargas sin firma válida (puedes devolver 200 si prefieres evitar reintentos)
        return jsonify({"status": "invalid_signature"}), 403

    payload = request.get_json(silent=True) or {}
    try:
        entries = payload.get("entry", []) or []
        for entry in entries:
            changes = entry.get("changes", []) or []
            for change in changes:
                value = change.get("value", {}) or {}
                messages = value.get("messages", []) or []

                for msg in messages:
                    message_id = msg.get("id")
                    from_number = msg.get("from")  # MSISDN (sin '+')

                    # --- Idempotencia atómica (insert-first guard con UNIQUE(message_id)) ---
                    if WebhookEvent and message_id:
                        try:
                            ev_guard = WebhookEvent(
                                event_type="guard",
                                message_id=message_id,
                                from_msisdn=from_number,
                                keyword_detected=False,
                                invite_token=None,
                                sent_ok=False,
                                signature_valid=sig_ok,
                                error_reason=None,
                            )
                            db.session.add(ev_guard)
                            db.session.commit()
                        except IntegrityError:
                            # Ya procesado: registra un 'guard' sin message_id para contar el duplicado y sigue
                            db.session.rollback()
                            try:
                                dup = WebhookEvent(
                                    event_type="guard",
                                    message_id=None,  # sin ID para no violar UNIQUE
                                    from_msisdn=from_number,
                                    keyword_detected=None,
                                    invite_token=None,
                                    sent_ok=False,
                                    signature_valid=sig_ok,
                                    error_reason="duplicate_message",
                                )
                                db.session.add(dup)
                                db.session.commit()
                            except Exception:
                                db.session.rollback()
                            current_app.logger.info(f"[WhatsApp] Guard: duplicado message_id={message_id}, ignorando.")
                            continue  # no procesamos este mensaje otra vez

                    # "text" puede venir como objeto {"body": "..."} o no venir
                    text_field = msg.get("text")
                    if isinstance(text_field, dict):
                        text_body = text_field.get("body", "")
                    elif isinstance(text_field, str):
                        text_body = text_field
                    else:
                        text_body = ""
                    text = (text_body or "").strip()
                    keyword = any(k in text.lower() for k in BOOKING_KEYWORDS)

                    # Normalizar número a formato +E.164 (simple) para la invite
                    phone_e164 = None
                    if from_number:
                        phone_e164 = "+" + str(from_number).lstrip("+")

                    invite_url = None
                    sent_ok = False

                    if not keyword:
                        current_app.logger.info(
                            f"[WhatsApp] Mensaje sin keyword: from={from_number} text={text!r}"
                        )
                        # Actualiza el guard como mensaje normal sin keyword
                        try:
                            if WebhookEvent and message_id:
                                WebhookEvent.query.filter_by(message_id=message_id).update({
                                    "event_type": "message",
                                    "keyword_detected": False,
                                    "invite_token": None,
                                    "sent_ok": False,
                                    "error_reason": "no_keyword",
                                })
                                db.session.commit()
                        except Exception:
                            db.session.rollback()
                        continue

                    # Crear invitación
                    try:
                        ttl = int(os.getenv("WHATSAPP_INVITE_TTL_MINUTES", "60"))
                        inv = WhatsAppInvite.generate(phone_e164, ttl)

                        # Construcción de URL de invitación (siempre sobre el backend)
                        base_url = request.url_root.rstrip("/")
                        invite_url = f"{base_url}/api/whatsapp/invite/{inv.token}/consume"

                        params = {"send": "1"}
                        if DEFAULT_NEXT:
                            params["next"] = DEFAULT_NEXT
                        if params:
                            invite_url += "?" + urlencode(params)

                        current_app.logger.info(
                            f"[WhatsApp] Invite creada token={inv.token} phone={phone_e164} url={invite_url}"
                        )

                        # Intentar enviar por WhatsApp (to sin '+')
                        try:
                            reply = (
                                "¡Listo! Toca este enlace para continuar tu reserva con tu teléfono precargado:\n"
                                f"{invite_url}\n\n"
                                "Si caduca o ya se usó, escribe RESERVAR y te mando otro."
                            )
                            to_msisdn = str(from_number).lstrip("+")
                            send_text(to_msisdn, reply)
                            sent_ok = True
                        except Exception as se:
                            sent_ok = False
                            current_app.logger.warning(
                                f"[WhatsApp] Falla send_text: {se}", exc_info=True
                            )

                        # Actualiza el guard con el resultado real
                        try:
                            if WebhookEvent and message_id:
                                WebhookEvent.query.filter_by(message_id=message_id).update({
                                    "event_type": "message",
                                    "keyword_detected": True,
                                    "invite_token": inv.token,
                                    "sent_ok": sent_ok,
                                    "error_reason": None,
                                })
                                db.session.commit()
                        except Exception:
                            db.session.rollback()

                        # En debug o si ECHO_WEBHOOK_INVITE_URL=true, devolvemos el enlace
                        if current_app.debug or os.getenv("ECHO_WEBHOOK_INVITE_URL", "false").lower() == "true":
                            return jsonify({"status": "ok", "invite_url": invite_url}), 200

                        # seguimos para procesar otros mensajes del mismo payload
                        continue

                    except Exception as e:
                        current_app.logger.error(
                            f"[WhatsApp] Error generando invitación: {e}", exc_info=True
                        )

                        # Intentar informar al usuario por WhatsApp (no bloqueante)
                        try:
                            if from_number:
                                to_msisdn = str(from_number).lstrip("+")
                                send_text(
                                    to_msisdn,
                                    "Ahora mismo no puedo generar el enlace. Inténtalo en unos minutos.",
                                )
                        except Exception:
                            pass

                        # Marca el guard como error
                        try:
                            if WebhookEvent and message_id:
                                WebhookEvent.query.filter_by(message_id=message_id).update({
                                    "event_type": "error",
                                    "keyword_detected": keyword,
                                    "invite_token": None,
                                    "sent_ok": False,
                                    "error_reason": str(e)[:255],
                                })
                                db.session.commit()
                        except Exception:
                            db.session.rollback()
                        continue

        # Siempre 200 para cerrar bien el ciclo de entrega de Meta
        return jsonify({"status": "ok"}), 200

    except Exception as e:
        current_app.logger.error(f"[WhatsApp] Webhook parse error: {e}", exc_info=True)
        return jsonify({"status": "ok"}), 200
