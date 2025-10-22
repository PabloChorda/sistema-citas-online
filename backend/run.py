# backend/run.py
import os
from dotenv import load_dotenv

# 1) Cargar .env (intentamos primero el de la raíz del proyecto /app/.env y
#    si no existe, el de backend/.env)
ROOT_DOTENV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
BACKEND_DOTENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")

if os.path.exists(ROOT_DOTENV):
    print(f"Cargando variables de entorno desde: {ROOT_DOTENV}")
    load_dotenv(ROOT_DOTENV)
elif os.path.exists(BACKEND_DOTENV):
    print(f"Cargando variables de entorno desde: {BACKEND_DOTENV}")
    load_dotenv(BACKEND_DOTENV)
else:
    print("ADVERTENCIA: No se encontró archivo .env en /app/.env ni en backend/.env")

print(f"DB_USER (run.py): {os.environ.get('DB_USER')}")
print(f"FLASK_DEBUG (run.py): {os.environ.get('FLASK_DEBUG')}")

# 2) IMPORTS CORRECTOS (desde backend.*)
from backend import create_app, db
from backend.models import User, Provider  # ajusta si tu módulo/models difiere
# Config: usa get_config() si lo tienes; si no, usa Config directamente.
try:
    from backend.config import get_config
    ConfigObj = get_config()
except Exception:
    from backend.config import Config
    ConfigObj = Config

# 3) Registra comandos CLI opcionales (si existen)
try:
    from backend.commands.reminders import send_reminders_command
    HAS_REMINDERS = True
except Exception as e:
    print(f"(INFO) Comando reminders no disponible: {e}")
    HAS_REMINDERS = False

# 4) Crea la app
app = create_app(ConfigObj)

if HAS_REMINDERS:
    app.cli.add_command(send_reminders_command)

# 5) Shell context (útil para flask shell)
@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Provider': Provider}

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', '0') in ('1', 'true', 'True')
    port_num = int(os.environ.get('PORT', 5001))
    print(f"Iniciando Flask app en modo debug={debug_mode}, puerto={port_num}")
    app.run(host='0.0.0.0', port=port_num, debug=debug_mode)
