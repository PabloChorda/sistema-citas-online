# backend/config.py
import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or '0g>G#hwr69RxTc#qt8'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'EstaEsMiClaveDePruebaFinalConSoloLetrasYNumerosABCDEF123456'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Configuración de PostgreSQL leída de variables de entorno
    DB_USER = os.environ.get('DB_USER')
    DB_PASSWORD = os.environ.get('DB_PASSWORD')
    DB_HOST = os.environ.get('DB_HOST')
    DB_PORT = os.environ.get('DB_PORT')
    DB_NAME = os.environ.get('DB_NAME')

    if DB_USER and DB_PASSWORD and DB_HOST and DB_PORT and DB_NAME:
        SQLALCHEMY_DATABASE_URI = \
            f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    else:
        print("ADVERTENCIA: Faltan variables de entorno para PostgreSQL. Revise su archivo .env y la carga.")
        # Puedes poner un fallback a SQLite aquí si quieres o simplemente dejar que falle
        # si las variables no están, lo que es mejor para detectar errores.
        SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:" # ¡Solo como un fallback extremo y ruidoso!