# backend/app/__init__.py

import os
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import logging
from flask_mail import Mail
import threading
import time

# ▶️ Rate limiting
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

# Inicializar extensiones globalmente SIN VINCULARLAS A LA APP
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
mail = Mail()

# Limiter: usa Redis si está configurado, si no memoria (dev)
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv("LIMITER_STORAGE_URI", "memory://"),
    strategy="moving-window",
    headers_enabled=True,
)

def create_app(config_class_object):
    """
    Factory de la aplicación Flask.
    """
    app = Flask(__name__)
    app.config.from_object(config_class_object)

    # Cabeceras de rate-limit también desde config (opcional/extra)
    app.config.setdefault("RATELIMIT_HEADERS_ENABLED", True)

    # Configurar logging
    configure_logging(app)
    app.logger.info(f"Aplicación Flask '{app.name}' inicializándose con config: {config_class_object.__name__}")

    # Si hay proxy delante (Nginx/Cloudflare), usa ProxyFix para IP real
    # En dev no molesta; en prod es imprescindible si hay proxy.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

    # Inicializar extensiones CON la app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)  # ⬅️ Rate limiter

    CORS(
        app,
        resources={r"/api/*": {"origins": "http://localhost:5173"}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"]
    )

    # --- IMPORTACIONES DENTRO DEL CONTEXTO DE LA APP ---
    with app.app_context():
        # 1) Importar modelos primero (asegura que Alembic vea TODAS las tablas)
        from . import models
        app.logger.info("Modelos importados.")

        # 2) Importar y registrar blueprints del API agrupado
        from app.routes import bp_api
        app.register_blueprint(bp_api, url_prefix='/api')
        app.logger.info("Blueprint principal 'bp_api' registrado en /api.")

        # 3) Registrar el webhook de WhatsApp (fuera de /api)
        from app.routes.whatsapp import bp as bp_whatsapp
        app.register_blueprint(bp_whatsapp)  # url_prefix definido en el propio blueprint: /webhooks/whatsapp
        app.logger.info("Webhook 'bp_whatsapp' registrado en /webhooks/whatsapp.")

        # 4) Rutas de utilidad
        @app.route('/health')
        def health_check():
            return jsonify({"status": "ok"}), 200

        @app.route('/')
        def root():
            return jsonify({"message": "API del Sistema de Citas Online"}), 200

        # 5) Verificación de configuración crítica
        verify_critical_config(app)

    # --- HANDLER GLOBAL 429 (rate limit) ---
    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({
            "msg": "Demasiadas solicitudes, intenta de nuevo más tarde.",
            "error": "rate_limited",
            "limit": getattr(e, "description", None)
        }), 429

    # --- COMANDOS CLI (fuera del with, pero dentro de create_app) ---
    # Comandos OTP ya existentes
    from app.services.otp_service import cleanup_phone_otps

    @app.cli.command("purge-otps")
    def purge_otps_command():
        """Borra OTPs usados o expirados antiguos (por defecto, >24h)."""
        try:
            keep_hours = int(os.getenv("OTP_PURGE_KEEP_HOURS", "24"))
        except Exception:
            keep_hours = 24
        deleted = cleanup_phone_otps(keep_hours=keep_hours)
        app.logger.info(f"[OTP] Purga completada. Registros borrados: {deleted}")
        print(f"Purga completada. Registros borrados: {deleted}")

    # ✅ Import tardío: registra los comandos de purga de WhatsApp (invites + eventos)
    from app.commands.purge import register_cli
    register_cli(app)

    app.logger.info("Aplicación Flask creada y configurada exitosamente.")

    # Iniciar purgado automático si está habilitado por ENV
    start_otp_purger_if_enabled(app)

    return app


def configure_logging(app):
    """Configura el sistema de logging de la aplicación"""
    try:
        if not app.debug and not app.testing:
            if app.config.get('LOG_TO_STDOUT'):
                stream_handler = logging.StreamHandler()
                stream_handler.setLevel(logging.INFO)
                formatter = logging.Formatter(
                    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
                )
                stream_handler.setFormatter(formatter)
                app.logger.addHandler(stream_handler)
            else:
                # Configurar logging a archivo
                if not os.path.exists('logs'):
                    try:
                        os.mkdir('logs')
                    except OSError as e:
                        print(f"No se pudo crear el directorio de logs: {e}")

                if os.path.exists('logs'):
                    file_handler = logging.FileHandler('logs/flask_backend.log')
                    file_handler.setFormatter(logging.Formatter(
                        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
                    ))
                    file_handler.setLevel(logging.INFO)
                    app.logger.addHandler(file_handler)

        # Establecer nivel de log
        app.logger.setLevel(logging.INFO if not app.debug else logging.DEBUG)

    except Exception as e:
        print(f"Error configurando logging: {e}")


def verify_critical_config(app):
    """Verifica que la configuración crítica esté presente"""
    try:
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI')
        app.logger.info(f"SQLALCHEMY_DATABASE_URI configurada: {'Sí' if db_uri else 'No'}")

        jwt_secret = app.config.get('JWT_SECRET_KEY')
        app.logger.info(f"JWT_SECRET_KEY configurada: {'Sí' if jwt_secret else 'No'}")

        if not jwt_secret:
            app.logger.critical("¡JWT_SECRET_KEY NO ESTÁ CONFIGURADA! La autenticación JWT fallará.")

        if not db_uri:
            app.logger.critical("¡SQLALCHEMY_DATABASE_URI NO ESTÁ CONFIGURADA! La base de datos no funcionará.")

    except Exception as e:
        app.logger.error(f"Error verificando configuración: {e}", exc_info=True)


def _run_otp_purger(app, interval_min: int, keep_hours: int):
    """Bucle que borra OTPs usados/expirados cada interval_min minutos."""
    from app.services.otp_service import cleanup_phone_otps
    with app.app_context():
        app.logger.info(f"[OTP] Purger iniciado: cada {interval_min} min; manteniendo últimos {keep_hours} h")
    while True:
        try:
            with app.app_context():
                deleted = cleanup_phone_otps(keep_hours=keep_hours)
                app.logger.info(f"[OTP] Purger ejecutado. Registros borrados: {deleted}")
        except Exception as e:
            with app.app_context():
                app.logger.error(f"[OTP] Purger error: {e}", exc_info=True)
        time.sleep(max(60, interval_min * 60))  # seguridad mínima de 60s


def start_otp_purger_if_enabled(app):
    """Arranca el purger si OTP_PURGE_INTERVAL_MIN > 0 y estamos en el proceso principal (evita doble hilo en debug)."""
    try:
        interval_min = int(os.getenv("OTP_PURGE_INTERVAL_MIN", "0"))
        keep_hours = int(os.getenv("OTP_PURGE_KEEP_HOURS", "24"))
    except Exception:
        interval_min = 0
        keep_hours = 24

    # No arrancar si está deshabilitado
    if interval_min <= 0:
        app.logger.info("[OTP] Purger deshabilitado (OTP_PURGE_INTERVAL_MIN <= 0)")
        return

    # Evitar hilo duplicado con reloader de Werkzeug
    if os.getenv("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        t = threading.Thread(
            target=_run_otp_purger,
            args=(app, interval_min, keep_hours),
            daemon=True,
            name="otp-purger",
        )
        t.start()
        app.logger.info("[OTP] Purger en segundo plano arrancado.")
    else:
        app.logger.info("[OTP] Purger no arrancado en subproceso del reloader.")
