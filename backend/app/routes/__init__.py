# backend/app/routes/__init__.py 

from flask import Blueprint

bp_api = Blueprint('api', __name__)

# Importamos todos los blueprints
from .auth import bp as auth_bp 
from .provider import provider_bp
from .client import client_bp
from .service import service_bp
from .establishment import establishment_bp
from .availability import availability_bp
from .appointment import appointment_bp
from .email_service import bp as email_service_bp
from .dashboard import dashboard_bp 


# Registramos todos los blueprints
bp_api.register_blueprint(auth_bp, url_prefix='/auth')
bp_api.register_blueprint(provider_bp, url_prefix='/provider')
bp_api.register_blueprint(client_bp, url_prefix='/client')
bp_api.register_blueprint(service_bp)
bp_api.register_blueprint(establishment_bp)
bp_api.register_blueprint(availability_bp)
bp_api.register_blueprint(appointment_bp)
bp_api.register_blueprint(email_service_bp, url_prefix='/email')
bp_api.register_blueprint(dashboard_bp, url_prefix='/provider')