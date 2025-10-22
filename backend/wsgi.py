# backend/wsgi.py
import os
from app import create_app
from config import Config

app = create_app(Config)

# (opcional) por si alguna vez Flask no viera el grupo db:
try:
    from flask_migrate import cli as fm_cli
    app.cli.add_command(fm_cli.db, name="db")
except Exception:
    pass
