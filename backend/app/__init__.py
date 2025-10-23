# backend/app/__init__.py

import logging
import os
import sys
import threading
import time

import click
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from werkzeug.middleware.proxy_fix import ProxyFix

# -----------------
# Extensiones
# -----------------
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
mail = Mail()
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv("LIMITER_STORAGE_URI", "memory://"),
    strategy="moving-window",
    headers_enabled=True,
)

# -----------------
# Helpers
# -----------------
def configure_logging(app: Flask) -> None:
    try:
        app.logger.setLevel(logging.INFO if not app.debug else logging.DEBUG)
    except Exception as e:
        print(f"Error configurando logging: {e}")


def verify_critical_config(app: Flask) -> None:
    try:
        db_uri = app.config.get("SQLALCHEMY_DATABASE_URI")
        jwt_secret = app.config.get("JWT_SECRET_KEY")
        app.logger.info(
            f"DB URI: {'OK' if db_uri else 'FALTA'} | JWT: {'OK' if jwt_secret else 'FALTA'}"
        )
    except Exception as e:
        app.logger.error("Verificación de config falló: %s", e, exc_info=True)


def _run_otp_purger(app: Flask, interval_min: int, keep_hours: int) -> None:
    from .services.otp_service import cleanup_phone_otps

    with app.app_context():
        app.logger.info(
            f"[OTP] Purger cada {interval_min} min; manteniendo {keep_hours} h"
        )

    while True:
        try:
            with app.app_context():
                cleanup_phone_otps(keep_hours=keep_hours)
        except Exception as e:
            with app.app_context():
                app.logger.error("[OTP] Purger error: %s", e, exc_info=True)
        time.sleep(max(60, interval_min * 60))


def start_otp_purger_if_enabled(app: Flask) -> None:
    try:
        interval_min = int(os.getenv("OTP_PURGE_INTERVAL_MIN", "0") or "0")
        keep_hours = int(os.getenv("OTP_PURGE_KEEP_HOURS", "24") or "24")
    except Exception:
        interval_min, keep_hours = 0, 24

    if interval_min <= 0:
        return

    if os.getenv("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        t = threading.Thread(
            target=_run_otp_purger,
            args=(app, interval_min, keep_hours),
            daemon=True,
            name="otp-purger",
        )
        t.start()


# -----------------
# CLI explícitos
# -----------------
def register_db_cli(app: Flask) -> None:
    """Registra explícitamente el grupo 'db' de Flask-Migrate."""
    try:
        from flask_migrate import cli as fm_cli

        app.cli.add_command(fm_cli.db, name="db")
        app.logger.debug("[APP] Grupo CLI 'db' registrado explícitamente")
    except Exception as e:
        app.logger.error(
            "[APP] No se pudo registrar grupo 'db': %s", e, exc_info=True
        )


