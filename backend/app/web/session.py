"""The website's sign-in session.

The website and the ChatGPT plugin are two ways into the same Venn account. An account is
identified by its `auth_subject`:
- Google Single Sign-On accounts use `google|<google_sub>`
- Development sign-in accounts use `dev|<username>`

The session is a signed HttpOnly, SameSite=Lax cookie. Mutating API requests must also carry
the `X-Venn-Request` header, which a page on another site cannot send.
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
GOOGLE_ISSUER = "google"  # Google SSO accounts are `google|<sub_id>`
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


def google_subject(google_sub: str) -> str:
    return f"{GOOGLE_ISSUER}|{google_sub}"


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
    return jwt.encode(claims, settings.web_session_secret, algorithm=_ALGORITHM)


def issue_google(settings: Settings, subject: str, email: str | None = None) -> str:
    now = int(time.time())
    claims: dict[str, object] = {
        "iss": settings.public_base_url.rstrip("/"),
        "aud": _AUDIENCE,
        "sub": subject,
        "typ": "web_google",
        "iat": now,
        "exp": now + SESSION_TTL_SECONDS,
    }
    if email:
        claims["email"] = email
    return jwt.encode(claims, settings.web_session_secret, algorithm=_ALGORITHM)


def _decode_cookie(settings: Settings, value: str | None) -> dict | None:
    if not value:
        return None
    try:
        return jwt.decode(
            value,
            settings.web_session_secret,
            algorithms=[_ALGORITHM],
            audience=_AUDIENCE,
            issuer=settings.public_base_url.rstrip("/"),
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except jwt.PyJWTError:
        return None


def read(settings: Settings, value: str | None) -> str | None:
    """The dev username in a session cookie, or None when missing, forged, expired or of another kind."""
    if settings.auth_mode != "dev":
        return None
    claims = _decode_cookie(settings, value)
    if not claims or claims.get("typ") != "web":
        return None
    username = str(claims.get("sub", ""))
    if not USERNAME_RE.fullmatch(username):
        return None
    return username


def username_from(request: Request, settings: Settings) -> str | None:
    return read(settings, request.cookies.get(COOKIE))


def identity_from(request: Request, settings: Settings) -> Identity | None:
    """Resolve the website session identity from the signed cookie (Google SSO or dev sign-in)."""
    claims = _decode_cookie(settings, request.cookies.get(COOKIE))
    if not claims:
        return None
    typ = claims.get("typ")
    sub = str(claims.get("sub", ""))
    if typ == "web_google":
        if (
            not settings.google_sso_enabled
            or not sub.startswith(f"{GOOGLE_ISSUER}|")
            or len(sub) <= len(GOOGLE_ISSUER) + 1
        ):
            return None
        email = claims.get("email")
        return Identity(subject=sub, username=email if isinstance(email, str) and email else None)
    if typ == "web" and settings.auth_mode == "dev" and USERNAME_RE.fullmatch(sub):
        return Identity(subject=dev_subject(sub), username=sub)
    return None


def is_secure_request(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip() == "https"


def set_cookie(response: Response, request: Request, settings: Settings, username: str) -> None:
    response.set_cookie(
        COOKIE,
        issue(settings, username),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=is_secure_request(request),
        path="/",
    )


def set_google_cookie(
    response: Response, request: Request, settings: Settings, subject: str, email: str | None = None
) -> None:
    response.set_cookie(
        COOKIE,
        issue_google(settings, subject, email),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=is_secure_request(request),
        path="/",
    )


def clear_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")
