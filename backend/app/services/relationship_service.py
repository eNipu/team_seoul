"""Relationship maintenance: friend view, activity ideas, hangout log, reconnection nudges.

A "friend" is either a mutual Heldly connection or a private person note (someone not on
Heldly). Rules:
- Heldly never contacts anyone; every suggestion is only shown to the requesting user.
- For connections, only the friend's non-PRIVATE memories are ever read.
- Person notes are owner-only and never leave the owner's account.
- Unknown, foreign and blocked ids are indistinguishable (NOT_FOUND).
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Connection, Memory, Person, RelationshipEvent, User
from app.models._base import as_aware, utcnow
from app.schemas.social import (
    ActivityIdeasView,
    ActivitySuggestion,
    FriendKind,
    FriendView,
    InteractionOut,
    LogInteractionOut,
    ReconnectionCandidate,
    ReconnectView,
    SharedMemory,
)
from app.services import analytics, memory_service, people_service, social_service
from app.services.errors import InvalidRequest, NotFound
from app.services.user_service import display_name

DEFAULT_RECONNECT_DAYS = 21
_INTEREST_CATEGORIES = {"INTEREST", "PREFERENCE", "EXPERIENCE"}
_WORD = re.compile(r"[a-z0-9]+")

# Words that say nothing about what two people have in common.
_STOPWORDS = frozenset(
    """
    about after again also always around been before being both could does doing each ever every
    from going have having into just like likes liked love loves loved enjoy enjoys enjoyed
    prefer prefers preferred really some than that their them then there these they thing things
    this those very want wants went were what when where which while with would your yours
    more most much many favorite favourite tried trying time times
    """.split()  # noqa: SIM905 - a word list reads better than 70 quoted literals
)

# keyword prefix -> (title, description). Matched against whole words of a shared interest.
_ACTIVITY_IDEAS: dict[str, tuple[str, str]] = {
    "hik": ("Go for a hike", "Pick an easy trail and catch up on the way."),
    "coffee": ("Grab a coffee", "Try a café neither of you has been to."),
    "food": ("Try a new place to eat", "Pick a cuisine you both like and book a table."),
    "cook": ("Cook together", "Choose a recipe and make it at one of your places."),
    "movie": ("Movie night", "Watch something you've both been meaning to see."),
    "film": ("Movie night", "Watch something you've both been meaning to see."),
    "music": ("See live music", "Find a small gig or swap playlists over a drink."),
    "game": ("Game night", "Board games or co-op video games, snacks included."),
    "book": ("Swap books", "Trade a recent favourite and talk about it next time."),
    "read": ("Swap books", "Trade a recent favourite and talk about it next time."),
    "run": ("Go for a run", "An easy-paced run with a coffee after."),
    "climb": ("Go climbing", "Book a session at a climbing gym."),
    "art": ("Visit an exhibition", "Pick a gallery or museum show and wander through it."),
    "travel": ("Plan a day trip", "Somewhere reachable by train, there and back in a day."),
    "photo": ("Photo walk", "Walk a neighbourhood with your cameras or phones."),
    "yoga": ("Take a class together", "Book the same yoga class and get tea after."),
}
_DEFAULT_IDEAS: list[tuple[str, str]] = [
    ("Quick call", "A 15-minute call to catch up on what's new."),
    ("Walk and talk", "A relaxed walk somewhere green."),
]
_NO_CONTACT = "Propose a time yourself — Heldly won't contact them for you."


@dataclass
class _Friend:
    kind: FriendKind
    id: str
    display_name: str
    since: datetime
    last_interaction_at: datetime | None
    last_activity: str | None
    interest_labels: list[str]
    terms: set[str] = field(default_factory=set)
    connection: Connection | None = None
    friend_user: User | None = None
    person: Person | None = None


def _terms(*texts: str) -> set[str]:
    """Lower-case comparison terms: whole labels plus their meaningful words."""
    out: set[str] = set()
    for text in texts:
        label = " ".join(_WORD.findall((text or "").lower()))
        words = [w for w in label.split() if len(w) > 3 and w not in _STOPWORDS]
        out.update(words)
        if label and len(label) > 2 and label not in _STOPWORDS and len(label.split()) <= 3:
            out.add(label)
    return out


def _memory_terms(memories: list[Memory]) -> set[str]:
    out: set[str] = set()
    for m in memories:
        if m.category in _INTEREST_CATEGORIES:
            out |= _terms(m.title, *(m.tags or []))
    return out


def _my_terms(db: Session, user: User) -> set[str]:
    rows = db.scalars(select(Memory).where(Memory.user_id == user.id)).all()
    return _memory_terms(list(rows))


def _connection_events(db: Session, connection_id: uuid.UUID, limit: int = 10) -> list[InteractionOut]:
    rows = db.scalars(
        select(RelationshipEvent)
        .where(RelationshipEvent.connection_id == connection_id, RelationshipEvent.event_type == "INTERACTION")
        .order_by(RelationshipEvent.created_at.desc())
        .limit(limit)
    ).all()
    return [
        InteractionOut(occurred_at=as_aware(r.created_at), activity=(r.event_data or {}).get("activity")) for r in rows
    ]


def _connection_friend(db: Session, user: User, conn: Connection, friend_id: uuid.UUID) -> _Friend:
    friend = db.get(User, friend_id)
    visible = memory_service.visible_memories_of(db, friend_id, connected=True)
    events = _connection_events(db, conn.id, limit=1)
    return _Friend(
        kind="connection",
        id=str(conn.id),
        display_name=display_name(friend),
        since=as_aware(conn.created_at),
        last_interaction_at=events[0].occurred_at if events else None,
        last_activity=events[0].activity if events else None,
        interest_labels=[m.title for m in visible if m.category == "INTEREST"],
        terms=_memory_terms(visible),
        connection=conn,
        friend_user=friend,
    )


def _person_friend(db: Session, person: Person) -> _Friend:
    events = people_service.recent_interactions(db, person.id, limit=1)
    labels = list(person.interests or [])
    return _Friend(
        kind="person",
        id=str(person.id),
        display_name=person.name,
        since=as_aware(person.created_at),
        last_interaction_at=events[0].occurred_at if events else None,
        last_activity=events[0].activity if events else None,
        interest_labels=labels,
        terms=_terms(*labels),
        person=person,
    )


def _resolve(db: Session, user: User, connection_id: str | None, person_id: str | None) -> _Friend:
    if bool(connection_id) == bool(person_id):
        raise InvalidRequest("Provide exactly one of connection_id or person_id.")
    if person_id:
        return _person_friend(db, people_service.owned(db, user, person_id))
    conn, friend_id = social_service.own_connection(db, user, connection_id or "")
    if social_service.is_blocked(db, user.id, friend_id):
        raise NotFound("connection not found")
    return _connection_friend(db, user, conn, friend_id)


def _all_friends(db: Session, user: User) -> list[_Friend]:
    out: list[_Friend] = []
    conns = db.scalars(
        select(Connection).where(or_(Connection.user_a_id == user.id, Connection.user_b_id == user.id))
    ).all()
    for c in conns:
        friend_id = c.user_b_id if c.user_a_id == user.id else c.user_a_id
        if not social_service.is_blocked(db, user.id, friend_id):
            out.append(_connection_friend(db, user, c, friend_id))
    for p in db.scalars(select(Person).where(Person.owner_user_id == user.id)).all():
        out.append(_person_friend(db, p))
    return out


def _shared(mine: set[str], friend: _Friend) -> list[str]:
    return sorted(mine & friend.terms)


def _days_since(friend: _Friend) -> int:
    baseline = friend.last_interaction_at or friend.since
    return max((utcnow() - baseline).days, 0)


def _ideas(shared: list[str], friend: _Friend) -> list[tuple[str, str, list[str]]]:
    """(title, description, grounded_in). Shared interests first, then the friend's own."""
    out: list[tuple[str, str, list[str]]] = []
    seen: set[str] = set()
    for source in (shared, sorted(friend.terms)):
        for term in source:
            for key, (title, description) in _ACTIVITY_IDEAS.items():
                if title not in seen and any(word.startswith(key) for word in term.split()):
                    seen.add(title)
                    out.append((title, description, [term]))
    for title, description in _DEFAULT_IDEAS:
        if title not in seen:
            out.append((title, description, []))
    return out[:3]


