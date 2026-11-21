"""Connect a calendar once; read free/busy live. See docs/tasks/SCHEDULING.md › Providers.

The connect link carries a signed, 10-minute `state` naming the user, because the user opens it
in a browser outside ChatGPT where no Venn token is available.
"""

from __future__ import annotations

import base64
import contextlib
import hashlib
import time
import uuid
from datetime import datetime

import jwt
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import CalendarConnection, User
from app.schemas.scheduling import CalendarDisconnectOut, CalendarStatusOut
from app.services.calendar.fake import FakeCalendar
from app.services.calendar.google import GoogleCalendar
from app.services.calendar.provider import CalendarProvider, Interval
from app.services.errors import InvalidRequest, ProviderError

STATE_TTL_SECONDS = 600
_PURPOSE = "calendar_connect"
_cache: tuple[Settings, CalendarProvider] | None = None


def provider() -> CalendarProvider:
    """The provider for the running settings (a fresh fake per app, so tests do not share one)."""
    global _cache
    settings = get_settings()
    if _cache is None or _cache[0] is not settings:
        if settings.calendar_provider == "google":
            impl: CalendarProvider = GoogleCalendar(
                settings.google_client_id or "", settings.google_client_secret or ""
            )
        else:
            impl = FakeCalendar()
        _cache = (settings, impl)
    return _cache[1]


def _key_material() -> bytes:
    settings = get_settings()
    return (settings.calendar_token_key or settings.dev_auth_secret).encode()


def _fernet() -> Fernet:
    settings = get_settings()
    if settings.calendar_token_key:
        return Fernet(settings.calendar_token_key)
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(b"venn-calendar-token|" + _key_material()).digest()))


def _state_key() -> bytes:
    return hashlib.sha256(b"venn-calendar-state|" + _key_material()).digest()


def _redirect_uri() -> str:
    return f"{get_settings().public_base_url.rstrip('/')}/calendar/callback"


def connect_url(user: User) -> str:
    state = jwt.encode(
        {"sub": str(user.id), "purpose": _PURPOSE, "exp": int(time.time()) + STATE_TTL_SECONDS},
        _state_key(),
        algorithm="HS256",
    )
    return f"{get_settings().public_base_url.rstrip('/')}/calendar/connect?state={state}"


def _user_id_from(state: str) -> uuid.UUID:
    try:
        claims = jwt.decode(state, _state_key(), algorithms=["HS256"], options={"require": ["exp", "sub"]})
        if claims.get("purpose") != _PURPOSE:
            raise ValueError
        return uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError, TypeError):
        raise InvalidRequest("This link has expired. Ask Venn in your chat for a new one.") from None


def authorize_redirect(state: str) -> str:
    """Where /calendar/connect sends the browser. Refuses a bad or expired state up front."""
    _user_id_from(state)
    return provider().auth_url(state, _redirect_uri())


def _row(db: Session, user_id: uuid.UUID) -> CalendarConnection | None:
    return db.scalar(select(CalendarConnection).where(CalendarConnection.user_id == user_id))


def finish(db: Session, state: str, code: str) -> str:
    """Handle the provider's redirect: store the grant for the user the state names."""
    user_id = _user_id_from(state)
    if db.get(User, user_id) is None:
        raise InvalidRequest("This link has expired. Ask Venn in your chat for a new one.")
    impl = provider()
    grant = impl.exchange(code, _redirect_uri())
    row = _row(db, user_id)
    if row is not None:
        _revoke_quietly(impl, row)
        db.delete(row)
        db.flush()
    db.add(
        CalendarConnection(
            user_id=user_id,
            provider=impl.name,
            account_email=grant.account_email[:254],
            refresh_token_enc=_fernet().encrypt(grant.refresh_token.encode()).decode(),
            calendar_ids=["primary"],
        )
    )
    db.flush()
    return grant.account_email


def status(db: Session, user: User) -> CalendarStatusOut:
    row = _row(db, user.id)
    if row is None:
        return CalendarStatusOut(connected=False, connect_url=connect_url(user))
    return CalendarStatusOut(
        connected=True, provider=row.provider, account_email=row.account_email, calendar_ids=list(row.calendar_ids)
    )


def _refresh_token(row: CalendarConnection) -> str:
    try:
        return _fernet().decrypt(row.refresh_token_enc.encode()).decode()
    except InvalidToken:
        raise ProviderError("The calendar connection can no longer be read. Connect the calendar again.") from None


def _revoke_quietly(impl: CalendarProvider, row: CalendarConnection) -> None:
    # The row is deleted either way; Google also expires grants that go unused.
    with contextlib.suppress(Exception):
        impl.revoke(_refresh_token(row))


def disconnect(db: Session, user: User) -> CalendarDisconnectOut:
    row = _row(db, user.id)
    if row is None:
        return CalendarDisconnectOut(disconnected=False)
    _revoke_quietly(provider(), row)
    db.delete(row)
    db.flush()
    return CalendarDisconnectOut(disconnected=True)


def busy(db: Session, user: User, start: datetime, end: datetime) -> list[Interval] | None:
    """The user's busy blocks in UTC, read live and not stored. None if no calendar is connected."""
    row = _row(db, user.id)
    if row is None:
        return None
    try:
        return provider().free_busy(_refresh_token(row), list(row.calendar_ids) or ["primary"], start, end)
    except PermissionError:
        raise ProviderError("Calendar access was revoked. Connect the calendar again.") from None
