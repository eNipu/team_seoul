"""Alembic environment: metadata from app.models.

URL: the `heldly.database_url` attribute when run programmatically (see app/db/migrate.py),
otherwise DATABASE_URL from app settings (CLI: `alembic upgrade head`).
"""

import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import inspect

import app.models  # noqa: F401  (register models)
from app.config import get_settings
from app.db.database import Base, make_engine

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata
log = logging.getLogger("alembic.env")


def _url() -> str:
    return config.attributes.get("heldly.database_url") or get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _adopt_unversioned_database(connection) -> None:
    """Stamp 0001 on databases created by `create_all()` before Alembic was wired in.

    Early dev builds created SQLite tables directly; they match revision 0001 but have no
    `alembic_version` row, so a plain upgrade would fail with "table ... already exists".
    """
    tables = set(inspect(connection).get_table_names())
    # An empty alembic_version table can be left behind by a failed SQLite upgrade (non-transactional DDL).
    if "users" in tables and context.get_context().get_current_revision() is None:
        log.warning("Database has Heldly tables but no Alembic version; stamping revision 0001")
        context.get_context().stamp(context.script, "0001")


def _run(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        _adopt_unversioned_database(connection)
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    engine = make_engine(_url())
    # begin(): commit explicitly; SQLAlchemy 2 rolls back uncommitted work when the connection closes.
    with engine.begin() as connection:
        _run(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
