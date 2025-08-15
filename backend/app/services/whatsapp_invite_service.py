#backend/app/services/whatsapp_invite_service.py

from app import db
from app.models.whatsapp_invite import WhatsAppInvite
from app.utils.phones import normalize_e164

def create_invite(phone_raw: str, ttl_minutes: int = 60) -> WhatsAppInvite:
    phone = normalize_e164(phone_raw)
    return WhatsAppInvite.generate(phone, ttl_minutes)

def get_invite(token: str) -> WhatsAppInvite:
    invite = WhatsAppInvite.query.filter_by(token=token).first()
    if not invite or invite.is_expired():
        return None
    return invite

def mark_invite_used(invite: WhatsAppInvite):
    invite.mark_used()
    db.session.commit()
