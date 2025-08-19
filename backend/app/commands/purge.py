# backend/app/commands/purge.py
import click
from datetime import datetime, timedelta, timezone
from app.models.whatsapp_invite import WhatsAppInvite
from app.models.webhook_event import WebhookEvent

def register_cli(app):
    @app.cli.command("purge-whatsapp-invites")
    @click.option("--keep-hours", default=24, help="Mantener usados/expirados recientes (horas).")
    def purge_whatsapp_invites(keep_hours):
        """Elimina WhatsAppInvite usados/expirados más antiguos que keep-hours."""
        # ⬇️ Import tardío para evitar import circular
        from app import db

        cutoff = datetime.now(timezone.utc) - timedelta(hours=keep_hours)
        q_used = WhatsAppInvite.query.filter(
            WhatsAppInvite.used_at.isnot(None),
            WhatsAppInvite.used_at < cutoff,
        )
        q_exp = WhatsAppInvite.query.filter(
            WhatsAppInvite.used_at.is_(None),
            WhatsAppInvite.expires_at < cutoff,
        )
        deleted = q_used.delete(synchronize_session=False) + q_exp.delete(synchronize_session=False)
        db.session.commit()
        click.echo(f"Eliminadas {deleted} invitaciones (usadas/expiradas) anteriores a {keep_hours}h.")

    @app.cli.command("purge-webhook-events")
    @click.option("--days", default=30, help="Eliminar eventos más antiguos que N días.")
    def purge_webhook_events(days):
        """Elimina WebhookEvent antiguos para no crecer sin control."""
        # ⬇️ Import tardío para evitar import circular
        from app import db

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        deleted = WebhookEvent.query.filter(WebhookEvent.created_at < cutoff) \
                                    .delete(synchronize_session=False)
        db.session.commit()
        click.echo(f"Eliminados {deleted} eventos anteriores a {days} días.")
