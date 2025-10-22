# backend/config.py
import os
from datetime import timedelta 

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or '0g>G#hwr69RxTc#qt8'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'EstaEsMiClaveDePruebaFinalConSoloLetrasYNumerosABCDEF123456'
    _ACCESS_SEC  = int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES', 3600))
    _REFRESH_SEC = int(os.environ.get('JWT_REFRESH_TOKEN_EXPIRES', 2592000))  # 30 días

    JWT_ACCESS_TOKEN_EXPIRES  = timedelta(seconds=_ACCESS_SEC)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(seconds=_REFRESH_SEC)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SQLALCHEMY_ENGINE_OPTIONS = {
        "isolation_level": "READ COMMITTED",
    }

    # =========================
    # 🔐 DEMO MODE (feature flag)
    # =========================
    DEMO_MODE = os.getenv('DEMO_MODE', 'false').strip().lower() == 'true'
    DEMO_SECRET = os.getenv('DEMO_SECRET', '')

    # =========================
    # 🌐 CORS por lista de orígenes (separados por coma)
    # ejemplo: "http://localhost:5173, https://tu-demo.netlify.app"
    # =========================
    CORS_ALLOWED_ORIGINS = [
        o.strip() for o in os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
        if o.strip()
    ]

    # Configuración de PostgreSQL leída de variables de entorno
    DB_USER = os.environ.get('DB_USER')
    DB_PASSWORD = os.environ.get('DB_PASSWORD')
    DB_HOST = os.environ.get('DB_HOST')
    DB_PORT = os.environ.get('DB_PORT')
    DB_NAME = os.environ.get('DB_NAME')

    if DB_USER and DB_PASSWORD and DB_HOST and DB_PORT and DB_NAME:
        SQLALCHEMY_DATABASE_URI = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    else:
        print("ADVERTENCIA: Faltan variables de entorno para PostgreSQL. Revise su archivo .env y la carga.")
        SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"

    # 📧 Configuración para Flask-Mail (Mailhog en desarrollo)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'mailhog')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 1025))
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_USE_TLS = False
    MAIL_USE_SSL = False
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'notificaciones@citasonline.com')

    # 🔒 Otros secretos
    CRON_SECRET = os.environ.get('CRON_SECRET', 'change-me')

# --- selector de config ---
class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

class TestingConfig(Config):
    TESTING = True
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URI", "sqlite:///:memory:")

def get_config():
    return Config