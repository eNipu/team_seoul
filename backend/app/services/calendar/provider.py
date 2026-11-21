"""The calendar interface every provider implements. See docs/tasks/SCHEDULING.md › Providers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

Interval = tuple[datetime, datetime]


@dataclass(frozen=True)
class Grant:
    refresh_token: str
    account_email: str


@dataclass(frozen=True)
class CreatedEvent:
    event_id: str
    meet_url: str | None


class CalendarProvider(Protocol):
    name: str

    def auth_url(self, state: str, redirect_uri: str) -> str: ...

    def exchange(self, code: str, redirect_uri: str) -> Grant: ...

    def free_busy(self, refresh_token: str, calendar_ids: list[str], start: datetime, end: datetime) -> list[Interval]:
        """Busy blocks in UTC. Event contents are never requested."""
        ...

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
        """Create (or, if `event_id` already exists, return) an event with a video link."""
        ...

    def cancel_event(self, refresh_token: str, event_id: str) -> None: ...

    def revoke(self, refresh_token: str) -> None: ...
