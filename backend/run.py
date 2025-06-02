# backend/run.py
import os
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(dotenv_path):
    print(f"Cargando variables de entorno desde: {dotenv_path}")
    load_dotenv(dotenv_path)

print(f"DB_USER (desde run.py después de load_dotenv): {os.environ.get('DB_USER')}")
print(f"FLASK_DEBUG (desde run.py después de load_dotenv): {os.environ.get('FLASK_DEBUG')}")

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

from app import create_app, db
from app.models import User, Provider
from config import Config

app = create_app(Config)

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Provider': Provider}

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', '0') == '1'
    port_num = int(os.environ.get('PORT', 5001))
    print(f"Iniciando Flask app en modo debug: {debug_mode}, puerto: {port_num}")
    app.run(debug=debug_mode, port=port_num, host='0.0.0.0')
