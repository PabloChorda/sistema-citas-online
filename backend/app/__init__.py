# backend/app/__init__.py
import os
# La carga de dotenv se hará en run.py ANTES de llamar a create_app
# por lo que no es necesaria aquí si config.py ya está leyendo os.environ

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager # Ya lo tenías importado, ¡bien!

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager() # Ya tenías la instancia creada, ¡bien!

def create_app(config_class_object):
    """
    Factory de la aplicación Flask.
    Recibe un objeto de clase de configuración (no el nombre de la clase).
    """
    app = Flask(__name__, instance_relative_config=False)

    # Cargar configuración desde el objeto de clase proporcionado
    app.config.from_object(config_class_object)

    # Inicializar extensiones de Flask
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    jwt.init_app(app) # <--- ESTA ES LA LÍNEA CLAVE QUE FALTABA ACTIVAR

    from . import models

    try:
        from .routes import bp_api
        app.register_blueprint(bp_api, url_prefix='/api')
        app.logger.info("Blueprint 'bp_api' registrado en /api")
    except ImportError:
        app.logger.warning("No se pudo importar o registrar 'bp_api' desde .routes. Asegúrate que exista.")

    @app.route('/')
    def health_check():
        app.logger.info("Acceso a la ruta de health_check '/'")
        return "¡El backend del sistema de citas online está funcionando!"

    app.logger.info(f"Aplicación Flask creada con la configuración: {config_class_object.__name__}")
    app.logger.info(f"SQLALCHEMY_DATABASE_URI: {app.config.get('SQLALCHEMY_DATABASE_URI')}")
    # Añadimos una verificación para JWT_SECRET_KEY también, ya que es crucial
    app.logger.info(f"JWT_SECRET_KEY está configurada: {'Sí' if app.config.get('JWT_SECRET_KEY') else 'No, ¡CONFIGÚRALA!'}")


    return app