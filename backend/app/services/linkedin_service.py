"""LinkedIn import for the website: list the user's own connections, then import the ones they pick.

Two steps, both started by the user on the website:

1. ``fetch_connections`` reads the signed-in member's connection list with the LinkedIn
   session cookies the user pastes. It calls the same endpoint the page
   https://www.linkedin.com/mynetwork/invite-connect/connections/ loads its list from.
2. ``build_candidates`` turns the connections the user ticked into people-import
   candidates. With an Apify token it first fetches each profile's details (company,
   location, skills) from the Apify LinkedIn profile scraper; without one it uses the
   name and headline from step 1.

Nothing is added to the user's people here: the candidates go through the normal
people-import review (``people_service.propose_import`` / ``import_people``).

The cookies are a full LinkedIn session. They are used for the requests in step 1 and
then dropped: never stored, never logged, never put in an error message, never sent to
Apify. Reading a connection list this way is automated access that LinkedIn's terms do
not allow; the website says so before the user pastes anything.
"""

from __future__ import annotations

import json
import logging
import re
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

import httpx

from app.ai.extraction import contains_sensitive
from app.schemas.social import PersonCandidate
from app.services.errors import InvalidRequest, RateLimited, UpstreamError

log = logging.getLogger(__name__)

CONNECTIONS_URL = "https://www.linkedin.com/voyager/api/relationships/dash/connections"
CONNECTIONS_DECORATION = "com.linkedin.voyager.dash.deco.web.mynetwork.ConnectionListWithProfile-16"
APIFY_RUN_URL = "https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items"
APIFY_MODE = "Profile details no email ($4 per 1k)"

PAGE_SIZE = 40
PAGE_PAUSE_SECONDS = 0.6
MAX_COOKIE_INPUT = 20_000
RELATIONSHIP = "LinkedIn connection"
SOURCE = "linkedin"

_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
_COOKIE_NAME = re.compile(r"^[A-Za-z0-9_.\-]{1,64}$")
# Printable ASCII without the characters that would end or split a Cookie header.
_COOKIE_VALUE = re.compile(r"^[\x21-\x2b\x2d-\x3a\x3c-\x7e]{1,4096}$")
_IDENTIFIER = re.compile(r"^[\w\-.%]{1,200}$")
_BARE_TOKEN = re.compile(r"^[A-Za-z0-9_\-=+/.]{20,2000}$")

NO_SESSION = (
    "LinkedIn did not accept these cookies. Copy them again while you are signed in to LinkedIn "
    "(they stop working when you sign out), and include both li_at and JSESSIONID."
)


@dataclass(frozen=True)
class Connection:
    public_identifier: str
    name: str
    headline: str | None
    connected_on: date | None

    @property
    def profile_url(self) -> str:
        return f"https://www.linkedin.com/in/{self.public_identifier}"


@dataclass(frozen=True)
class ConnectionPage:
    connections: list[Connection]
    total: int | None
    truncated: bool


# ------------------------------------------------------------------------ cookies
def _from_json(raw: str) -> dict[str, str]:
    try:
        data = json.loads(raw)
    except ValueError:
        raise InvalidRequest("Could not read the cookies. Paste them exactly as they were copied.") from None
    if isinstance(data, dict) and isinstance(data.get("cookies"), list):
        data = data["cookies"]
    found: dict[str, str] = {}
    if isinstance(data, list):  # the format cookie-export browser extensions produce
        for item in data:
            if not isinstance(item, dict):
                continue
            domain = item.get("domain")
            if isinstance(domain, str) and "linkedin.com" not in domain:
                continue
            name, value = item.get("name"), item.get("value")
            if isinstance(name, str) and isinstance(value, str):
                found[name] = value
    elif isinstance(data, dict):
        found = {k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, str)}
    return found


