#backend/app/services/whatsapp_api.py

import os
import requests
from flask import current_app

WA_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WA_PHONE_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WA_SEND_ENABLED = os.getenv("WHATSAPP_SEND_ENABLED", "true").lower() == "true"

def send_text(to_e164: str, text: str) -> dict:
    """
    Envía un texto por WhatsApp Cloud API. Si no hay credenciales o
    WA_SEND_ENABLED es false, no envía y lo registra en logs.
    """
    if not WA_SEND_ENABLED or not WA_TOKEN or not WA_PHONE_ID:
        current_app.logger.warning(
            f"[WhatsApp] Mensaje NO enviado (desactivado o faltan credenciales). to={to_e164} text={text!r}"
        )
        return {"status": "skipped"}

    url = f"https://graph.facebook.com/v20.0/{WA_PHONE_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WA_TOKEN}",
        "Content-Type": "application/json",
    }
    data = {
        "messaging_product": "whatsapp",
        "to": to_e164.replace(" ", ""),
        "type": "text",
        "text": {"body": text},
    }
    resp = requests.post(url, headers=headers, json=data, timeout=15)
    if not resp.ok:
        current_app.logger.error(f"[WhatsApp] send_text error {resp.status_code}: {resp.text}")
        raise RuntimeError(f"WhatsApp send error: {resp.status_code} {resp.text}")
    return resp.json()
