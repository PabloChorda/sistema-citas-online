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


    CORS(app,
     resources={r"/api/*": {"origins": ["http://localhost:5173"]}},
     supports_credentials=True,
     methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
     allow_headers=["Content-Type", "Authorization"]
)



    # Importar modelos AL NIVEL SUPERIOR para evitar warnings de Pylint
    # Esto asegura que SQLAlchemy registre todos los modelos
    from .models import (
        User, Provider, Service, 
        AvailabilityRule, TimeBlock, Appointment
    )
    
    app.logger.info("Todos los modelos importados correctamente desde el módulo modularizado")

    # Registrar blueprints de manera segura
    register_blueprints(app)

    # Ruta de health check
    @app.route('/health') 
    def health_check():
        app.logger.info("Health check solicitado")
        return jsonify({
            "status": "ok", 
            "message": "El backend del sistema de citas online está funcionando!",
            "models_loaded": [
                "User", "Provider", "Service", 
                "AvailabilityRule", "TimeBlock", "Appointment"
            ]
        }), 200

    # Ruta raíz para debugging
    @app.route('/')
    def root():
        return jsonify({
            "message": "API del Sistema de Citas Online",
            "status": "running",
            "version": "2.0 - Modularizado",
            "endpoints": {
                "health": "/health",
                "api": "/api/*"
            }
        }), 200

    app.logger.info(f"Aplicación Flask '{app.name}' creada y configurada exitosamente")
    return app


def configure_logging(app):
    """Configura el sistema de logging de la aplicación."""
    if not app.debug and not app.testing:
        # Configuración para producción
        if not os.path.exists('logs'):
            os.mkdir('logs')
        
        file_handler = logging.FileHandler('logs/app.log')
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
    else:
        # Configuración para desarrollo
        app.logger.setLevel(logging.DEBUG)


def verify_critical_config(app):
    """Verifica que las configuraciones críticas estén presentes."""
    critical_configs = [
        'SECRET_KEY',
        'SQLALCHEMY_DATABASE_URI',
        'JWT_SECRET_KEY'
    ]
    
    missing_configs = []
    for config in critical_configs:
        if not app.config.get(config):
            missing_configs.append(config)
    
    if missing_configs:
        error_msg = f"Configuraciones críticas faltantes: {', '.join(missing_configs)}"
        app.logger.error(error_msg)
        raise ValueError(error_msg)
    
    app.logger.info("Todas las configuraciones críticas están presentes")


def register_blueprints(app):
    """Registra el blueprint principal de la API, que ya incluye todos los sub-blueprints."""
    try:
        from .routes import bp_api
        app.register_blueprint(bp_api, url_prefix='/api')
        app.logger.info("✅ Blueprint maestro 'bp_api' registrado correctamente con prefijo '/api'")
    except ImportError as e:
        app.logger.error(f"❌ Error al registrar el blueprint maestro bp_api: {e}")


def register_available_blueprints(app):
    """Registra solo los blueprints disponibles."""
    blueprint_configs = [
        ('auth_bp', '/api/auth'),
        ('users_bp', '/api/users'),
        ('providers_bp', '/api/providers'),
        ('services_bp', '/api/services'),
        ('appointments_bp', '/api/appointments')
    ]
    
    registered_count = 0
    
    for blueprint_name, url_prefix in blueprint_configs:
        try:
            from .routes import __dict__ as routes_dict
            if blueprint_name in routes_dict:
                blueprint = routes_dict[blueprint_name]
                app.register_blueprint(blueprint, url_prefix=url_prefix)
                registered_count += 1
                app.logger.info(f"Blueprint '{blueprint_name}' registrado en '{url_prefix}'")
        except (ImportError, AttributeError, KeyError):
            app.logger.warning(f"Blueprint '{blueprint_name}' no encontrado, saltando...")
    
    app.logger.info(f"Total de blueprints registrados: {registered_count}")


# Función helper para usar en otros módulos
def get_db():
    """Retorna la instancia de la base de datos."""
    return db