def _from_header(raw: str) -> dict[str, str]:
    text = raw.strip()
    if text.lower().startswith("cookie:"):
        text = text[7:]
    found: dict[str, str] = {}
    for part in text.replace("\n", ";").split(";"):
        name, sep, value = part.strip().partition("=")
        if sep and name:
            found[name.strip()] = value.strip()
    return found


def parse_cookies(raw: str) -> dict[str, str]:
    """Read LinkedIn session cookies from what the user pasted.

    Accepts the JSON a cookie-export extension copies, a ``Cookie:`` header value
    (``li_at=...; JSESSIONID=...``), or the bare ``li_at`` value. ``li_at`` is required.
    """
    text = (raw or "").strip()
    if not text:
        raise InvalidRequest("Paste your LinkedIn cookies first.")
    if len(text) > MAX_COOKIE_INPUT:
        raise InvalidRequest("That is too long to be LinkedIn cookies.")
    if text[0] in "[{":
        found = _from_json(text)
    elif "li_at=" in text or ";" in text:
        found = _from_header(text)
    elif _BARE_TOKEN.match(text):
        found = {"li_at": text}
    else:
        found = {}
    cookies = {name: value for name, value in found.items() if _COOKIE_NAME.match(name) and _COOKIE_VALUE.match(value)}
    if not cookies.get("li_at"):
        raise InvalidRequest("These cookies do not include li_at, LinkedIn's sign-in cookie.")
    if not cookies.get("JSESSIONID"):
        # LinkedIn compares the csrf-token header with this cookie. A made-up pair is
        # often accepted; the real JSESSIONID is the reliable choice.
        cookies["JSESSIONID"] = f'"ajax:{secrets.randbelow(10**19):019d}"'
    return cookies


def _headers(cookies: dict[str, str]) -> dict[str, str]:
    return {
        "accept": "application/vnd.linkedin.normalized+json+2.1",
        "accept-language": "en-US,en;q=0.9",
        "csrf-token": cookies["JSESSIONID"].strip('"'),
        "x-restli-protocol-version": "2.0.0",
        "x-li-lang": "en_US",
        "user-agent": _USER_AGENT,
        "referer": "https://www.linkedin.com/mynetwork/invite-connect/connections/",
        "cookie": "; ".join(f"{name}={value}" for name, value in cookies.items()),
    }


# --------------------------------------------------------------- reading the list
def _text(value: Any) -> str | None:
    if isinstance(value, dict):
        value = value.get("text")
    if not isinstance(value, str):
        return None
    return " ".join(value.split()) or None


def _connected_on(value: Any) -> date | None:
    if not isinstance(value, int | float) or value <= 0:
        return None
    try:
        return datetime.fromtimestamp(value / 1000, tz=UTC).date()
    except (OverflowError, OSError, ValueError):
        return None


def _connection(profile: Any, created_at: Any) -> Connection | None:
    if not isinstance(profile, dict):
        return None
    identifier = profile.get("publicIdentifier")
    if not isinstance(identifier, str) or not _IDENTIFIER.match(identifier):
        return None
    name = " ".join(p for p in (_text(profile.get("firstName")), _text(profile.get("lastName"))) if p)
    if not name:
        return None
    headline = (_text(profile.get("headline")) or "")[:300] or None
    return Connection(identifier, name[:120], headline, _connected_on(created_at))


def parse_connections(payload: Any) -> tuple[list[Connection], int | None]:
    """Connections in one response page, in LinkedIn's order, and the total it reports."""
    if not isinstance(payload, dict):
        return [], None
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    included = payload.get("included") if isinstance(payload.get("included"), list) else []
    by_urn = {e["entityUrn"]: e for e in included if isinstance(e, dict) and isinstance(e.get("entityUrn"), str)}

    rows: list[Any] = []
    refs = data.get("*elements")
    if isinstance(refs, list):  # normalized response: the list holds references
        rows = [by_urn.get(ref) for ref in refs]
    elif isinstance(data.get("elements"), list):  # plain response: the list holds the rows
        rows = data["elements"]
    if not any(rows):
        rows = [e for e in included if isinstance(e, dict) and str(e.get("$type", "")).endswith(".Connection")]

    found: list[Connection] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        profile = row.get("connectedMemberResolutionResult") or by_urn.get(
            row.get("*connectedMemberResolutionResult") or row.get("connectedMember")
        )
        connection = _connection(profile, row.get("createdAt"))
        if connection and connection.public_identifier not in seen:
            seen.add(connection.public_identifier)
            found.append(connection)

    paging = data.get("paging")
    total = paging.get("total") if isinstance(paging, dict) else None
    return found, total if isinstance(total, int) and total >= 0 else None


