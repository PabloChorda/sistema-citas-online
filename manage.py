# manage.py

import os
import sys

# Asegura que 'backend/' está en el path (raíz del proyecto)
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.app import create_app, db
from backend.config import DevelopmentConfig
from flask_migrate import Migrate

app = create_app(DevelopmentConfig)
migrate = Migrate(app, db)