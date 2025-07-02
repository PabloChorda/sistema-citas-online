# backend/app/routes/__init__.py

# Simplemente importamos cada blueprint para que estén disponibles para ser registrados
from .auth import bp as auth_bp
from .provider import provider_bp
from .client import client_bp
from .service import service_bp
from .establishment import establishment_bp
# from .availability import bp as availability_bp  # Descomenta cuando los uses
# from .time_blocks import bp as time_blocks_bp   # Descomenta cuando los uses
# from .appointments import bp as appointments_bp # Descomenta cuando los uses
from .email_service import bp as email_service_bp