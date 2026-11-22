"""FastAPI entrypoint: one backend, two ways in.

- /mcp (plus OAuth routes): the Venn MCP server that ChatGPT talks to.
- /api/v1: the website's API. Same services, same account, same rules (see docs/WEB_API.md).
- /app: the website itself (the build of web/).
- /i/{code} and /q/{token}: small public pages for invites and for a friend's answers.
- /calendar/connect and /calendar/callback: connect a calendar from a link Venn gives in chat.
"""

from __future__ import annotations

import contextlib
import logging
from collections.abc import AsyncIterator
from urllib.parse import urlparse

import anyio
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from mcp.server.transport_security import TransportSecuritySettings
from sqlalchemy import text

from app import calendar_page, question_page
from app.config import Settings, get_settings, use_settings
from app.db.database import init_engine, session_scope
from app.db.migrate import upgrade_to_head
from app.invite_page import render_invite_page
from app.mcp.server import build_mcp_server
from app.services import calendar_service, question_service
from app.services.errors import VennError
from app.web.api import build_api, install_error_handlers
from app.web.google_auth import install_google_auth
from app.web.site import install_site

# A friend's answers are four short lines; anything much larger is not that form.
MAX_ANSWER_FORM_BYTES = 16_000


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
    use_settings(settings)
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

    app = FastAPI(title="Venn", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None)
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

    @app.get("/i/{code}", include_in_schema=False)
    def invite_page(code: str) -> HTMLResponse:
        # Static page: it never looks the code up, so it cannot be used to test whether a code is valid.
        html = render_invite_page(code)
        headers = {
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Cache-Control": "no-store",
        }
        if html is None:
            return HTMLResponse("<!doctype html><title>Not found</title><p>Not found.</p>", 404, headers)
        return HTMLResponse(html, headers=headers)

    @app.get("/q/{token}", include_in_schema=False)
    def question_form(token: str) -> HTMLResponse:
        with session_scope() as db:
            link = question_service.public_link(db, token)
        if link is None:
            return HTMLResponse(question_page.render_unavailable(), 404, question_page.HEADERS)
        return HTMLResponse(question_page.render_form(link), headers=question_page.HEADERS)

    @app.post("/q/{token}", include_in_schema=False)
    async def question_submit(token: str, request: Request) -> HTMLResponse:
        try:
            size = int(request.headers.get("content-length", "0"))
        except ValueError:
            size = MAX_ANSWER_FORM_BYTES + 1
        if size > MAX_ANSWER_FORM_BYTES:
            return HTMLResponse(question_page.render_unavailable(), 413, question_page.HEADERS)
        form = await request.form()
        values = {key: str(form.get(key, ""))[:400] for key in ("name", *question_service.QUESTION_KEYS)}
        consent = str(form.get("consent", "")) == "yes"
        bot = bool(str(form.get("website", "")).strip())

        def work() -> tuple[int, str]:
            with session_scope() as db:
                link = question_service.public_link(db, token)
                if link is None:
                    return 404, question_page.render_unavailable()
                if bot:
                    # Filled-in honeypot: say thanks, store nothing.
                    return 200, question_page.render_thanks(link.asker)
                if not consent:
                    error = f"Please tick the box so {link.asker} can see your answers."
                    return 400, question_page.render_form(link, error, values)
                try:
                    stored = question_service.submit(
                        db, token, values["name"], {k: values[k] for k in question_service.QUESTION_KEYS}
                    )
                except VennError as exc:
                    return 400, question_page.render_form(link, exc.message, values)
                if not stored:
                    return 404, question_page.render_unavailable()
                return 200, question_page.render_thanks(link.asker)

        status, html = await anyio.to_thread.run_sync(work)
        return HTMLResponse(html, status, question_page.HEADERS)

    @app.get("/calendar/connect", include_in_schema=False)
    def calendar_connect(state: str = "") -> Response:
        try:
            url = calendar_service.authorize_redirect(state)
        except VennError as exc:
            return HTMLResponse(calendar_page.render_failed(exc.message), 400, calendar_page.HEADERS)
        return RedirectResponse(url, 302, headers={"Referrer-Policy": "no-referrer", "Cache-Control": "no-store"})

    @app.get("/calendar/callback", include_in_schema=False)
    def calendar_callback(state: str = "", code: str = "", error: str = "") -> HTMLResponse:
        if error or not code:
            return HTMLResponse(
                calendar_page.render_failed("Calendar access was not granted."), 400, calendar_page.HEADERS
            )
        try:
            with session_scope() as db:
                email = calendar_service.finish(db, state, code[:2048])
        except VennError as exc:
            return HTMLResponse(calendar_page.render_failed(exc.message), 400, calendar_page.HEADERS)
        return HTMLResponse(calendar_page.render_connected(email), headers=calendar_page.HEADERS)

    install_error_handlers(app)
    app.include_router(build_api(settings))
    install_google_auth(app, settings)
    install_site(app, settings)

    # The MCP Starlette app owns /mcp, OAuth metadata (/.well-known/*), and (dev) /authorize,/token,/register.
    app.mount("/", mcp_app)
    return app


# Run with: uvicorn app.main:create_app --factory