def _get_page(client: httpx.Client, headers: dict[str, str], start: int) -> Any:
    params = {
        "count": PAGE_SIZE,
        "decorationId": CONNECTIONS_DECORATION,
        "q": "search",
        "sortType": "RECENTLY_ADDED",
        "start": start,
    }
    try:
        response = client.get(CONNECTIONS_URL, params=params, headers=headers)
    except httpx.HTTPError as exc:
        # Only the error class: the request (and its cookies) must not reach the log.
        log.warning("linkedin connections request failed: %s", type(exc).__name__)
        raise UpstreamError("Could not reach LinkedIn. Try again in a moment.") from None
    status = response.status_code
    if status in (429, 999):
        raise RateLimited("LinkedIn is limiting requests from this account. Wait an hour before trying again.")
    if status in (401, 403) or 300 <= status < 400:
        raise InvalidRequest(NO_SESSION)
    if status != 200:
        log.warning("linkedin connections request returned %s", status)
        raise UpstreamError(f"LinkedIn returned an unexpected response ({status}).")
    try:
        return response.json()
    except ValueError:
        raise InvalidRequest(NO_SESSION) from None  # a sign-in page instead of data


def fetch_connections(
    raw_cookies: str,
    limit: int,
    *,
    client: httpx.Client | None = None,
    pause: Callable[[float], None] = time.sleep,
) -> ConnectionPage:
    """The signed-in member's connections, newest first, up to ``limit``."""
    headers = _headers(parse_cookies(raw_cookies))
    limit = max(1, limit)
    own_client = client is None
    client = client or httpx.Client(timeout=20.0, follow_redirects=False)
    found: list[Connection] = []
    seen: set[str] = set()
    total: int | None = None
    try:
        start = 0
        while len(found) < limit:
            if start:
                pause(PAGE_PAUSE_SECONDS)
            page, reported = parse_connections(_get_page(client, headers, start))
            total = reported if reported is not None else total
            fresh = [c for c in page if c.public_identifier not in seen]
            if not fresh:
                break
            seen.update(c.public_identifier for c in fresh)
            found.extend(fresh)
            start += PAGE_SIZE
            if total is not None and start >= total:
                break
    finally:
        if own_client:
            client.close()
    truncated = len(found) > limit or (total is not None and total > len(found))
    return ConnectionPage(found[:limit], total, truncated)


