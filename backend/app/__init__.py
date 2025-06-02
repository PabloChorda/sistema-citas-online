import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def create_app(config_class_object):
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(config_class_object)

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    jwt.init_app(app)

    from . import models
    from .routes.auth import auth_bp
    from .routes.services import services_bp
    from .routes.availability import availability_bp
    from .routes.time_blocks import timeblocks_bp
    from .routes.appointments import appointments_bp
    from .routes.health import health_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(services_bp, url_prefix='/api/services')
    app.register_blueprint(availability_bp, url_prefix='/api/availability')
    app.register_blueprint(timeblocks_bp, url_prefix='/api/time-blocks')
    app.register_blueprint(appointments_bp, url_prefix='/api/appointments')
    app.register_blueprint(health_bp, url_prefix='/api')

    @app.route('/')
    def health_check():
        return "¡El backend del sistema de citas online está funcionando!"

    return app