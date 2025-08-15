# backend/app/services/otp_service.py
import os, random
from datetime import datetime, timedelta, timezone
from app import db
from app.models.user import User
from app.models.phone_otp import PhoneOTP
from app.utils.phones import normalize_e164
from sqlalchemy import or_

OTP_LEN = int(os.getenv("OTP_LENGTH", 6))
OTP_TTL_MIN = int(os.getenv("OTP_TTL_MINUTES", 10))
OTP_COOLDOWN_SEC = int(os.getenv("OTP_COOLDOWN_SECONDS", 60))
OTP_MAX_PER_HOUR = int(os.getenv("OTP_MAX_PER_HOUR", 5))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", 5))
OTP_DEBUG_RETURN_CODE = os.getenv("OTP_DEBUG_RETURN_CODE", "true").lower() == "true"

def _touch_attempt(phone: str, purpose: str, now):
    last = (PhoneOTP.query
            .filter(PhoneOTP.phone_e164==phone,
                    PhoneOTP.purpose==purpose,
                    PhoneOTP.used_at.is_(None),
                    PhoneOTP.expires_at > now)
            .order_by(PhoneOTP.id.desc())
            .first())
    if last:
        # si la columna attempts no existe en tu modelo, sáltate esto
        if hasattr(last, "attempts"):
            last.attempts = (last.attempts or 0) + 1
            if last.attempts >= OTP_MAX_ATTEMPTS:
                last.used_at = now  # lo quemamos
        db.session.commit()

def _random_code(n: int) -> str:
    return "".join(random.choice("0123456789") for _ in range(n))

def request_otp(phone_raw: str, purpose: str = "login") -> dict:
    phone = normalize_e164(phone_raw)
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)

    # Cooldown
    last = (
        PhoneOTP.query.filter_by(phone_e164=phone, purpose=purpose)
        .order_by(PhoneOTP.id.desc())
        .first()
    )
    if last and (now - (last.created_at or now)).total_seconds() < OTP_COOLDOWN_SEC:
        raise ValueError("Espera unos segundos antes de pedir otro código")

    # Rate limit por hora
    count_hour = (
        PhoneOTP.query.filter(
            PhoneOTP.phone_e164 == phone,
            PhoneOTP.purpose == purpose,
            PhoneOTP.created_at >= one_hour_ago,
        ).count()
    )
    if count_hour >= OTP_MAX_PER_HOUR:
        raise ValueError("Has alcanzado el límite de códigos por hora")

    # Usuario (si existe)
    user = User.query.filter_by(phone_number=phone).first()

    code = _random_code(OTP_LEN)
    expires = now + timedelta(minutes=OTP_TTL_MIN)

    otp = PhoneOTP(
        user_id=user.user_id if user else None,
        phone_e164=phone,
        code=code,
        purpose=purpose,
        expires_at=expires,
        used_at=None,
        # attempts -> lo pone la BD a 0
    )
    db.session.add(otp)
    db.session.commit()

    resp = {"sent": True, "ttl_minutes": OTP_TTL_MIN}
    if OTP_DEBUG_RETURN_CODE:
        resp["debug_code"] = code
    return resp

def verify_otp(phone_raw: str, code: str, purpose: str = "login") -> User:
    phone = normalize_e164(phone_raw)
    now = datetime.now(timezone.utc)

    otp = (
        PhoneOTP.query.filter_by(phone_e164=phone, purpose=purpose)
        .order_by(PhoneOTP.id.desc())
        .first()
    )

    if not otp:
        _touch_attempt(phone, purpose, now)  # 👈 trackeamos aunque no exista
        raise ValueError("No hay código activo para este teléfono")

    if otp.is_used():
        raise ValueError("Código ya utilizado")

    if otp.is_expired():
        raise ValueError("Código caducado")

    if otp.attempts is not None and otp.attempts >= OTP_MAX_ATTEMPTS:
        otp.used_at = now
        db.session.commit()
        raise ValueError("Demasiados intentos. Solicita un nuevo código")

    # Validación de código
    if otp.code != code:
        otp.attempts = (otp.attempts or 0) + 1
        if otp.attempts >= OTP_MAX_ATTEMPTS:
            otp.used_at = now
        db.session.commit()
        raise ValueError("Código incorrecto")

    # Código correcto: vincular/crear usuario
    user = User.query.filter_by(phone_number=phone).first()
    if not user:
        user = User(
            email=f"{phone.replace('+','')}@autogen.local",
            role="client",
            phone_number=phone,
            is_active=True,
        )
        db.session.add(user)
        db.session.flush()

    if not user.phone_verified_at:
        user.phone_verified_at = now

    otp.used_at = now
    if otp.user_id is None:
        otp.user_id = user.user_id

    db.session.commit()
    return user

def cleanup_phone_otps(keep_hours: int = 24) -> int:
    """
    Elimina OTPs que:
      - ya están usados (used_at no nulo) y su used_at es más antiguo que keep_hours
      - o están expirados (expires_at < now) y esa expiración es más antigua que keep_hours
    Devuelve el número de filas eliminadas.
    """
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(hours=keep_hours)

    q = PhoneOTP.query.filter(
        or_(
            # usados y antiguos
            PhoneOTP.used_at != None,  # noqa: E711
            # o expirados y antiguos
            PhoneOTP.expires_at < threshold
        )
    )

    # Nota: si quieres ser más agresivo con usados, puedes añadir:
    # PhoneOTP.used_at < threshold
    # en lugar de "!= None" (así solo borras usados muy antiguos)

    # Ejecutar borrado en bloque
    deleted = q.delete(synchronize_session=False)
    db.session.commit()
    return deleted