def view_friend(db: Session, user: User, connection_id: str | None = None, person_id: str | None = None) -> FriendView:
    friend = _resolve(db, user, connection_id, person_id)
    shared = _shared(_my_terms(db, user), friend)
    if friend.kind == "person":
        person = friend.person
        return FriendView(
            kind="person",
            id=friend.id,
            display_name=friend.display_name,
            on_heldly=False,
            since=friend.since,
            last_interaction_at=friend.last_interaction_at,
            relationship=person.relationship,
            notes=person.notes,
            interests=friend.interest_labels,
            shared_interests=shared,
            shared_memories=[],
            recent_interactions=people_service.recent_interactions(db, person.id),
        )
    profile = friend.friend_user.profile if friend.friend_user else None
    bio = profile.bio if profile and profile.visibility in ("CONNECTIONS", "PUBLIC") else None
    visible = (
        memory_service.visible_memories_of(db, friend.friend_user.id, connected=True) if friend.friend_user else []
    )
    return FriendView(
        kind="connection",
        id=friend.id,
        display_name=friend.display_name,
        on_heldly=True,
        since=friend.since,
        last_interaction_at=friend.last_interaction_at,
        bio=bio,
        interests=friend.interest_labels,
        shared_interests=shared,
        shared_memories=[
            SharedMemory(category=m.category, title=m.title, description=m.description, tags=list(m.tags or []))
            for m in visible
        ],
        recent_interactions=_connection_events(db, friend.connection.id),
    )


