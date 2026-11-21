"""Resolve the authenticated Venn user for the current MCP request.

The only identity source is the verified OAuth access token placed in the request context by
the MCP SDK's auth middleware. Tool arguments never carry a user id.
"""

from __future__ import annotations

from collections.abc import Iterable

from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken
from sqlalchemy.orm import Session

from app.models import User
from app.services.errors import Forbidden, Unauthenticated
from app.services.user_service import get_or_create_user


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
    return get_or_create_user(db, auth_subject_for(token), name if isinstance(name, str) else None)
