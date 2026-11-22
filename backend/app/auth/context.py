"""Resolve the authenticated Venn user for the current MCP request.

The only identity source is the verified OAuth access token placed in the request context by
the MCP SDK's auth middleware. Tool arguments never carry a user id.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable

import anyio
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken
from sqlalchemy.orm import Session

from app.db.database import session_scope
from app.models import User
from app.services.errors import Forbidden, Unauthenticated
from app.services.user_service import get_or_create_user, mark_chatgpt_connected

log = logging.getLogger("venn.auth")


def auth_subject_for(token: AccessToken) -> str:
    issuer = str((token.claims or {}).get("iss") or "unknown")
    if not token.subject:
        raise Unauthenticated("Access token has no subject")
    return f"{issuer}|{token.subject}"


def current_token(required_scopes: Iterable[str] = ()) -> AccessToken:
    token = get_access_token()
    if token is None:
        raise Unauthenticated("Sign in to Venn to use this tool.")
    missing = [s for s in required_scopes if s not in token.scopes]
    if missing:
        raise Forbidden(f"Missing permission: {', '.join(missing)}. Reconnect Venn and grant access.")
    return token


def resolve_user(db: Session, token: AccessToken) -> tuple[User, bool]:
    name = (token.claims or {}).get("name")
    subject = auth_subject_for(token)
    user, created = get_or_create_user(db, subject, name if isinstance(name, str) else None)
    mark_chatgpt_connected(db, subject)
    return user, created


async def note_token_used(token: AccessToken) -> None:
    """A verified OAuth token reached the MCP server: record that ChatGPT is connected. Never raises."""

    def work() -> None:
        with session_scope() as db:
            mark_chatgpt_connected(db, auth_subject_for(token))

    try:
        await anyio.to_thread.run_sync(work)
    except Exception:  # noqa: BLE001 - bookkeeping must never break authentication
        log.warning("could not record ChatGPT connection", exc_info=True)