def register_demo_cli(app: Flask) -> None:
    """Registra el grupo 'demo' y sus comandos."""

    @click.group("demo")
    def demo_group():
        """Comandos de datos de demostración."""
        pass

    @demo_group.command("seed")
    @click.option(
        "--force",
        is_flag=True,
        default=False,
        help="Reinserta demo aunque existan datos.",
    )
    def seed_demo(force):
        """Inserta/actualiza datos de demo de forma idempotente y sin autoflush prematuro."""
        from app import db as _db
        from app.models import User, Provider, Establishment, Service, Staff

        try:
            # 0) Limpieza fuerte opcional
            if force:
                # orden por FKs: hijos -> padres
                _db.session.execute(Service.__table__.delete())
                _db.session.execute(Staff.__table__.delete())
                _db.session.execute(Establishment.__table__.delete())
                _db.session.execute(Provider.__table__.delete())
                _db.session.execute(User.__table__.delete())
                _db.session.commit()

            created = {
                "user": False,
                "provider": False,
                "est": False,
                "svc1": False,
                "svc2": False,
                "staff": False,
            }

            # 1) USER (idempotente por email)
            with _db.session.no_autoflush:
                user = User.query.filter_by(email="demo@example.com").first()

            if not user:
                user = User(
                    email="demo@example.com",
                    first_name="Demo",
                    last_name="User",
                    role="client",
                    is_active=True,
                )
                _db.session.add(user)
                _db.session.flush()  # asegura user.user_id
                created["user"] = True

            # 2) PROVIDER (PK = provider_id == user.user_id, NOT NULL: cif, verificado, activo)
            with _db.session.no_autoflush:
                provider = Provider.query.get(user.user_id)  # PK lookup, evita autoflush
            if not provider:
                provider = Provider(
                    provider_id=user.user_id,  # PK / FK a users.user_id
                    nombre_comercial="Demo Spa",
                    cif="B12345678",  # NOT NULL
                    verificado=False,  # NOT NULL
                    activo=True,  # NOT NULL
                    timezone="Europe/Madrid",
                    # opcionales:
                    tipo_empresa=None,
                    bio=None,
                    imagen_perfil_url=None,
                    telefono_contacto=None,
                    email_contacto=None,
                    web=None,
                    idiomas_hablados=None,
                    direccion_fiscal=None,
                )
                _db.session.add(provider)
                _db.session.flush()  # fija PK; importante para evitar NULL en autoflush
                created["provider"] = True

            # 3) ESTABLISHMENT (NOT NULL de festivos y mínimos)
            with _db.session.no_autoflush:
                est = (
                    Establishment.query.filter_by(
                        provider_id=provider.provider_id,
                        nombre="Sede Central",
                    ).first()
                )

            if not est:
                est = Establishment(
                    provider_id=provider.provider_id,
                    nombre="Sede Central",
                    has_multiple_staff=False,
                    direccion_completa="Calle Falsa 123, Madrid",
                    provincia="Madrid",
                    localidad="Madrid",
                    # festivos (todos NOT NULL en tu esquema)
                    holiday_auto_enabled=False,
                    holiday_country_code="ES",
                    holiday_region_code=None,
                    holiday_types=[],  # si es ARRAY/JSON, [] cumple NOT NULL
                    holiday_years_ahead=0,
                    # recomendables:
                    visible_en_busquedas=True,
                    activo=True,
                )
                _db.session.add(est)
                _db.session.flush()  # asegura est.id
                created["est"] = True

            # 4) SERVICES (único por (establishment_id, nombre))
            def ensure_service(establishment_id, nombre, defaults):
                with _db.session.no_autoflush:
                    svc = Service.query.filter_by(
                        establishment_id=establishment_id, nombre=nombre
                    ).first()
                if svc:
                    # opcional: actualizar algunos campos si cambian
                    return False
                svc = Service(
                    establishment_id=establishment_id,
                    nombre=nombre,
                    **defaults,
                )
                _db.session.add(svc)
                return True

            created["svc1"] = ensure_service(
                est.id,
                "Masaje relajante",
                dict(
                    descripcion="Sesión de 60 minutos",
                    duracion_minutos=60,
                    precio=35.00,
                    categoria=None,
                    is_active=True,
                    orden=1,
                    requiere_confirmacion_manual=False,
                    limite_reservas_diarias=None,
                ),
            )
            created["svc2"] = ensure_service(
                est.id,
                "Masaje descontracturante",
                dict(
                    descripcion="Sesión de 45 minutos",
                    duracion_minutos=45,
                    precio=29.90,
                    categoria=None,
                    is_active=True,
                    orden=2,
                    requiere_confirmacion_manual=False,
                    limite_reservas_diarias=None,
                ),
            )

            # 5) STAFF (vincula al usuario demo)
            with _db.session.no_autoflush:
                staff = Staff.query.filter_by(
                    user_id=user.user_id, establishment_id=est.id
                ).first()
            if not staff:
                staff = Staff(
                    user_id=user.user_id,
                    establishment_id=est.id,
                    rol="terapeuta",
                    activo=True,
                )
                _db.session.add(staff)
                created["staff"] = True

            _db.session.commit()
            click.echo(
                "[demo] OK. Nuevos -> user:{user}, provider:{provider}, est:{est}, "
                "svc1:{svc1}, svc2:{svc2}, staff:{staff}".format(**created)
            )
        except Exception as ex:
            _db.session.rollback()
            click.echo(f"[demo] ERROR: {ex}")
            raise

    # Añadir el grupo a la app
    app.cli.add_command(demo_group, name="demo")
    app.logger.debug("[APP] Grupo CLI 'demo' registrado explícitamente")


