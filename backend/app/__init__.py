# backend/app/__init__.py
import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import logging
from flask_mail import Mail


# Inicializar extensiones globalmente pero configurarlas en create_app
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
mail = Mail()

def create_app(config_class_object):
    """
    Factory de la aplicación Flask.
    Recibe un objeto de clase de configuración.
    """
    app = Flask(__name__) 

    # Cargar configuración desde el objeto de clase proporcionado
    app.config.from_object(config_class_object)

    # Configurar logging ANTES de cualquier otra cosa
    configure_logging(app)
    
    app.logger.info(f"Aplicación Flask '{app.name}' inicializándose con config: {config_class_object.__name__}")

    # Verificar configuración crítica
    verify_critical_config(app)

    # Inicializar extensiones de Flask con la app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)


    # Configuración CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Importar modelos aquí para que SQLAlchemy los conozca
    try:
        from . import models
        app.logger.info("Modelos importados correctamente")
    except ImportError as e:
        app.logger.error(f"Error importando modelos: {e}", exc_info=True)

    # Registrar blueprints de manera segura
    register_blueprints(app)

    # Ruta de health check
    @app.route('/health') 
    def health_check():
        app.logger.info("Health check solicitado")
        return jsonify({
            "status": "ok", 
            "message": "El backend del sistema de citas online está funcionando!"
        }), 200

    # Ruta raíz para debugging
    @app.route('/')
    def root():
        return jsonify({
            "message": "API del Sistema de Citas Online",
            "status": "running",
            "endpoints": {
                "health": "/health",
                "api": "/api/*"
            }
        }), 200

    app.logger.info(f"Aplicación Flask '{app.name}' creada y configurada exitosamente")
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

def register_blueprints(app):
    """Registra todos los blueprints de manera segura"""
    try:
        from .routes import bp_api
        app.register_blueprint(bp_api, url_prefix='/api')
        app.logger.info("Blueprint 'bp_api' registrado correctamente con prefijo '/api'")
        
        # Listar todas las rutas registradas para debugging
        with app.app_context():
            app.logger.info("=== RUTAS REGISTRADAS ===")
            for rule in app.url_map.iter_rules():
                methods = ','.join(sorted(rule.methods - {'HEAD', 'OPTIONS'}))
                app.logger.info(f"{rule.endpoint:30s} {methods:20s} {rule.rule}")
            app.logger.info("========================")
            
    except ImportError as e:
        app.logger.error(f"Error CRÍTICO importando 'bp_api' desde .routes: {e}", exc_info=True)
        app.logger.error("Asegúrate que app/routes/__init__.py exista y defina 'bp_api'")
    except Exception as e: 
        app.logger.error(f"Error inesperado registrando 'bp_api': {e}", exc_info=True)