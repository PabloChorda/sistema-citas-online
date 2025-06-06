#backend/run.py
import sys
import os
from dotenv import load_dotenv

# Asegurar que la raíz del proyecto está en sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Cargar variables de entorno desde .env (asume que .env está en esta misma carpeta 'backend')
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(dotenv_path):
    print(f"Cargando variables de entorno desde: {dotenv_path}")
    load_dotenv(dotenv_path)
else:
    print(f"ADVERTENCIA: Archivo .env no encontrado en {dotenv_path}")

# Imprimir para verificar que las variables se cargaron (opcional, para depuración)
print(f"DB_USER (desde run.py después de load_dotenv): {os.environ.get('DB_USER')}")
print(f"FLASK_DEBUG (desde run.py después de load_dotenv): {os.environ.get('FLASK_DEBUG')}")

# Importar create_app y db después de cargar variables
from app import create_app, db
from config import Config

# Importar todos los modelos desde app.models (ajustado a tu estructura nueva)
from app.models import (
    User,
    Provider,
    Service,
    AvailabilityRule,
    TimeBlock,
    Appointment
)

# Crear la app usando la clase de configuración
app = create_app(Config)

# Contexto de shell de Flask
@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'User': User,
        'Provider': Provider,
        'Service': Service,
        'AvailabilityRule': AvailabilityRule,
        'TimeBlock': TimeBlock,
        'Appointment': Appointment,
    }

# Ejecutar la app si se llama directamente
if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', '0') == '1'
    port_num = int(os.environ.get('PORT', 5001))
    print(f"Iniciando Flask app en modo debug: {debug_mode}, puerto: {port_num}")
    app.run(debug=debug_mode, port=port_num, host='0.0.0.0')
