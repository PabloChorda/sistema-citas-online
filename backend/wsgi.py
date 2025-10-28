# backend/wsgi.py
import os
from app import create_app

def _load_config():
    """
    Carga la clase de configuración desde FLASK_CONFIG (p.ej. 'config.DevelopmentConfig').
    Si falla la importación, devolvemos la ruta tal cual porque Flask puede resolverla.
    """
    cfg_path = os.getenv("FLASK_CONFIG", "config.DevelopmentConfig")
    try:
        module_path, class_name = cfg_path.rsplit(".", 1)
        mod = __import__(module_path, fromlist=[class_name])
        return getattr(mod, class_name)
    except Exception:
        return cfg_path  # Flask app.config.from_object acepta str con import path

app = create_app(_load_config())

if __name__ == "__main__":
    # Útil para pruebas locales fuera de Docker
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "0") == "1")
