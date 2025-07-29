# backend/config.py
import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or '0g>G#hwr69RxTc#qt8'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'EstaEsMiClaveDePruebaFinalConSoloLetrasYNumerosABCDEF123456'
    JWT_ACCESS_TOKEN_EXPIRES = 3600
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SQLALCHEMY_ENGINE_OPTIONS = {
        "isolation_level": "READ COMMITTED",
    }

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
