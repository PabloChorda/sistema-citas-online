# backend/app/models/webhook_event.py
from .. import db

class WebhookEvent(db.Model):
    __tablename__ = "webhook_events"

    id = db.Column(db.Integer, primary_key=True)

    # Idempotencia: un message_id solo una vez (puede venir vacío en algunos eventos)
    message_id = db.Column(db.String(128), unique=True, index=True, nullable=True)

    # Trazas
    event_type = db.Column(db.String(32), nullable=False)  # 'guard' | 'message' | 'webhook' | 'error'
    from_msisdn = db.Column(db.String(32), index=True, nullable=True)
    keyword_detected = db.Column(db.Boolean, nullable=True)
    invite_token = db.Column(db.String(64), index=True, nullable=True)
    sent_ok = db.Column(db.Boolean, nullable=True)
    signature_valid = db.Column(db.Boolean, nullable=True)
    error_reason = db.Column(db.String(255), nullable=True)

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.text("now()"),
        index=True,
    )

    __table_args__ = (
        db.Index("ix_webhook_events_sender_created", "from_msisdn", "created_at"),
    )

    def __repr__(self):
        return f"<WebhookEvent type={self.event_type} msg={self.message_id} from={self.from_msisdn} ok={self.sent_ok}>"