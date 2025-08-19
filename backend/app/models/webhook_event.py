# backend/app/models/webhook_event.py
from datetime import datetime, timezone
from .. import db

class WebhookEvent(db.Model):
    __tablename__ = "webhook_events"

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.String(100), index=True, nullable=True)
    from_msisdn = db.Column(db.String(32), index=True, nullable=True)
    keyword_detected = db.Column(db.String(32), nullable=True)
    invite_token = db.Column(db.String(64), index=True, nullable=True)
    sent_ok = db.Column(db.Boolean, default=False, nullable=False)
    error_reason = db.Column(db.String(255), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.text("now()"),
        index=True,
    )

    def __repr__(self):
        return f"<WebhookEvent msg={self.message_id} from={self.from_msisdn} ok={self.sent_ok}>"
