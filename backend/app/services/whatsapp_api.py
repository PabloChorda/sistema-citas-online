# backend/app/services/whatsapp_api.py
import os
import requests
from flask import current_app

GRAPH_VERSION = os.getenv("WHATSAPP_GRAPH_VERSION", "v23.0")

def send_text(to_msisdn: str, body: str) -> bool:
    """
    Envía un texto simple por WhatsApp Cloud.
    - to_msisdn: número destino (admite con o sin '+', aquí lo normalizamos a solo dígitos)
    - body: mensaje
    Devuelve True/False según 2xx.
    """
    if os.getenv("WHATSAPP_SEND_ENABLED", "false").lower() != "true":
        current_app.logger.info("[WA] Envío simulado (WHATSAPP_SEND_ENABLED!=true) -> %s", body)
        return True

    access_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    if not access_token or not phone_number_id:
        current_app.logger.error("[WA] Falta ACCESS_TOKEN o PHONE_NUMBER_ID en el entorno")
        return False

    # ⚠️ Cloud API exige SIN '+'
    to = str(to_msisdn).strip().lstrip("+")
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{phone_number_id}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": body,
        },
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    try:
        r = requests.post(url, json=payload, headers=headers, timeout=15)
        current_app.logger.info("[WA] Graph resp %s: %s", r.status_code, r.text)
        return 200 <= r.status_code < 300
    except Exception as e:
        current_app.logger.error("[WA] Error HTTP enviando mensaje: %s", e, exc_info=True)
        return False
