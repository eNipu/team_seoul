"""FastAPI entrypoint: health endpoints + the Heldly MCP server (mounted at /mcp)."""

from __future__ import annotations

import contextlib
import logging
from collections.abc import AsyncIterator
from urllib.parse import urlparse

from fastapi import FastAPI
from mcp.server.transport_security import TransportSecuritySettings
from sqlalchemy import text

from app.config import Settings, get_settings
from app.db.database import init_engine, session_scope
from app.db.migrate import upgrade_to_head
from app.mcp.server import build_mcp_server


def _transport_security(settings: Settings) -> TransportSecuritySettings:
    hosts = set(settings.allowed_hosts)
    for url in (settings.public_base_url, settings.mcp_resource_url):
        host = urlparse(url).netloc
        if host:
            hosts.add(host)
    if not settings.is_production:
        hosts.update({"localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*"})
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=sorted(hosts),
        allowed_origins=["https://chatgpt.com", "https://*.chatgpt.com", "https://*.oaiusercontent.com"]
        + ([] if settings.is_production else ["http://localhost:*", "http://127.0.0.1:*"]),
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level.upper())
    init_engine(settings.database_url)
    if settings.database_url.startswith("sqlite"):
        # Dev convenience: keep local SQLite at Alembic head. Postgres is migrated explicitly
        # (`make migrate`, or the Docker entrypoint).
        upgrade_to_head(settings.database_url)

    mcp, dev_provider = build_mcp_server(settings)
    mcp_app = mcp.streamable_http_app(
        streamable_http_path="/mcp",
        stateless_http=True,
        json_response=True,
        transport_security=_transport_security(settings),
    )

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        async with mcp.session_manager.run():
            yield

    app = FastAPI(title="Heldly", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.settings = settings
    app.state.mcp = mcp
    app.state.dev_provider = dev_provider

    @app.get("/healthz", include_in_schema=False)
    def healthz() -> dict:
        return {"status": "ok"}

    @app.get("/readyz", include_in_schema=False)
    def readyz() -> dict:
        with session_scope() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ready", "environment": settings.environment, "auth_mode": settings.auth_mode}

    # The MCP Starlette app owns /mcp, OAuth metadata (/.well-known/*), and (dev) /authorize,/token,/register.
    app.mount("/", mcp_app)
    return app


# Run with: uvicorn app.main:create_app --factory
