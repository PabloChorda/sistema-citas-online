#backend/app/models/whatsapp_invite.py

import uuid
from datetime import datetime, timedelta, timezone
from .. import db

class WhatsAppInvite(db.Model):
    __tablename__ = "whatsapp_invites"

    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    phone_e164 = db.Column(db.String(50), nullable=False, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.text("now()"))
    next_path = db.Column(db.String(255), nullable=True)  # p.ej. "/booking/42"

    def is_expired(self):
        return datetime.now(timezone.utc) >= self.expires_at

    def mark_used(self):
        self.used_at = datetime.now(timezone.utc)

    @staticmethod
    def generate(phone_e164: str, ttl_minutes: int = 60):
        token = uuid.uuid4().hex
        expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
        invite = WhatsAppInvite(token=token, phone_e164=phone_e164, expires_at=expires)
        db.session.add(invite)
        db.session.commit()
        return invite
