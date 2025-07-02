# backend/app/routes/__init__.py
from flask import Blueprint

# Crear el blueprint principal para la API
bp_api = Blueprint('api', __name__)

# Importaciones tardías para evitar problemas circulares
# Se envuelven en try-except para dar logs más claros si un módulo falla.

try:
    from .auth import bp as auth_module_bp
    bp_api.register_blueprint(auth_module_bp, url_prefix='/auth')
    print("✅ Blueprint 'auth' registrado correctamente")
except ImportError as e:
    print(f"❌ Error importando auth blueprint: {e}")

try:
    from .provider import provider_bp
    bp_api.register_blueprint(provider_bp, url_prefix='/provider')
    print("✅ Blueprint 'provider' registrado correctamente")
except ImportError as e:
    print(f"❌ Error importando provider blueprint: {e}")

try:
    from .client import client_bp
    bp_api.register_blueprint(client_bp, url_prefix='/client')
    print("✅ Blueprint 'client' registrado correctamente")
except ImportError as e:
    print(f"❌ Error importando client blueprint: {e}")

try:
    from .service import service_bp
    bp_api.register_blueprint(service_bp)
    print("✅ Blueprint 'service' registrado correctamente")
except ImportError as e:
    print(f"⚠️ Warning: No se pudo importar service blueprint: {e}")
    
try:
    from .availability import bp as availability_module_bp
    bp_api.register_blueprint(availability_module_bp, url_prefix='/availability-rules')
    print("✅ Blueprint 'availability' registrado correctamente")
except ImportError as e:
    print(f"⚠️ Warning: No se pudo importar availability blueprint: {e}")
    
try:
    from .time_blocks import bp as time_blocks_module_bp
    bp_api.register_blueprint(time_blocks_module_bp, url_prefix='/time-blocks')
    print("✅ Blueprint 'time_blocks' registrado correctamente")
except ImportError as e:
    print(f"⚠️ Warning: No se pudo importar time_blocks blueprint: {e}")
    
try:
    from .appointments import bp as appointments_module_bp
    bp_api.register_blueprint(appointments_module_bp)
    print("✅ Blueprint 'appointments' registrado correctamente")
except ImportError as e:
    print(f"⚠️ Warning: No se pudo importar appointments_module_bp blueprint: {e}")

try:
    from .email_service import bp as service_module_bp
    bp_api.register_blueprint(service_module_bp)
    print("✅ Blueprint 'email_service' registrado correctamente")
except ImportError as e:
    print(f"⚠️ Warning: No se pudo importar email_service blueprint: {e}")