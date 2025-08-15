# backend/app/models/phone_otp.py
from datetime import datetime, timezone
from .. import db

class PhoneOTP(db.Model):
    __tablename__ = "phone_otps"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    phone_e164 = db.Column(db.String(50), nullable=False, index=True)
    code = db.Column(db.String(10), nullable=False)
    purpose = db.Column(db.String(32), nullable=False, index=True)  # e.g. "login"
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True, index=True)
    attempts = db.Column(db.Integer, nullable=False, server_default="0", index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=db.text("now()"))

    user = db.relationship("User", backref=db.backref("phone_otps", lazy="dynamic"))

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) >= self.expires_at

    def is_used(self) -> bool:
        return self.used_at is not None
