"""The website's sign-in session.

The website and the ChatGPT plugin are two ways into the same Venn account. An account is
identified by its `auth_subject`; with development sign-in that is `dev|<username>` for both, so
the same username opens the same account in either place.

The session is a signed cookie holding only the username. It is HttpOnly (scripts cannot read it)
and SameSite=Lax; requests that change something must also carry the `X-Venn-Request` header,
which a page on another site cannot send.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass

import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.requests import Request
from starlette.responses import Response

from app.config import Settings
from app.models import User

COOKIE = "venn_session"
SESSION_TTL_SECONDS = 30 * 24 * 3600
DEV_ISSUER = "dev"  # development accounts are `dev|<username>`
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{1,31}$")
_AUDIENCE = "venn-web"
_ALGORITHM = "HS256"


@dataclass(frozen=True)
class Identity:
    """Who a request is from. `provision` is true when an external identity provider vouches for
    the account (the first request creates it); with development sign-in accounts are only ever
    created by an explicit "create account" step."""

    subject: str
    username: str | None = None
    name: str | None = None
    provision: bool = False


def dev_subject(username: str) -> str:
    return f"{DEV_ISSUER}|{username}"


def find_user(db: Session, subject: str) -> User | None:
    return db.scalar(select(User).where(User.auth_subject == subject))


def issue(settings: Settings, username: str) -> str:
    now = int(time.time())
    claims = {
        "iss": settings.public_base_url.rstrip("/"),
        "aud": _AUDIENCE,
        "sub": username,
        "typ": "web",
        "iat": now,
        "exp": now + SESSION_TTL_SECONDS,
    }
    return jwt.encode(claims, settings.dev_auth_secret, algorithm=_ALGORITHM)


def read(settings: Settings, value: str | None) -> str | None:
    """The username in a session cookie, or None when it is missing, forged, expired or of another kind."""
    if not value or settings.auth_mode != "dev":
        return None
    try:
        claims = jwt.decode(
            value,
            settings.dev_auth_secret,
            algorithms=[_ALGORITHM],
            audience=_AUDIENCE,
            issuer=settings.public_base_url.rstrip("/"),
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except jwt.PyJWTError:
        return None
    username = str(claims.get("sub", ""))
    if claims.get("typ") != "web" or not USERNAME_RE.fullmatch(username):
        return None
    return username


def username_from(request: Request, settings: Settings) -> str | None:
    return read(settings, request.cookies.get(COOKIE))


def _secure(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip() == "https"


def set_cookie(response: Response, request: Request, settings: Settings, username: str) -> None:
    response.set_cookie(
        COOKIE,
        issue(settings, username),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=_secure(request),
        path="/",
    )


def clear_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")
