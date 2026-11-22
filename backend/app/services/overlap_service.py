"""Consent-first discovery. The caller owns the transaction and authenticates the user."""

import json
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from importlib.resources import files
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.orm import Session, aliased

from app.models import Block, Connection, OverlapExclusion, OverlapMatch, OverlapPreference, User
from app.models._base import utcnow
from app.schemas.overlap import MeetingPoint, OverlapCard, OverlapPreferenceInput, OverlapState, OverlapWindow
from app.services.errors import InvalidRequest, NotFound
from app.services.overlap_plans import PLANS, plan_for

_END_HOUR = {"morning": 12, "afternoon": 18, "evening": 24}
_SPOT_HOUR = {"morning": 10, "afternoon": 15, "evening": 19}


@dataclass(frozen=True)
class _AreaDetails:
    city: str
    zone: ZoneInfo
    name: str
    spot: str


_CITIES = json.loads(files("app.schemas").joinpath("overlap_cities.json").read_text(encoding="utf-8"))
_AREAS = {
    area: _AreaDetails(city["name"], ZoneInfo(city["timezone"]), details["name"], details["spot"])
    for city in _CITIES.values()
    for area, details in city["areas"].items()
}


def _lock(db: Session) -> None:
    # All discovery mutations acquire the same transaction-scoped lock *before* reading seats.
    # A no-row UPDATE obtains SQLite's writer reservation even in an already-open transaction.
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(765104831)"))
    else:
        db.execute(text("UPDATE overlap_preferences SET accepted = accepted WHERE 1 = 0"))
    db.flush()
    db.expire_all()


def _open(pref, now: datetime) -> bool:
    if pref is None or not pref.adults_confirmed:
        return False
    local_now = now.astimezone(_AREAS[pref.area].zone)
    return pref.date > local_now.date() or (pref.date == local_now.date() and local_now.hour < _END_HOUR[pref.slot])


def _eligible(a, b):
    def absent(left, right):
        return ~select(1).where(((left == a) & (right == b)) | ((left == b) & (right == a))).exists()

    return (
        absent(OverlapExclusion.actor_id, OverlapExclusion.other_id)
        & absent(Block.blocker_user_id, Block.blocked_user_id)
        & absent(Connection.user_a_id, Connection.user_b_id)
    )


def _peer(db, pref, now):
    if not _open(pref, now) or not pref.match_id:
        return None
    peer = db.scalar(
        select(OverlapPreference).where(
            OverlapPreference.match_id == pref.match_id,
            OverlapPreference.user_id != pref.user_id,
            _eligible(pref.user_id, OverlapPreference.user_id),
        )
    )
    if _open(peer, now):
        return peer
    return None


def _first_name(name):
    first = next(iter((name or "").split()), "")
    return first if first and all(c.isalpha() or c in "-'’" for c in first) else "Your match"


def _meeting_point(pref, peer, now) -> MeetingPoint | None:
    area = _AREAS[pref.area]
    when = datetime.combine(pref.date, time(_SPOT_HOUR[pref.slot]), area.zone)
    if not (pref.accepted and peer.accepted) or when <= now:
        return None
    if pref.spot_confirmed:
        status = "agreed" if peer.spot_confirmed else "suggested_by_you"
    else:
        status = "suggested_to_you" if peer.spot_confirmed else "available"
    return MeetingPoint(label=f"{area.spot} · {when:%Y-%m-%d %H:%M %Z}", status=status)


def get_state(db: Session, user: User, *, now: datetime | None = None) -> OverlapState:
    if now is None:
        now = utcnow()
    own, other = OverlapPreference, aliased(OverlapPreference)
    # One statement snapshot: never combine a pre-block vote with a post-block identity.
    row = db.execute(
        select(own, other, OverlapMatch, User.display_name)
        .select_from(own)
        .outerjoin(
            other,
            (other.match_id == own.match_id) & (other.user_id != own.user_id) & _eligible(own.user_id, other.user_id),
        )
        .outerjoin(OverlapMatch, OverlapMatch.id == other.match_id)
        .outerjoin(User, User.id == other.user_id)
        .where(own.user_id == user.id)
        .execution_options(populate_existing=True)
    ).one_or_none()
    if row is None:
        return OverlapState()
    pref, peer, match, name = row
    if not _open(pref, now):
        return OverlapState()
    state = OverlapState(preference=OverlapWindow.model_validate(pref))
    if _open(peer, now) and match is not None:
        mutual = pref.accepted and peer.accepted
        title, reason, challenge = plan_for(match.interest, pref.interests, peer.interests, _AREAS[pref.area].name)
        state.match = OverlapCard(
            id=str(match.id),
            status="introduced" if mutual else "waiting" if pref.accepted else "offered",
            title=title,
            reason=reason,
            challenge=challenge,
            meeting_point=_meeting_point(pref, peer, now),
            other_name=_first_name(name) if mutual else None,
        )
    return state


