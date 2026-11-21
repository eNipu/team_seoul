from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import jwt
import pytest
from sqlalchemy import select

from app.config import Settings
from app.models import CalendarConnection, User
from app.services import calendar_service


def _path(url: str) -> str:
    parts = urlparse(url)
    return f"{parts.path}?{parts.query}"


def connect(client, user, url: str | None = None) -> str:
    """Follow the connect link the way a browser would. Returns the connected account email."""
    url = url or user.ok("venn_calendar_status")["connect_url"]
    to_provider = client.get(_path(url), follow_redirects=False)
    assert to_provider.status_code == 302
    page = client.get(_path(to_provider.headers["location"]), follow_redirects=False)
    assert page.status_code == 200, page.text
    assert "Calendar connected" in page.text
    return user.ok("venn_calendar_status")["account_email"]


def test_new_user_gets_a_connect_link(alice):
    status = alice.ok("venn_calendar_status")
    assert status["connected"] is False
    assert status["connect_url"].startswith("http://localhost:8081/calendar/connect?state=")


def test_connect_then_status(client, alice):
    email = connect(client, alice)
    status = alice.ok("venn_calendar_status")
    assert status == {
        "connected": True,
        "provider": "fake",
        "account_email": email,
        "calendar_ids": ["primary"],
        "connect_url": None,
    }


def test_refresh_token_is_stored_encrypted(client, alice, db):
    connect(client, alice)
    row = db.scalar(select(CalendarConnection))
    fake = calendar_service.provider()
    plain = next(iter(fake._accounts))
    assert plain not in row.refresh_token_enc
    assert "fake-refresh" not in row.refresh_token_enc


def test_a_link_connects_only_the_user_it_was_made_for(client, alice, bob):
    connect(client, alice)
    assert bob.ok("venn_calendar_status")["connected"] is False


def test_bad_or_expired_state_is_refused(client, alice, db):
    assert client.get("/calendar/connect?state=nonsense", follow_redirects=False).status_code == 400
    assert client.get("/calendar/callback?state=nonsense&code=x").status_code == 400

    alice.ok("venn_calendar_status")
    user = db.scalar(select(User))
    expired = jwt.encode(
        {"sub": str(user.id), "purpose": "calendar_connect", "exp": int(time.time()) - 1},
        calendar_service._state_key(),
        algorithm="HS256",
    )
    resp = client.get(f"/calendar/callback?state={expired}&code=fake-1")
    assert resp.status_code == 400
    assert "expired" in resp.text
    assert alice.ok("venn_calendar_status")["connected"] is False


def test_denied_consent_saves_nothing(client, alice):
    url = alice.ok("venn_calendar_status")["connect_url"]
    state = url.split("state=")[1]
    resp = client.get(f"/calendar/callback?state={state}&error=access_denied")
    assert resp.status_code == 400
    assert alice.ok("venn_calendar_status")["connected"] is False


def test_disconnect_revokes_and_deletes(client, alice, db):
    connect(client, alice)
    assert alice.ok("venn_disconnect_calendar") == {"disconnected": True}
    assert calendar_service.provider().revoked
    assert db.scalar(select(CalendarConnection)) is None
    assert alice.ok("venn_calendar_status")["connected"] is False
    assert alice.ok("venn_disconnect_calendar") == {"disconnected": False}


def test_busy_is_read_live(client, alice, db):
    email = connect(client, alice)
    start = datetime(2026, 11, 23, tzinfo=UTC)
    calendar_service.provider().busy[email] = [(start + timedelta(hours=10), start + timedelta(hours=11))]
    user = db.scalar(select(User))
    assert calendar_service.busy(db, user, start, start + timedelta(days=1)) == [
        (start + timedelta(hours=10), start + timedelta(hours=11))
    ]


def test_reconnecting_replaces_the_grant(client, alice, db):
    first = connect(client, alice)
    second = connect(client, alice, calendar_service.connect_url(db.scalar(select(User))))
    assert first != second
    assert calendar_service.provider().revoked
    assert len(db.scalars(select(CalendarConnection)).all()) == 1


def test_google_needs_client_credentials():
    with pytest.raises(ValueError, match="GOOGLE_CLIENT_ID"):
        Settings(_env_file=None, environment="test", calendar_provider="google")
