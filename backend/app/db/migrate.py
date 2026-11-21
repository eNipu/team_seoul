"""Run Alembic migrations from code (used on startup for local SQLite databases)."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from app.db.database import get_engine

BACKEND_DIR = Path(__file__).resolve().parents[2]


def alembic_config(database_url: str) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.attributes["heldly.database_url"] = database_url
    cfg.attributes["configure_logger"] = False
    return cfg


def upgrade_to_head(database_url: str) -> None:
    """Equivalent of `alembic upgrade head` on the app's engine.

    Databases created by older builds via `create_all()` are adopted (stamped 0001) in
    migrations/env.py, so this also works for them.
    """
    cfg = alembic_config(database_url)
    with get_engine().begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")
