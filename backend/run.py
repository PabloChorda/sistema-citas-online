# backend/run.py
import os
from dotenv import load_dotenv

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


# Importar create_app DESPUÉS de cargar .env y DESPUÉS de que config.py haya sido definido
from app import create_app, db
from app.models import User, Provider # Asegúrate que los modelos no tengan dependencias de config al importar
from config import Config # Importa la clase Config

# Crear la aplicación pasando la CLASE de configuración
# create_app ahora espera el objeto de la clase, no el nombre.
app = create_app(Config)

# Contexto de aplicación para el shell de Flask (opcional pero útil)
@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Provider': Provider}

if __name__ == '__main__':
    # Usar variables de entorno para debug y port si están definidas, sino valores por defecto.
    debug_mode = os.environ.get('FLASK_DEBUG', '0') == '1' # FLASK_DEBUG=1 para True
    port_num = int(os.environ.get('PORT', 5001))
    print(f"Iniciando Flask app en modo debug: {debug_mode}, puerto: {port_num}")
    app.run(debug=debug_mode, port=port_num, host='0.0.0.0') # host='0.0.0.0' para acceder desde la red