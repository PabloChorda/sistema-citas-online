# backend/app/utils/magic_tokens.py
import os, jwt
from datetime import datetime, timedelta, timezone
from flask import current_app

def _jwt_secret():
    # prioriza envs; fallback a config Flask
    return (
        os.getenv("JWT_SECRET")
        or os.getenv("JWT_SECRET_KEY")
        or current_app.config.get("JWT_SECRET_KEY")
        or current_app.config.get("SECRET_KEY")
        or "change-me"
    )

def make_magic_token(user_id: int, phone_e164: str, ttl_days: int = 7) -> str:
    payload = {
        "sub": int(user_id),
        "pn": phone_e164,
        "typ": "magic-booking",
        "exp": datetime.now(timezone.utc) + timedelta(days=ttl_days),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")

def decode_magic_token(token: str) -> dict:
    return jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