def suggest_activity(
    db: Session, user: User, connection_id: str | None = None, person_id: str | None = None
) -> ActivityIdeasView:
    friend = _resolve(db, user, connection_id, person_id)
    shared = _shared(_my_terms(db, user), friend)
    days = _days_since(friend)

    base = "You're connected on Heldly (+0.2)." if friend.kind == "connection" else "They're in your circle (+0.2)."
    score = 0.2
    explanation = [base]
    if shared:
        bonus = min(0.6, 0.15 * len(shared))
        score += bonus
        explanation.append(f"{len(shared)} shared interest(s): {', '.join(shared[:5])} (+{bonus:.2f}).")
    else:
        explanation.append("No shared interests saved yet.")
    if days > DEFAULT_RECONNECT_DAYS:
        score += 0.2
        explanation.append(f"No logged hangout in {days} days (+0.2).")

    suggestions = [
        ActivitySuggestion(
            title=title,
            description=description,
            grounded_in=grounded,
            suggested_action=_NO_CONTACT if grounded else "Send a quick message to check in.",
        )
        for title, description, grounded in _ideas(shared, friend)
    ]
    analytics.track(db, "activity_suggested", user.id, count=len(suggestions))
    return ActivityIdeasView(
        kind=friend.kind,
        id=friend.id,
        display_name=friend.display_name,
        shared_interests=shared,
        match_score=round(min(score, 1.0), 2),
        score_explanation=explanation,
        suggestions=suggestions,
    )


def log_interaction(
    db: Session,
    user: User,
    connection_id: str | None = None,
    person_id: str | None = None,
    activity: str | None = None,
) -> LogInteractionOut:
    friend = _resolve(db, user, connection_id, person_id)
    if friend.kind == "person":
        when = people_service.log_interaction(db, friend.person, activity)
    else:
        when = utcnow()
        clean = " ".join((activity or "").split())[:120] or None
        db.add(
            RelationshipEvent(
                connection_id=friend.connection.id,
                event_type="INTERACTION",
                event_data={"by": str(user.id), "activity": clean},
                created_at=when,
            )
        )
        db.flush()
    return LogInteractionOut(recorded=True, kind=friend.kind, id=friend.id, last_interaction_at=when)


def reconnection_suggestions(
    db: Session, user: User, min_days: int = DEFAULT_RECONNECT_DAYS, limit: int = 5
) -> ReconnectView:
    min_days = min(max(min_days, 1), 3650)
    mine = _my_terms(db, user)
    candidates: list[ReconnectionCandidate] = []
    for friend in _all_friends(db, user):
        days = _days_since(friend)
        if days < min_days:
            continue
        if friend.last_interaction_at is None:
            where = "you connected" if friend.kind == "connection" else "you added them"
            reason = f"No hangout logged since {where} {days} days ago."
        else:
            reason = f"No logged hangout in {days} days."
        if friend.last_activity:
            suggested = f"Repeat '{friend.last_activity}'"
        else:
            ideas = _ideas(_shared(mine, friend), friend)
            suggested = ideas[0][0] if ideas and ideas[0][2] else "A quick call or coffee"
        candidates.append(
            ReconnectionCandidate(
                kind=friend.kind,
                id=friend.id,
                display_name=friend.display_name,
                days_since_last_interaction=days,
                last_activity=friend.last_activity,
                reason=reason,
                suggested_activity=suggested,
            )
        )
    candidates.sort(key=lambda c: c.days_since_last_interaction, reverse=True)
    candidates = candidates[: min(max(limit, 1), 20)]
    analytics.track(db, "reconnection_suggested", user.id, count=len(candidates))
    return ReconnectView(min_days=min_days, candidates=candidates)
