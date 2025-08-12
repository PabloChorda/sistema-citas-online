# backend/app/services/magic_links.py
import os
from datetime import datetime, timedelta, timezone
from app import db
from app.models import User, MagicLink
from app.utils.phones import normalize_e164
from app.utils.magic_tokens import make_magic_token, decode_magic_token

TTL = int(os.getenv("MAGIC_LINK_TTL_DAYS", 7))
ONE_TIME = os.getenv("MAGIC_LINK_ONE_TIME", "true").lower() == "true"

def create_magic_link_for_phone(phone_raw: str, purpose: str = "booking"):
    phone = normalize_e164(phone_raw)
    user = User.query.filter_by(phone_number=phone).first()
    if not user or not user.phone_verified_at:
        raise ValueError("Usuario no encontrado o teléfono no verificado")

    token = make_magic_token(user.user_id, phone, TTL)
    ml = MagicLink(
        user_id=user.user_id,
        token=token,
        purpose=purpose,
        expires_at=datetime.now(timezone.utc) + timedelta(days=TTL),
    )
    db.session.add(ml)
    db.session.commit()
    return token, user

def redeem_magic_token(token: str) -> User:
    from sqlalchemy import and_
    try:
        payload = decode_magic_token(token)
    except Exception:
        raise ValueError("Token inválido")

    if payload.get("typ") != "magic-booking":
        raise ValueError("Tipo de token inválido")

    ml = MagicLink.query.filter_by(token=token).first()
    if not ml:
        raise ValueError("Token no registrado")
    if ml.expires_at <= datetime.now(timezone.utc):
        raise ValueError("Token caducado")
    if ONE_TIME and ml.used_at is not None:
        raise ValueError("Token ya utilizado")

    user = User.query.get(payload.get("sub"))
    if not user or user.phone_number != payload.get("pn"):
        raise ValueError("Vinculación usuario/teléfono inválida")

    if ONE_TIME and ml.used_at is None:
        ml.used_at = datetime.now(timezone.utc)
        db.session.commit()

    return user