# -----------------
# App factory
# -----------------
def create_app(config_class_object):
    app = Flask(__name__)
    app.config.from_object(config_class_object)
    app.config.setdefault("RATELIMIT_HEADERS_ENABLED", True)

    configure_logging(app)

    # Proxy real IP/host si hay reverse proxy
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

    # Extensiones
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)

    # Asegurar extension migrate presente en app.extensions
    app.extensions.setdefault("migrate", migrate)

    # CORS
    allowed_origins = (
        app.config.get("CORS_ALLOWED_ORIGENS")  # por si existe typo
        or app.config.get("CORS_ALLOWED_ORIGINS")
        or []
    )
    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins if allowed_origins else "*"}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    )

    with app.app_context():
        # 1) Importar modelos y aplicar shim para que 'from app.models ...' sea estable
        from . import models as _models  # noqa: F401

        sys.modules.setdefault("app.models", _models)
        app.logger.debug(
            "[APP] Shim aplicado: 'app.models' -> paquete real de modelos"
        )

        # 2) Blueprints
        from .routes import bp_api

        app.register_blueprint(bp_api, url_prefix="/api")

        try:
            from .routes.admin import admin_bp

            app.register_blueprint(admin_bp, url_prefix="/api")
        except Exception:
            app.logger.debug("[APP] Blueprint 'admin' no disponible (OK)")

        from .routes.whatsapp import bp as bp_whatsapp

        app.register_blueprint(bp_whatsapp)

        # 3) Rutas utilitarias
        @app.route("/health")
        def health():
            return jsonify({"status": "ok"}), 200

        @app.route("/")
        def root():
            return jsonify({"message": "API del Sistema de Citas Online"}), 200
        
        @app.route("/ready")
        def ready():
            try:
                from app.models import User  # consulta muy ligera
                _ = User.query.first()
                return jsonify({"ready": True}), 200
            except Exception as e:
                app.logger.error("Ready check failed: %s", e, exc_info=True)
                return jsonify({"ready": False}), 503

        @app.route("/version")
        def version():
            return jsonify({"version": os.getenv("APP_VERSION", "demo")}), 200

        # 4) Verificación de config
        verify_critical_config(app)

    @app.cli.command("ping")
    def ping():
        """Comando de prueba para verificar que el factory registró CLI."""
        click.echo("pong")

    # Handler global 429
    @app.errorhandler(429)
    def ratelimit_handler(e):  # noqa: ARG001 (flask signature)
        return jsonify({"msg": "Demasiadas solicitudes"}), 429

    # ---- Registrar CLI explícitamente (siempre) ----
    register_db_cli(app)
    register_demo_cli(app)

    # Otros CLI opcionales
    try:
        from .services.otp_service import cleanup_phone_otps

        @app.cli.command("purge-otps")
        def purge_otps_command():
            keep_hours = int(os.getenv("OTP_PURGE_KEEP_HOURS", "24") or "24")
            deleted = cleanup_phone_otps(keep_hours=keep_hours)
            click.echo(f"Purga completada. Registros borrados: {deleted}")
    except Exception as ex:
        app.logger.debug(f"[APP] CLI 'purge-otps' no inicializado: {ex}")

    try:
        from .commands.purge import register_cli

        register_cli(app)
    except Exception as ex:
        app.logger.debug(f"[APP] CLI 'purge' no inicializado: {ex}")

    # Hilo de purga OTP (opcional)
    start_otp_purger_if_enabled(app)

    return app
