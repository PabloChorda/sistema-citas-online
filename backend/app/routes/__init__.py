# backend/app/routes/__init__.py
from flask import Blueprint

# Crear el blueprint principal para la API
bp_api = Blueprint('api', __name__)

# Importaciones tardías para evitar problemas circulares
try:
    from .auth import bp as auth_module_bp
    bp_api.register_blueprint(auth_module_bp, url_prefix='/auth')
    print("✅ Blueprint 'auth' registrado correctamente")
except ImportError as e:
    print(f"❌ Error importando auth blueprint: {e}")

try:
    # Importamos el blueprint desde nuestro nuevo archivo provider.py
    from .provider import provider_bp
    # Lo registramos en la API con el prefijo /provider
    bp_api.register_blueprint(provider_bp, url_prefix='/provider')
    print("✅ Blueprint 'provider' registrado correctamente")
except ImportError as e:
    print(f"⚠️ Warning: No se pudo importar provider blueprint: {e}")
    
try:
    from .services import bp as services_module_bp
    bp_api.register_blueprint(services_module_bp, url_prefix='/services')
    print("✅ Blueprint 'services' registrado correctamente")
except ImportError as e:
    print(f"⚠️ Warning: No se pudo importar services blueprint: {e}")
    
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
    print("✅ Blueprint 'appointments' registrado correctamente")
except ImportError as e:
    print(f"⚠️ Warning: No se pudo importar appointments blueprint: {e}")