# backend/app/__init__.py

import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import logging
from flask_mail import Mail

# Inicializar extensiones globalmente
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

    # Inicializar extensiones
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    
    # --- INICIALIZACIÓN DE CORS ---
    # Se inicializa aquí para que se aplique a todas las rutas que se registren después.
    CORS(app, supports_credentials=True)

    # --- REGISTRO DE BLUEPRINTS ---
    # Importamos y registramos cada blueprint directamente.
    # Este es el patrón más seguro contra errores de importación.
    from app.routes import (
        auth_bp, provider_bp, client_bp, service_bp, establishment_bp, email_service_bp
    )
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(provider_bp, url_prefix='/api/provider')
    app.register_blueprint(client_bp, url_prefix='/api/client')
    app.register_blueprint(service_bp, url_prefix='/api') # Prefijo /api para rutas como /establishments/...
    app.register_blueprint(establishment_bp, url_prefix='/api') # Prefijo /api para rutas como /establishments
    app.register_blueprint(email_service_bp, url_prefix='/api/email') # Asignamos un prefijo para claridad

    # Importar modelos para que SQLAlchemy los conozca
    with app.app_context():
        from . import models

    # --- RUTAS DE UTILIDAD ---
    @app.route('/health') 
    def health_check():
        return jsonify({"status": "ok"}), 200

    @app.route('/')
    def root():
        return jsonify({"message": "API del Sistema de Citas Online"}), 200

    # Configurar logging al final
    configure_logging(app)
    app.logger.info("Aplicación Flask creada y configurada exitosamente.")
    
    return app


def configure_logging(app):
    # ... (tu función configure_logging se queda igual)
    pass

def verify_critical_config(app):
    # ... (tu función verify_critical_config se queda igual)
    pass

# YA NO NECESITAMOS la función register_blueprints, el registro se hace en create_app