# ------------------------------------------------------------------ profile details
def fetch_profiles(
    identifiers: list[str],
    *,
    token: str,
    actor: str,
    timeout: float,
    client: httpx.Client | None = None,
) -> dict[str, dict]:
    """Profile details from the Apify LinkedIn profile scraper, keyed by public identifier."""
    wanted = [i for i in identifiers if _IDENTIFIER.match(i)]
    if not wanted:
        return {}
    own_client = client is None
    client = client or httpx.Client(timeout=timeout)
    try:
        response = client.post(
            APIFY_RUN_URL.format(actor=actor),
            headers={"authorization": f"Bearer {token}"},
            json={
                "profileScraperMode": APIFY_MODE,
                "queries": [f"https://www.linkedin.com/in/{i}" for i in wanted],
            },
        )
    except httpx.HTTPError as exc:
        log.warning("apify profile request failed: %s", type(exc).__name__)
        raise UpstreamError("Could not reach Apify for profile details.") from None
    finally:
        if own_client:
            client.close()
    if response.status_code in (401, 403):
        raise UpstreamError("Apify rejected the token in APIFY_TOKEN.")
    if response.status_code == 402:
        raise UpstreamError("The Apify account is out of credit.")
    if response.status_code not in (200, 201):
        log.warning("apify profile request returned %s", response.status_code)
        raise UpstreamError(f"Apify returned an unexpected response ({response.status_code}).")
    try:
        items = response.json()
    except ValueError:
        raise UpstreamError("Apify returned an unreadable response.") from None
    profiles: dict[str, dict] = {}
    lowered = {i.lower(): i for i in wanted}
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        query = item.get("query") if isinstance(item.get("query"), dict) else {}
        for key in (query.get("publicIdentifier"), item.get("publicIdentifier")):
            if isinstance(key, str) and key.lower() in lowered:
                profiles[lowered[key.lower()]] = item
                break
    return profiles


def _first(items: Any) -> dict:
    return items[0] if isinstance(items, list) and items and isinstance(items[0], dict) else {}


def _skills(profile: dict) -> list[str]:
    names: list[str] = []
    top = profile.get("topSkills")
    if isinstance(top, str):
        names += [part.strip() for part in top.split("•")]
    for skill in profile.get("skills") or []:
        if isinstance(skill, dict) and isinstance(skill.get("name"), str):
            names.append(skill["name"].strip())
    out: list[str] = []
    seen: set[str] = set()
    for name in names:
        if name and len(name) <= 40 and name.lower() not in seen and not contains_sensitive(name):
            seen.add(name.lower())
            out.append(name)
    return out[:12]


def _sentence(text: str) -> str:
    text = " ".join(text.split()).rstrip(".")
    return f"{text}." if text else ""


def candidate(name: str, headline: str | None, profile: dict | None = None) -> PersonCandidate:
    """A people-import entry for one connection; ``profile`` is the Apify result when there is one."""
    profile = profile or {}
    headline = _text(profile.get("headline")) or headline
    parts: list[str] = []
    if headline:
        parts.append(_sentence(headline))
    job = _first(profile.get("experience"))
    company = _text(_first(profile.get("currentPosition")).get("companyName")) or _text(job.get("companyName"))
    position = _text(job.get("position"))
    if company and position:
        parts.append(_sentence(f"{position} at {company}"))
    elif company:
        parts.append(_sentence(f"Works at {company}"))
    location = profile.get("location") if isinstance(profile.get("location"), dict) else {}
    place = _text(location.get("linkedinText"))
    if place:
        parts.append(_sentence(f"Based in {place}"))
    school = _text(_first(profile.get("education")).get("schoolName"))
    if school:
        parts.append(_sentence(f"Studied at {school}"))
    about = _text(profile.get("about"))
    if about:
        parts.append(_sentence(about[:300] + ("…" if len(about) > 300 else "")))
    notes = " ".join(p for p in parts if p and not contains_sensitive(p))[:1000] or None
    return PersonCandidate(name=name[:80], relationship=RELATIONSHIP, notes=notes, interests=_skills(profile))


# ------------------------------------------------------------------- rate limit
class FetchLimiter:
    """How often one account may read its LinkedIn list (in memory; protects their LinkedIn account)."""

    def __init__(self, per_hour: int) -> None:
        self._per_hour = per_hour
        self._seen: dict[str, list[float]] = {}

    def check(self, key: str) -> None:
        cutoff = time.monotonic() - 3600
        recent = [t for t in self._seen.get(key, []) if t > cutoff]
        if len(recent) >= self._per_hour:
            raise RateLimited("You have fetched your LinkedIn connections several times. Try again in an hour.")
        recent.append(time.monotonic())
        if len(self._seen) > 10_000:
            self._seen.clear()
        self._seen[key] = recent