def _release(db, pref):
    peer = None
    if pref.match_id:
        match = db.get(OverlapMatch, pref.match_id)
        members = db.scalars(select(OverlapPreference).where(OverlapPreference.match_id == pref.match_id))
        for member in members:
            if member.user_id != pref.user_id:
                peer = member
            member.match_id = None
            member.accepted = False
            member.spot_confirmed = False
        db.flush()
        db.delete(match)
        db.flush()
    return peer


def _offer(db, pref, now):
    if not _open(pref, now) or _peer(db, pref, now) is not None:
        return
    _release(db, pref)
    candidates = (
        select(OverlapPreference)
        .where(
            OverlapPreference.area == pref.area,
            OverlapPreference.date == pref.date,
            OverlapPreference.slot == pref.slot,
            OverlapPreference.user_id != pref.user_id,
            OverlapPreference.adults_confirmed.is_(True),
            OverlapPreference.match_id.is_(None),
            _eligible(pref.user_id, OverlapPreference.user_id),
        )
        .order_by(OverlapPreference.user_id)
    )
    for peer in db.scalars(candidates):
        shared = [topic for topic in PLANS if topic in pref.interests and topic in peer.interests]
        if shared:
            match = OverlapMatch(interest=shared[0])
            db.add(match)
            db.flush()
            pref.match_id = peer.match_id = match.id
            pref.accepted = peer.accepted = False
            pref.spot_confirmed = peer.spot_confirmed = False
            db.flush()
            break


def opt_in(db: Session, user: User, prefs: OverlapPreferenceInput) -> OverlapState:
    _lock(db)
    now = utcnow()
    area = _AREAS[prefs.area]
    if not _open(prefs, now) or prefs.date >= now.astimezone(area.zone).date() + timedelta(days=7):
        raise InvalidRequest(f"Choose an open window in the next seven {area.city} dates.")
    pref = db.get(OverlapPreference, user.id)
    released = None
    if pref is None:
        pref = OverlapPreference(user_id=user.id)
        db.add(pref)
    elif (pref.area, pref.date, pref.slot, set(pref.interests)) != (
        prefs.area,
        prefs.date,
        prefs.slot,
        set(prefs.interests),
    ):
        released = _release(db, pref)
    pref.area, pref.date, pref.slot = prefs.area, prefs.date, prefs.slot
    pref.interests, pref.adults_confirmed = list(prefs.interests), True
    db.flush()
    # Account deletion and social changes need not call discovery. Reclaim their
    # invalid seats on the next opt-in for this window, never on a poll.
    occupied = select(OverlapPreference).where(
        OverlapPreference.area == pref.area,
        OverlapPreference.date == pref.date,
        OverlapPreference.slot == pref.slot,
        OverlapPreference.match_id.is_not(None),
    )
    for member in db.scalars(occupied).all():
        if member.match_id and _peer(db, member, now) is None:
            _release(db, member)
    _offer(db, pref, now)
    if released is not None:
        _offer(db, released, now)
    return get_state(db, user, now=now)


def withdraw(db: Session, user: User) -> OverlapState:
    _lock(db)
    if pref := db.get(OverlapPreference, user.id):
        now = utcnow()
        released = _release(db, pref)
        db.delete(pref)
        db.flush()
        _offer(db, released, now)
    return OverlapState()


def _members(db, user, match_id):
    _lock(db)
    now = utcnow()
    pref = db.get(OverlapPreference, user.id)
    try:
        target = UUID(str(match_id))
    except ValueError:
        raise NotFound("Overlap not found") from None
    if not pref or pref.match_id != target or not (peer := _peer(db, pref, now)):
        raise NotFound("Overlap not found")
    return pref, peer, now


def _hide(db, pref, peer, now, kind, reason=None):
    db.add(OverlapExclusion(actor_id=pref.user_id, other_id=peer.user_id, kind=kind, reason=reason))
    _release(db, pref)
    _offer(db, peer, now)


def respond(db: Session, user: User, match_id: str, action: str) -> OverlapState:
    pref, peer, now = _members(db, user, match_id)
    if action == "yes":
        pref.accepted = True
        db.flush()
    elif action == "suggest_spot":
        if _meeting_point(pref, peer, now) is None:
            raise InvalidRequest("A mutual introduction and a future public meeting point are required.")
        pref.spot_confirmed = True
        db.flush()
    elif action in {"pass", "block"}:
        _hide(db, pref, peer, now, action)
        if action == "pass":
            _offer(db, pref, now)
    else:
        raise InvalidRequest("Unknown overlap action")
    return get_state(db, user, now=now)


def report(db: Session, user: User, match_id: str, reason: str) -> OverlapState:
    pref, peer, now = _members(db, user, match_id)
    if reason not in {"safety", "spam", "other"}:
        raise InvalidRequest("Unknown report reason")
    _hide(db, pref, peer, now, "report", reason)
    return get_state(db, user, now=now)
