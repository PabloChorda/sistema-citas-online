# backend/app/utils/phones.py
import os, re
try:
    import phonenumbers
except Exception:
    phonenumbers = None

DEFAULT_REGION = os.getenv("DEFAULT_PHONE_REGION", "ES")

def normalize_e164(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        raise ValueError("Teléfono vacío")

    if phonenumbers:
        num = phonenumbers.parse(raw, DEFAULT_REGION)
        if not phonenumbers.is_valid_number(num):
            raise ValueError("Teléfono inválido")
        return phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)

    # Fallback simple si no está instalada la lib (dev)
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("34"):
        return f"+{digits}"
    if digits.startswith("+"):
        return digits
    return f"+34{digits}"
