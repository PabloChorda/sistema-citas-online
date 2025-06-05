import logging
from logging.config import fileConfig

from flask import current_app # Mantenemos el uso de current_app si es posible

from alembic import context

# MODIFICADO: Añadir imports para asegurar que los modelos son conocidos por SQLAlchemy
import os
import sys
# Añadir el directorio 'backend' al sys.path para que se pueda encontrar el paquete 'app'
# Esto es crucial si ejecutas alembic desde el directorio 'migrations' o si el contexto no está bien configurado
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Importar la instancia 'db' y TODOS tus modelos explícitamente.
# Esto asegura que db.metadata esté poblado cuando Alembic lo necesite.
from app import db as application_db # Importar la instancia db de tu app
from app.models import User, Provider, Service, AvailabilityRule, TimeBlock, Appointment
# --- FIN DE MODIFICACIÓN DE IMPORTS ---


# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None: # Añadido check por si no se usa alembic.ini
    fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')


def get_engine():
    try:
        # this works with Flask-SQLAlchemy<3 and Alchemical
        return current_app.extensions['migrate'].db.get_engine()
    except (TypeError, AttributeError):
        # this works with Flask-SQLAlchemy>=3
        return current_app.extensions['migrate'].db.engine


def get_engine_url():
    try:
        return get_engine().url.render_as_string(hide_password=False).replace(
            '%', '%%')
    except AttributeError:
        return str(get_engine().url).replace('%', '%%')


# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata

# MODIFICADO: Usar directamente los metadatos de la instancia db importada
# Esto es más robusto si current_app no está disponible o configurado como se espera
# durante la ejecución de `flask db migrate`.
target_metadata = application_db.metadata
# --- FIN DE MODIFICACIÓN ---

config.set_main_option('sqlalchemy.url', get_engine_url())
# target_db = current_app.extensions['migrate'].db # Ya no es necesario si usamos application_db.metadata directamente

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


# def get_metadata(): # Ya no necesitamos esta función si target_metadata se define directamente
#     if hasattr(target_db, 'metadatas'):
#         return target_db.metadatas[None]
#     return target_db.metadata


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True # MODIFICADO: usar target_metadata directamente
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    # this callback is used to prevent an auto-migration from being generated
    # when there are no changes to the schema
    # reference: http://alembic.zzzcomputing.com/en/latest/cookbook.html
    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info('No changes in schema detected.')

    # Obtener configure_args de la extensión migrate si existe, o usar un dict vacío
    flask_migrate_extension = current_app.extensions.get('migrate')
    conf_args = {}
    if flask_migrate_extension:
        conf_args = flask_migrate_extension.configure_args
    
    if conf_args.get("process_revision_directives") is None:
        conf_args["process_revision_directives"] = process_revision_directives

    connectable = get_engine()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata, # MODIFICADO: usar target_metadata directamente
            **conf_args
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
