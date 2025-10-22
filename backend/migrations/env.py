# backend/migrations/env.py
from __future__ import with_statement

import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from flask import current_app

# Alembic config
config = context.config

# Logging (opcional, si hay alembic.ini)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
logger = logging.getLogger("alembic.env")


def _prepare_from_flask():
    """
    Inyecta la URL de BD desde Flask y devuelve target_metadata desde Flask-Migrate.
    No importa modelos directamente.
    """
    # Pasa la URL real de la app a Alembic
    sqlalchemy_url = str(current_app.config.get("SQLALCHEMY_DATABASE_URI", ""))
    if sqlalchemy_url:
        config.set_main_option("sqlalchemy.url", sqlalchemy_url)

    migrate_ext = current_app.extensions.get("migrate")
    if not migrate_ext:
        raise RuntimeError("Flask-Migrate no está inicializado en current_app.")

    db = getattr(migrate_ext, "db", None)
    if db is None:
        raise RuntimeError("No se encontró la instancia de SQLAlchemy en Flask-Migrate.")
    return db.metadata


def run_migrations_offline():
    """Modo offline."""
    target_metadata = _prepare_from_flask()
    url = config.get_main_option("sqlalchemy.url")
    if not url:
        raise RuntimeError("No hay sqlalchemy.url configurada para migraciones offline.")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Modo online."""
    target_metadata = _prepare_from_flask()

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    def process_revision_directives(ctx, revision, directives):
        if getattr(config.cmd_opts, "autogenerate", False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info("No changes in schema detected.")

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            process_revision_directives=process_revision_directives,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
