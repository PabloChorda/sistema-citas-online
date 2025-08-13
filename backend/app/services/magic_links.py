# backend/app/services/magic_links.py
import os
import re
from datetime import datetime, timedelta, timezone
from app import db
from app.models import User, MagicLink
from app.utils.phones import normalize_e164
from app.utils.magic_tokens import make_magic_token, decode_magic_token

TTL = int(os.getenv("MAGIC_LINK_TTL_DAYS", 7))
ONE_TIME = os.getenv("MAGIC_LINK_ONE_TIME", "true").lower() == "true"

def _autogen_email_for_phone(phone_e164: str) -> str:
    # +34600111222 -> wa_34600111222@autogen.local
    digits = re.sub(r"[^\d]", "", phone_e164 or "")
    return f"wa_{digits}@autogen.local"

def _ensure_user_for_phone(phone_e164: str) -> User:
    """
    Devuelve el usuario por phone. Si no existe, lo crea (rol client),
    con phone_verified_at=now e is_active=True.
    """
    user = User.query.filter_by(phone_number=phone_e164).first()
    if user:
        changed = False
        if not user.phone_verified_at:
            user.phone_verified_at = datetime.now(timezone.utc)
            changed = True
        if not user.is_active:
            user.is_active = True
            changed = True
        if changed:
            db.session.commit()
        return user

    # Crear nuevo usuario mínimo (email único autogenerado)
    now = datetime.now(timezone.utc)
    email = _autogen_email_for_phone(phone_e164)
    user = User(
        email=email,
        role="client",
        phone_number=phone_e164,
        email_verified=False,
        is_active=True,
        phone_verified_at=now,
    )
    # password_hash puede ser NULL en tu modelo; no seteamos contraseña
    db.session.add(user)
    db.session.commit()
    return user

def create_magic_link_for_phone(phone_raw: str, purpose: str = "booking", allow_autocreate: bool = False):
    """
    Genera y guarda un magic link para el usuario con ese teléfono.
    - allow_autocreate=True (webhook): crea usuario si no existe y marca verificado.
    - allow_autocreate=False (panel): exige usuario existente y con phone verificado.
    """
    phone = normalize_e164(phone_raw)

    if allow_autocreate:
        user = _ensure_user_for_phone(phone)
    else:
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
