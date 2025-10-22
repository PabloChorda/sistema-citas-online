# backend/app/cli.py
import click
from flask import current_app

def init_cli(app):
    """Registra el grupo 'demo' y sus subcomandos."""
    @app.cli.group("demo")
    def demo_group():
        """Comandos de datos de demostración."""
        pass

    @demo_group.command("seed")
    @click.option("--force", is_flag=True, default=False, help="Reinserta demo aunque existan datos.")
    def seed_demo(force):
        """
        Inserta datos de demostración en la base de datos.
        """
        from app import db
        from app.models import User, Provider, Service  # importa lo que necesites

        app = current_app._get_current_object()
        app.logger.info("[demo] Sembrando datos de demo (force=%s)", force)

        # Ejemplo mínimo: crea un usuario si no existe
        created = 0
        with app.app_context():
            if force:
                # borra lo que consideres de demo
                Service.query.delete()
                Provider.query.delete()
                User.query.delete()
                db.session.commit()

            if not User.query.first():
                u = User(email="demo@example.com", name="Demo User")  # ajusta campos reales de tu modelo
                db.session.add(u)
                db.session.commit()
                created += 1

        click.echo(f"[demo] Listo. Registros creados: {created}")
