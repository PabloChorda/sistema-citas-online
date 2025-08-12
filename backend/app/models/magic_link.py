# backend/app/models/magic_link.py
from datetime import datetime, timezone
from .. import db

class MagicLink(db.Model):
    __tablename__ = "magic_links"

    # PK Integer (como en la migración)
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    # FK a users.user_id (Integer)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)

    # Datos del enlace
    token = db.Column(db.String(512), nullable=False, unique=True, index=True)
    purpose = db.Column(db.String(32), nullable=False, index=True)  # ej. "booking"
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True, index=True)

    # Audit
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=db.text("now()"))

    # Relación
    user = db.relationship(
        "User",
        backref=db.backref("magic_links", lazy="dynamic", passive_deletes=True),
    )

    def is_expired(self) -> bool:
        now = datetime.now(timezone.utc)
        return self.expires_at is not None and now >= self.expires_at

    def is_used(self) -> bool:
        return self.used_at is not None
