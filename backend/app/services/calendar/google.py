"""Google Calendar API v3 over plain HTTPS. Free/busy and event creation only; never event contents."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.parse import urlencode

import httpx

from app.services.calendar.provider import CreatedEvent, Grant, Interval
from app.services.errors import ProviderError

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"  # noqa: S105 - endpoint, not a secret
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
API = "https://www.googleapis.com/calendar/v3"
SCOPES = (
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.freebusy",
    "https://www.googleapis.com/auth/calendar.events",
)
TIMEOUT = 10.0


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


@dataclass
class GoogleCalendar:
    client_id: str
    client_secret: str
    name: str = "google"

    def _post(self, url: str, **kwargs) -> httpx.Response:
        try:
            return httpx.post(url, timeout=TIMEOUT, **kwargs)
        except httpx.HTTPError:
            raise ProviderError("Google Calendar did not respond. Try again in a minute.") from None

    def _access_token(self, refresh_token: str) -> str:
        resp = self._post(
            TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
        )
        if resp.status_code != 200:
            raise ProviderError("Google Calendar access was revoked. Connect the calendar again.")
        return resp.json()["access_token"]

    def auth_url(self, state: str, redirect_uri: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state,
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    def exchange(self, code: str, redirect_uri: str) -> Grant:
        resp = self._post(
            TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
        )
        body = resp.json() if resp.status_code == 200 else {}
        refresh, access = body.get("refresh_token"), body.get("access_token")
        if not refresh or not access:
            raise ProviderError("Google did not grant calendar access.")
        try:
            info = httpx.get(USERINFO_URL, headers={"Authorization": f"Bearer {access}"}, timeout=TIMEOUT)
        except httpx.HTTPError:
            raise ProviderError("Google did not respond. Try again in a minute.") from None
        email = info.json().get("email") if info.status_code == 200 else None
        if not email:
            raise ProviderError("Google did not share the account's email address.")
        return Grant(refresh_token=refresh, account_email=email)

    def free_busy(self, refresh_token: str, calendar_ids: list[str], start: datetime, end: datetime) -> list[Interval]:
        token = self._access_token(refresh_token)
        resp = self._post(
            f"{API}/freeBusy",
            headers={"Authorization": f"Bearer {token}"},
            json={"timeMin": _iso(start), "timeMax": _iso(end), "items": [{"id": c} for c in calendar_ids]},
        )
        if resp.status_code != 200:
            raise ProviderError("Could not read free/busy from Google Calendar.")
        busy: list[Interval] = []
        for cal in resp.json().get("calendars", {}).values():
            busy += [(_parse(b["start"]), _parse(b["end"])) for b in cal.get("busy", [])]
        return sorted(busy)

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
        token = self._access_token(refresh_token)
        headers = {"Authorization": f"Bearer {token}"}
        body = {
            "id": event_id,  # Google rejects a second insert with the same id: our idempotency key
            "summary": summary,
            "start": {"dateTime": _iso(start)},
            "end": {"dateTime": _iso(end)},
            "attendees": [{"email": a} for a in attendees],
            "conferenceData": {
                "createRequest": {"requestId": event_id, "conferenceSolutionKey": {"type": "hangoutsMeet"}}
            },
        }
        resp = self._post(
            f"{API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", headers=headers, json=body
        )
        if resp.status_code == 409:
            try:
                resp = httpx.get(f"{API}/calendars/primary/events/{event_id}", headers=headers, timeout=TIMEOUT)
            except httpx.HTTPError:
                raise ProviderError("Google Calendar did not respond. Try again in a minute.") from None
        if resp.status_code != 200:
            raise ProviderError("Google Calendar did not create the event.")
        return CreatedEvent(event_id=event_id, meet_url=resp.json().get("hangoutLink"))

    def cancel_event(self, refresh_token: str, event_id: str) -> None:
        token = self._access_token(refresh_token)
        try:
            resp = httpx.delete(
                f"{API}/calendars/primary/events/{event_id}?sendUpdates=all",
                headers={"Authorization": f"Bearer {token}"},
                timeout=TIMEOUT,
            )
        except httpx.HTTPError:
            raise ProviderError("Google Calendar did not respond. Try again in a minute.") from None
        if resp.status_code not in (200, 204, 404, 410):
            raise ProviderError("Google Calendar did not cancel the event.")

    def revoke(self, refresh_token: str) -> None:
        self._post(REVOKE_URL, data={"token": refresh_token})
