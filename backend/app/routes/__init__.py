# backend/app/routes/__init__.py

# Simplemente importamos cada blueprint para que estén disponibles para ser registrados
from .auth import bp as auth_bp
from .provider import provider_bp
from .client import client_bp
from .service import service_bp
from .establishment import establishment_bp
from .availability import availability_bp
# from .time_blocks import bp as time_blocks_bp   
# from .appointments import bp as appointments_bp 
from .email_service import bp as email_service_bp