"""An in-memory calendar for dev and tests. Nothing leaves the server."""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urlencode

from app.services.calendar.provider import CreatedEvent, Grant, Interval


@dataclass
class FakeEvent:
    account_email: str
    summary: str
    start: datetime
    end: datetime
    attendees: list[str]
    cancelled: bool = False


@dataclass
class FakeCalendar:
    name: str = "fake"
    # Keyed by account email. Tests put busy blocks here.
    busy: dict[str, list[Interval]] = field(default_factory=dict)
    events: dict[str, FakeEvent] = field(default_factory=dict)
    revoked: set[str] = field(default_factory=set)
    _accounts: dict[str, str] = field(default_factory=dict)  # refresh token -> email

    def auth_url(self, state: str, redirect_uri: str) -> str:
        # Straight back to our callback, as if the user had approved. `code` names the account.
        return f"{redirect_uri}?{urlencode({'code': 'fake-' + secrets.token_hex(4), 'state': state})}"

    def exchange(self, code: str, redirect_uri: str) -> Grant:
        token = f"fake-refresh-{secrets.token_hex(8)}"
        email = f"{code}@calendar.test"
        self._accounts[token] = email
        return Grant(refresh_token=token, account_email=email)

    def _email(self, refresh_token: str) -> str:
        if refresh_token in self.revoked or refresh_token not in self._accounts:
            raise PermissionError("revoked or unknown grant")
        return self._accounts[refresh_token]

    def free_busy(self, refresh_token: str, calendar_ids: list[str], start: datetime, end: datetime) -> list[Interval]:
        email = self._email(refresh_token)
        blocks = list(self.busy.get(email, []))
        blocks += [(e.start, e.end) for e in self.events.values() if e.account_email == email and not e.cancelled]
        blocks += [(e.start, e.end) for e in self.events.values() if email in e.attendees and not e.cancelled]
        return sorted((a, b) for a, b in blocks if b > start and a < end)

    def create_event(
        self,
        refresh_token: str,
        *,
        event_id: str,
        summary: str,
        start: datetime,
        end: datetime,
        attendees: list[str],
    ) -> CreatedEvent:
        email = self._email(refresh_token)
        if event_id not in self.events:
            self.events[event_id] = FakeEvent(email, summary, start, end, list(attendees))
        return CreatedEvent(event_id=event_id, meet_url=f"https://meet.example.test/{event_id[:10]}")

    def cancel_event(self, refresh_token: str, event_id: str) -> None:
        self._email(refresh_token)
        if event_id in self.events:
            self.events[event_id].cancelled = True

    def revoke(self, refresh_token: str) -> None:
        self.revoked.add(refresh_token)
