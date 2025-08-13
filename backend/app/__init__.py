# backend/app/__init__.py

import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import logging
from flask_mail import Mail

# Inicializar extensiones globalmente SIN VINCULARLAS A LA APP
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
mail = Mail()

def create_app(config_class_object):
    """
    Factory de la aplicación Flask.
    """
    app = Flask(__name__) 
    app.config.from_object(config_class_object)

    # Configurar logging
    configure_logging(app)
    app.logger.info(f"Aplicación Flask '{app.name}' inicializándose con config: {config_class_object.__name__}")
    
    # Inicializar extensiones CON la app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    
    CORS(
        app,
        resources={r"/api/*": {"origins": "http://localhost:5173"}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"]
    )

    # --- IMPORTACIONES DENTRO DEL CONTEXTO DE LA APP ---
    with app.app_context():
        # 1) Importar modelos primero
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

    app.logger.info("Aplicación Flask creada y configurada exitosamente.")
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
