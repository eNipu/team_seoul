"""Relationship maintenance: friend view, activity ideas, hangout log, reconnection nudges,
finding people by interest, group plans, meetup briefs/recaps and follow-ups.

A "friend" is either a mutual Venn connection or a private person note (someone not on
Venn). Rules:
- Venn never contacts anyone; every suggestion is only shown to the requesting user.
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

from app.models import Connection, FollowUp, Memory, Person, RelationshipEvent, User
from app.models._base import as_aware, utcnow
from app.schemas.social import (
    ActivityIdeasView,
    ActivitySuggestion,
    BriefView,
    CompleteFollowUpOut,
    FollowUpListOut,
    FollowUpOut,
    FriendKind,
    FriendListOut,
    FriendSummary,
    FriendView,
    GroupMember,
    GroupPlanView,
    InteractionOut,
    LogInteractionOut,
    OpenFollowUpOut,
    PartialOverlap,
    PeopleSearchResult,
    PeopleSearchView,
    RecapOut,
    ReconnectionCandidate,
    ReconnectView,
    SharedMemory,
    ThisWeekAction,
    ThisWeekView,
    VennView,
)
from app.services import analytics, memory_service, people_service, social_service
from app.services.errors import InvalidRequest, NotFound
from app.services.user_service import display_name, is_sample_user

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
    more most much many favorite favourite tried trying time times used take took together
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
    "boulder": ("Go climbing", "Book a session at a climbing gym."),
    "ramen": ("Try a new place to eat", "Pick a cuisine you both like and book a table."),
    "noodle": ("Try a new place to eat", "Pick a cuisine you both like and book a table."),
    "sushi": ("Try a new place to eat", "Pick a cuisine you both like and book a table."),
    "pizza": ("Try a new place to eat", "Pick a cuisine you both like and book a table."),
    "brunch": ("Try a new place to eat", "Pick a cuisine you both like and book a table."),
    "bak": ("Bake together", "Pick one recipe, split the shopping and share what comes out."),
    "board": ("Game night", "Board games or co-op video games, snacks included."),
    "potter": ("Make something together", "Book a pottery or craft class and take home what you make."),
    "ceramic": ("Make something together", "Book a pottery or craft class and take home what you make."),
    "craft": ("Make something together", "Book a pottery or craft class and take home what you make."),
    "museum": ("Visit an exhibition", "Pick a gallery or museum show and wander through it."),
    "galler": ("Visit an exhibition", "Pick a gallery or museum show and wander through it."),
    "concert": ("See live music", "Find a small gig or swap playlists over a drink."),
    "jazz": ("See live music", "Find a small gig or swap playlists over a drink."),
    "walk": ("Go for a walk", "Pick a route with a good stop halfway."),
    "cycl": ("Go for a ride", "An easy route with somewhere to stop for a snack."),
    "bik": ("Go for a ride", "An easy route with somewhere to stop for a snack."),
    "swim": ("Go for a swim", "A pool or a lake, then something warm to drink."),
    "tennis": ("Play a match", "Book a court for an hour; loser buys the drinks."),
    "badminton": ("Play a match", "Book a court for an hour; loser buys the drinks."),
    "danc": ("Go dancing", "A class or a night out, whichever feels easier."),
    "garden": ("Visit a garden", "A botanical garden or a plant market, at a slow pace."),
    "karaoke": ("Karaoke night", "Book a room for an hour and take turns picking songs."),
}
_DEFAULT_IDEAS: list[tuple[str, str]] = [
    ("Quick call", "A 15-minute call to catch up on what's new."),
    ("Walk and talk", "A relaxed walk somewhere green."),
]
_GROUP_IDEAS: list[tuple[str, str]] = [
    ("Potluck dinner", "Everyone brings one dish; all you need to agree on is a date."),
    ("Picnic in the park", "Low effort, easy to join late, and nobody has to host."),
    ("Board game night", "A couple of easy games so everyone can jump in."),
]
_NO_CONTACT = "Propose a time yourself — Venn won't contact them for you."
MAX_OPEN_FOLLOW_UPS = 20
MAX_FOLLOW_UP_LEN = 200
MIN_GROUP, MAX_GROUP = 2, 6
# Extra words to ignore in a "who do I know who..." query.
_QUERY_STOPWORDS = _STOPWORDS | frozenset(
    """
    who whos whose know knows anyone anybody someone somebody people person friend friends the and for
    are any is in of to do my me can which on at or it be has had was not our us we you
    """.split()  # noqa: SIM905
)


@dataclass
class Friend:
    kind: FriendKind
    id: str
    display_name: str
    since: datetime
    last_interaction_at: datetime | None
    last_activity: str | None
    interest_labels: list[str]
    terms: set[str] = field(default_factory=set)
    # Connections only: the memories the friend chose to share (never PRIVATE ones).
    memories: list[Memory] = field(default_factory=list)
    # The user's own saved memories that are about this friend ("Photo walks with Maya").
    about: list[Memory] = field(default_factory=list)
    about_terms: set[str] = field(default_factory=set)
    is_sample: bool = False
    connection: Connection | None = None
    friend_user: User | None = None
    person: Person | None = None


def terms_of(*texts: str) -> set[str]:
    """Lower-case comparison terms: whole labels plus their meaningful words."""
    out: set[str] = set()
    for text in texts:
        label = " ".join(_WORD.findall((text or "").lower()))
        words = [w for w in label.split() if len(w) > 3 and w not in _STOPWORDS]
        out.update(words)
        if label and len(label) > 2 and label not in _STOPWORDS and len(label.split()) <= 3:
            out.add(label)
    return out


_CONNECTIVES = frozenset({"with", "and", "my", "our", "the", "to", "for", "of", "me", "i", "a"})


def _name_words(*names: str) -> set[str]:
    return {w for name in names for w in _WORD.findall((name or "").lower())}


def _topic(m: Memory, *names: str) -> str:
    """A memory's title without the people it is about: "Photo walks with Maya" -> "photo walks"."""
    drop = _name_words(*(m.people or []), *names) | _CONNECTIVES
    return " ".join(w for w in _WORD.findall(m.title.lower()) if w not in drop)


def _memory_terms(memories: list[Memory]) -> set[str]:
    out: set[str] = set()
    for m in memories:
        if m.category in _INTEREST_CATEGORIES:
            out |= terms_of(_topic(m), *(m.tags or []))
    return out


def own_memories(db: Session, user: User) -> list[Memory]:
    return list(db.scalars(select(Memory).where(Memory.user_id == user.id).order_by(Memory.created_at.desc())).all())


def my_terms(db: Session, user: User) -> set[str]:
    return _memory_terms(own_memories(db, user))


def _is_about(m: Memory, name: str) -> bool:
    """Is this memory of the user's about the friend called `name`?

    Yes when the memory names them ("Maya" also stands for "Maya Chen"). A memory saved without
    names still counts when the friend's first name appears in its text, capitalised as a name.
    """
    if m.people:
        return any(memory_service.same_person(n, name) for n in m.people)
    first = name.split()[0] if name.split() else ""
    if len(first) < 3 or not first[0].isupper():
        return False
    return re.search(rf"\b{re.escape(first)}\b", f"{m.title} {m.description}") is not None


def _link_own_memories(friend: Friend, mine: list[Memory]) -> Friend:
    """Attach the user's memories about this friend; what they did together counts as common ground."""
    friend.about = [m for m in mine if _is_about(m, friend.display_name)]
    for m in friend.about:
        if m.category != "DISLIKE":
            friend.about_terms |= terms_of(_topic(m, friend.display_name), *(m.tags or []))
    friend.terms |= friend.about_terms
    return friend


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


def _connection_friend(db: Session, user: User, conn: Connection, friend_id: uuid.UUID) -> Friend:
    friend = db.get(User, friend_id)
    visible = memory_service.visible_memories_of(db, friend_id, connected=True)
    events = _connection_events(db, conn.id, limit=1)
    return Friend(
        kind="connection",
        id=str(conn.id),
        display_name=display_name(friend),
        since=as_aware(conn.created_at),
        last_interaction_at=events[0].occurred_at if events else None,
        last_activity=events[0].activity if events else None,
        interest_labels=[m.title for m in visible if m.category == "INTEREST"],
        terms=_memory_terms(visible),
        memories=list(visible),
        connection=conn,
        friend_user=friend,
        is_sample=is_sample_user(friend),
    )


def _person_friend(db: Session, person: Person) -> Friend:
    events = people_service.recent_interactions(db, person.id, limit=1)
    labels = list(person.interests or [])
    return Friend(
        kind="person",
        id=str(person.id),
        display_name=person.name,
        since=as_aware(person.created_at),
        last_interaction_at=events[0].occurred_at if events else None,
        last_activity=events[0].activity if events else None,
        interest_labels=labels,
        terms=terms_of(*labels),
        person=person,
        is_sample=bool(person.is_sample),
    )


def resolve(db: Session, user: User, connection_id: str | None, person_id: str | None) -> Friend:
    if bool(connection_id) == bool(person_id):
        raise InvalidRequest("Provide exactly one of connection_id or person_id.")
    if person_id:
        return _link_own_memories(_person_friend(db, people_service.owned(db, user, person_id)), own_memories(db, user))
    conn, friend_id = social_service.own_connection(db, user, connection_id or "")
    if social_service.is_blocked(db, user.id, friend_id):
        raise NotFound("connection not found")
    return _link_own_memories(_connection_friend(db, user, conn, friend_id), own_memories(db, user))


def all_friends(db: Session, user: User) -> list[Friend]:
    out: list[Friend] = []
    conns = db.scalars(
        select(Connection).where(or_(Connection.user_a_id == user.id, Connection.user_b_id == user.id))
    ).all()
    for c in conns:
        friend_id = c.user_b_id if c.user_a_id == user.id else c.user_a_id
        if not social_service.is_blocked(db, user.id, friend_id):
            out.append(_connection_friend(db, user, c, friend_id))
    for p in db.scalars(select(Person).where(Person.owner_user_id == user.id)).all():
        out.append(_person_friend(db, p))
    mine = own_memories(db, user)
    return [_link_own_memories(friend, mine) for friend in out]


def compact(terms: set[str]) -> list[str]:
    """Sorted terms without single words that are already part of a longer term in the set.

    `terms_of("Board games")` yields {"board", "games", "board games"}; showing all three
    would triple-count one interest.
    """
    multi = [t.split() for t in terms if " " in t]
    return sorted(t for t in terms if " " in t or not any(t in words for words in multi))


def shared_terms(mine: set[str], friend: Friend) -> list[str]:
    """Common ground: interests both have, plus what the user's own memories say they did together."""
    return compact((mine & friend.terms) | friend.about_terms)


def days_since(friend: Friend) -> int:
    baseline = friend.last_interaction_at or friend.since
    return max((utcnow() - baseline).days, 0)


def _ideas_from(
    sources: list[list[str]], defaults: list[tuple[str, str]], limit: int = 3
) -> list[tuple[str, str, list[str]]]:
    """(title, description, grounded_in), walking `sources` in priority order, padded with defaults."""
    out: list[tuple[str, str, list[str]]] = []
    seen: set[str] = set()
    for source in sources:
        for term in source:
            for key, (title, description) in _ACTIVITY_IDEAS.items():
                if title not in seen and any(word.startswith(key) for word in term.split()):
                    seen.add(title)
                    out.append((title, description, [term]))
    for title, description in defaults:
        if title not in seen:
            out.append((title, description, []))
    return out[:limit]


def ideas_for(shared: list[str], friend: Friend) -> list[tuple[str, str, list[str]]]:
    """(title, description, grounded_in). Shared interests first, then the friend's own."""
    return _ideas_from([shared, sorted(friend.terms)], _DEFAULT_IDEAS)


def _shared_memories(friend: Friend) -> list[SharedMemory]:
    return [
        SharedMemory(category=m.category, title=m.title, description=m.description, tags=list(m.tags or []))
        for m in friend.memories
    ]


def view_friend(db: Session, user: User, connection_id: str | None = None, person_id: str | None = None) -> FriendView:
    friend = resolve(db, user, connection_id, person_id)
    shared = shared_terms(my_terms(db, user), friend)
    if friend.kind == "person":
        person = friend.person
        return FriendView(
            kind="person",
            id=friend.id,
            display_name=friend.display_name,
            on_venn=False,
            since=friend.since,
            last_interaction_at=friend.last_interaction_at,
            relationship=person.relationship,
            notes=person.notes,
            interests=friend.interest_labels,
            shared_interests=shared,
            shared_memories=[],
            recent_interactions=people_service.recent_interactions(db, person.id),
            follow_ups=open_follow_ups(db, user, friend),
        )
    profile = friend.friend_user.profile if friend.friend_user else None
    bio = profile.bio if profile and profile.visibility in ("CONNECTIONS", "PUBLIC") else None
    return FriendView(
        kind="connection",
        id=friend.id,
        display_name=friend.display_name,
        on_venn=True,
        since=friend.since,
        last_interaction_at=friend.last_interaction_at,
        bio=bio,
        interests=friend.interest_labels,
        shared_interests=shared,
        shared_memories=_shared_memories(friend),
        recent_interactions=_connection_events(db, friend.connection.id),
        follow_ups=open_follow_ups(db, user, friend),
    )


def suggest_activity(
    db: Session, user: User, connection_id: str | None = None, person_id: str | None = None
) -> ActivityIdeasView:
    friend = resolve(db, user, connection_id, person_id)
    shared = shared_terms(my_terms(db, user), friend)
    days = days_since(friend)

    base = "You're connected on Venn (+0.2)." if friend.kind == "connection" else "They're in your circle (+0.2)."
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
        for title, description, grounded in ideas_for(shared, friend)
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
    friend = resolve(db, user, connection_id, person_id)
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
    mine = my_terms(db, user)
    candidates: list[ReconnectionCandidate] = []
    for friend in all_friends(db, user):
        days = days_since(friend)
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
            ideas = ideas_for(shared_terms(mine, friend), friend)
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


# ------------------------------------------------------------------ follow-ups
def _follow_up_out(row: FollowUp) -> FollowUpOut:
    return FollowUpOut(follow_up_id=str(row.id), text=row.text, created_at=as_aware(row.created_at))


def _follow_up_target(friend: Friend):
    if friend.kind == "person":
        return FollowUp.person_id == friend.person.id
    return FollowUp.connection_id == friend.connection.id


def open_follow_ups(db: Session, user: User, friend: Friend) -> list[FollowUpOut]:
    """Things the user still wants to ask this friend about, oldest first. Owner-only."""
    rows = db.scalars(
        select(FollowUp)
        .where(FollowUp.owner_user_id == user.id, _follow_up_target(friend), FollowUp.done_at.is_(None))
        .order_by(FollowUp.created_at, FollowUp.id)
    ).all()
    return [_follow_up_out(r) for r in rows]


def _add_follow_up(db: Session, user: User, friend: Friend, text: str) -> FollowUp:
    clean = people_service.clean_line(text, MAX_FOLLOW_UP_LEN)
    if not clean:
        raise InvalidRequest("A follow-up needs some text.")
    people_service.reject_sensitive(clean)
    if len(open_follow_ups(db, user, friend)) >= MAX_OPEN_FOLLOW_UPS:
        raise InvalidRequest(f"Up to {MAX_OPEN_FOLLOW_UPS} open follow-ups per friend. Tick some off first.")
    row = FollowUp(
        owner_user_id=user.id,
        connection_id=friend.connection.id if friend.kind == "connection" else None,
        person_id=friend.person.id if friend.kind == "person" else None,
        text=clean,
    )
    db.add(row)
    db.flush()
    return row


def add_follow_up(
    db: Session, user: User, connection_id: str | None = None, person_id: str | None = None, text: str = ""
) -> FollowUpOut:
    friend = resolve(db, user, connection_id, person_id)
    return _follow_up_out(_add_follow_up(db, user, friend, text))


def _own_follow_up(db: Session, user: User, follow_up_id: str) -> FollowUp:
    try:
        fid = uuid.UUID(str(follow_up_id))
    except (ValueError, TypeError):
        raise NotFound("follow-up not found") from None
    row = db.scalar(select(FollowUp).where(FollowUp.id == fid, FollowUp.owner_user_id == user.id))
    if row is None:
        raise NotFound("follow-up not found")
    return row


def complete_follow_up(db: Session, user: User, follow_up_id: str) -> CompleteFollowUpOut:
    """Tick a follow-up off. Idempotent."""
    row = _own_follow_up(db, user, follow_up_id)
    if row.done_at is None:
        row.done_at = utcnow()
        db.flush()
    return CompleteFollowUpOut(done=True, follow_up_id=str(row.id))


# --------------------------------------------------------- before / after a meetup
def _starters(friend: Friend, shared: list[str]) -> list[str]:
    out: list[str] = []
    if friend.last_activity:
        out.append(f"Last time was “{friend.last_activity}” — want to do that again?")
    out += [f"We're both into {term} — anything new there?" for term in shared[:2]]
    shared_set = set(shared)
    for label in friend.interest_labels:
        if len(out) >= 4:
            break
        if not (terms_of(label) & shared_set):
            out.append(f"Still into {label}? What's new with that?")
    if len(out) < 2:
        out.append("What's been the best part of your month?")
    return out[:4]


def meetup_brief(db: Session, user: User, connection_id: str | None = None, person_id: str | None = None) -> BriefView:
    """Everything worth remembering before seeing a friend. Shown only to the user."""
    friend = resolve(db, user, connection_id, person_id)
    shared = shared_terms(my_terms(db, user), friend)
    analytics.track(db, "meetup_brief", user.id)
    return BriefView(
        kind=friend.kind,
        id=friend.id,
        display_name=friend.display_name,
        on_venn=friend.kind == "connection",
        relationship=friend.person.relationship if friend.person else None,
        notes=friend.person.notes if friend.person else None,
        last_interaction_at=friend.last_interaction_at,
        last_activity=friend.last_activity,
        days_since_last_interaction=days_since(friend) if friend.last_interaction_at else None,
        interests=friend.interest_labels,
        shared_interests=shared,
        shared_memories=_shared_memories(friend),
        things_to_ask=open_follow_ups(db, user, friend),
        conversation_starters=_starters(friend, shared),
    )


def recap_meetup(
    db: Session,
    user: User,
    connection_id: str | None = None,
    person_id: str | None = None,
    activity: str | None = None,
    follow_ups: list[str] | None = None,
    notes_to_add: str | None = None,
    new_interests: list[str] | None = None,
    done_follow_up_ids: list[str] | None = None,
) -> RecapOut:
    """Log a meetup and what to remember from it, in one step.

    Private notes and interests exist only for people who are not on Venn; for a connection
    `notes_to_add` and `new_interests` are ignored and `notes_updated` is False.
    """
    friend = resolve(db, user, connection_id, person_id)
    logged = log_interaction(db, user, connection_id, person_id, activity)

    target_ids = {f.follow_up_id for f in open_follow_ups(db, user, friend)}
    for fid in done_follow_up_ids or []:
        row = _own_follow_up(db, user, fid)
        if str(row.id) not in target_ids and row.done_at is None:
            raise NotFound("follow-up not found")  # belongs to a different friend
        complete_follow_up(db, user, fid)
    for text in follow_ups or []:
        _add_follow_up(db, user, friend, text)

    notes_updated = False
    if friend.person is not None:
        person = friend.person
        addition = (notes_to_add or "").strip()
        if addition:
            people_service.reject_sensitive(addition)
            combined = f"{person.notes}\n{addition}" if person.notes else addition
            if len(combined) > people_service.MAX_NOTES_LEN:
                raise InvalidRequest(
                    f"The note for {person.name} would exceed {people_service.MAX_NOTES_LEN} characters. "
                    "Nothing was recorded; shorten the addition or edit the note first."
                )
            person.notes = combined
            notes_updated = True
        if new_interests:
            people_service.reject_sensitive(*new_interests)
            merged = people_service.clean_interests([*(person.interests or []), *new_interests])
            if merged != list(person.interests or []):
                person.interests = merged
                notes_updated = True
        db.flush()
    analytics.track(db, "meetup_recapped", user.id)
    return RecapOut(
        recorded=True,
        kind=friend.kind,
        id=friend.id,
        last_interaction_at=logged.last_interaction_at,
        follow_ups=open_follow_ups(db, user, friend),
        notes_updated=notes_updated,
    )


# ------------------------------------------------------------------ find people
def _stem(word: str) -> str:
    """Tiny deterministic stemmer so "climbing", "climber" and "climbs" all match "climb"."""
    for suffix in ("ing", "ers", "er", "ed", "es", "s", "e"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            word = word[: -len(suffix)]
            break
    if len(word) > 3 and word[-1] == word[-2] and word[-1] not in "aeiou":
        word = word[:-1]
    return word


def _stems(text: str | None) -> set[str]:
    return {_stem(w) for w in _WORD.findall((text or "").lower())}


def _matches(query_stem: str, stems: set[str]) -> bool:
    if query_stem in stems:
        return True
    # "photo" finds "photography"; short stems must match exactly so "art" doesn't find "party".
    if len(query_stem) >= 4 and any(s.startswith(query_stem) for s in stems):
        return True
    # ...and "photography" finds "photo walks".
    return any(len(s) >= 5 and query_stem.startswith(s) for s in stems)


def _snippet(text: str, query_stems: list[str], width: int = 140) -> str:
    """The part of `text` around the first matching word."""
    flat = " ".join(text.split())
    if len(flat) <= width:
        return flat
    hit = next((m.start() for m in _WORD.finditer(flat.lower()) if _matches_any(_stem(m.group()), query_stems)), 0)
    start = max(0, hit - width // 3)
    end = min(len(flat), start + width)
    return ("…" if start else "") + flat[start:end].strip() + ("…" if end < len(flat) else "")


def _matches_any(word_stem: str, query_stems: list[str]) -> bool:
    return any(_matches(q, {word_stem}) for q in query_stems)


def _searchable(friend: Friend) -> list[tuple[int, str, str, str | None, str]]:
    """(weight, text, label shown as "matched", text to quote, origin) for everything searchable about a friend.

    The user's own memories about the friend come first, so they win a tie when explaining a match.
    """
    fields: list[tuple[int, str, str, str | None, str]] = []
    for m in friend.about:
        fields.append((3, m.title, m.title, m.description, "own_memory"))
        fields += [(3, tag, m.title, m.description, "own_memory") for tag in m.tags or []]
        fields.append((2, m.description, m.title, m.description, "own_memory"))
    fields.append((3, friend.display_name, "name", None, "name"))
    if friend.person is not None:
        person = friend.person
        fields += [(3, label, label, None, "interest") for label in person.interests or []]
        if person.relationship:
            fields.append((2, person.relationship, person.relationship, None, "relationship"))
        if person.notes:
            fields.append((1, person.notes, "notes", person.notes, "notes"))
        return fields
    for m in friend.memories:
        fields.append((3, m.title, m.title, m.description, "shared"))
        fields += [(2, tag, m.title, m.description, "shared") for tag in m.tags or []]
        fields.append((1, m.description, m.title, m.description, "shared"))
    profile = friend.friend_user.profile if friend.friend_user else None
    if profile and profile.bio and profile.visibility in ("CONNECTIONS", "PUBLIC"):
        fields.append((1, profile.bio, "bio", profile.bio, "bio"))
    return fields


_NAME_TITLES = {"aunt", "auntie", "uncle", "grandma", "grandpa", "dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms."}


def first_name(name: str) -> str:
    """What to call someone in a sentence: "Maya Chen" → "Maya", but "Aunt Yuna" stays whole."""
    parts = name.split()
    if not parts:
        return name
    return name.strip() if parts[0].lower() in _NAME_TITLES else parts[0]


def _why(friend: Friend, origin: str, label: str, snippet: str | None) -> str:
    """One plain sentence saying why this person came up."""
    first = first_name(friend.display_name)
    if origin == "own_memory":
        return f"From your memory “{label}”."
    if origin == "interest":
        return f"Your notes list “{label}”."
    if origin == "relationship":
        return f"Your notes describe {first} as “{label}”."
    if origin == "notes":
        return f"From your notes: “{snippet}”" if snippet else "Your notes mention it."
    if origin == "shared":
        return f"{first} shared “{label}”."
    if origin == "bio":
        return f"{first}'s profile mentions it."
    return "The name matches."


def _matching_memories(mine: list[Memory], query_stems: list[str], limit: int = 5) -> list[Memory]:
    """The user's own memories that match the query, best first."""
    scored: list[tuple[int, Memory]] = []
    for m in mine:
        fields = [(3, m.title), *((2, tag) for tag in m.tags or []), *((2, n) for n in m.people or [])]
        fields.append((1, m.description))
        stems = [(weight, _stems(text)) for weight, text in fields]
        score = sum(max((w for w, st in stems if _matches(q, st)), default=0) for q in query_stems)
        if score:
            scored.append((score, m))
    scored.sort(key=lambda pair: pair[0], reverse=True)  # stable: newest first within a score
    return [m for _, m in scored[:limit]]


def find_people(db: Session, user: User, query: str, limit: int = 8) -> PeopleSearchView:
    """Who in the user's circle matches a topic ("climbing", "works in design")?

    Searches the user's saved memories about their friends, their private person notes and,
    for connections, only what they chose to share. Every result says why it came up.
    """
    clean_query = " ".join((query or "").split())[:120]
    words = [w for w in _WORD.findall(clean_query.lower()) if len(w) > 1 and w not in _QUERY_STOPWORDS]
    query_stems = list(dict.fromkeys(_stem(w) for w in words))[:8]
    if not query_stems:
        raise InvalidRequest("Say what to look for, e.g. 'climbing' or 'works in design'.")

    friends = all_friends(db, user)
    ranked: list[tuple[int, int, PeopleSearchResult]] = []
    for friend in friends:
        fields = [
            (weight, _stems(text), label, quote, origin) for weight, text, label, quote, origin in _searchable(friend)
        ]
        score = 0
        hits = 0
        matched: list[str] = []
        snippet: str | None = None
        reason: tuple[int, str, str, str | None] | None = None  # weight, origin, label, quote
        for q in query_stems:
            best = 0
            for weight, stems, label, quote, origin in fields:
                if not _matches(q, stems):
                    continue
                best = max(best, weight)
                if label != "name" and label not in matched:
                    matched.append(label)
                if snippet is None and quote:
                    snippet = _snippet(quote, query_stems)
                if reason is None or weight > reason[0]:
                    reason = (weight, origin, label, quote)
            score += best
            hits += 1 if best else 0
        if not hits or reason is None:
            continue
        _, origin, label, quote = reason
        ranked.append(
            (
                hits,
                score,
                PeopleSearchResult(
                    kind=friend.kind,
                    id=friend.id,
                    display_name=friend.display_name,
                    on_venn=friend.kind == "connection",
                    relationship=friend.person.relationship if friend.person else None,
                    matched=matched[:5],
                    snippet=snippet,
                    last_interaction_at=friend.last_interaction_at,
                    why=_why(friend, origin, label, _snippet(quote, query_stems, width=100) if quote else None),
                ),
            )
        )
    ranked.sort(key=lambda r: (-r[0], -r[1], r[2].display_name.lower()))
    results = [r[2] for r in ranked[: min(max(limit, 1), 20)]]
    memories = [memory_service.to_out(m) for m in _matching_memories(own_memories(db, user), query_stems)]
    analytics.track(db, "people_searched", user.id, count=len(results))
    return PeopleSearchView(
        query=clean_query, results=results, count=len(results), searched=len(friends), memories=memories
    )


# ------------------------------------------------------------------- group plan
def plan_group(
    db: Session, user: User, connection_ids: list[str] | None = None, person_ids: list[str] | None = None
) -> GroupPlanView:
    """What a small group has in common, and what they could do together."""
    refs = [(cid, None) for cid in dict.fromkeys(connection_ids or [])]
    refs += [(None, pid) for pid in dict.fromkeys(person_ids or [])]
    if not MIN_GROUP <= len(refs) <= MAX_GROUP:
        raise InvalidRequest(f"Pick {MIN_GROUP} to {MAX_GROUP} friends for a group plan.")
    members = [resolve(db, user, cid, pid) for cid, pid in refs]

    holders: dict[str, list[str]] = {}
    for name, terms in [("You", my_terms(db, user)), *((m.display_name, m.terms) for m in members)]:
        for term in terms:
            holders.setdefault(term, []).append(name)
    everyone = len(members) + 1
    common_to_all = compact({t for t, names in holders.items() if len(names) == everyone})
    some_terms = {t for t, names in holders.items() if 2 <= len(names) < everyone}
    partial = sorted(compact(some_terms), key=lambda t: (-len(holders[t]), t))[:8]

    suggestions = [
        ActivitySuggestion(
            title=title,
            description=description,
            grounded_in=grounded,
            suggested_action=_NO_CONTACT if grounded else "Start a group chat yourself and float a date.",
        )
        for title, description, grounded in _ideas_from([common_to_all, partial], _GROUP_IDEAS)
    ]
    analytics.track(db, "group_planned", user.id, count=len(members))
    return GroupPlanView(
        members=[
            GroupMember(kind=m.kind, id=m.id, display_name=m.display_name, interests=m.interest_labels) for m in members
        ],
        common_to_all=common_to_all,
        common_to_some=[PartialOverlap(interest=t, members=holders[t]) for t in partial],
        suggestions=suggestions,
    )


# -------------------------------------------------------------------- venn card
MAX_VENN_ITEMS = 8


def _pretty(term: str, labels: list[str]) -> str:
    """Show a shared term the way the user (or the friend) wrote it, when one of them did."""
    for label in labels:
        if " ".join(_WORD.findall(label.lower())) == term:
            return label
    return term[:1].upper() + term[1:]


def _own_labels(mine: list[Memory]) -> list[tuple[str, set[str]]]:
    """(label, terms) of what the user is into, interests first."""
    rows = sorted(
        (m for m in mine if m.category in _INTEREST_CATEGORIES and not m.people),
        key=lambda m: m.category != "INTEREST",
    )
    return [(m.title, terms_of(_topic(m), *(m.tags or []))) for m in rows]


def compare(db: Session, user: User, connection_id: str | None = None, person_id: str | None = None) -> VennView:
    """The Venn card: what only the user is into, what only the friend is into, and the overlap."""
    friend = resolve(db, user, connection_id, person_id)
    mine = own_memories(db, user)
    my = _memory_terms(mine)
    shared = shared_terms(my, friend)
    shared_set = set(shared) | (my & friend.terms)

    own = _own_labels(mine)
    their_labels = list(friend.interest_labels)
    if friend.kind == "connection":
        their_labels += [m.title for m in friend.memories if m.category in ("PREFERENCE", "EXPERIENCE")]
    you_only = [label for label, terms in own if not terms & friend.terms]
    them_only = [label for label in dict.fromkeys(their_labels) if not terms_of(label) & (my | shared_set)]

    first = first_name(friend.display_name)
    if shared:
        things = "1 thing" if len(shared) == 1 else f"{len(shared)} things"
        summary = f"You and {first} have {things} in common."
    elif them_only or you_only:
        summary = f"Nothing in common on record yet. Add what you know about {first} to find the overlap."
    else:
        summary = f"Nothing saved about you or {first} yet."

    suggestions = [
        ActivitySuggestion(title=title, description=description, grounded_in=grounded, suggested_action=_NO_CONTACT)
        for title, description, grounded in ideas_for(shared, friend)
        if grounded
    ][:2]
    all_labels = [label for label, _ in own] + their_labels
    analytics.track(db, "venn_compared", user.id, count=len(shared))
    return VennView(
        kind=friend.kind,
        id=friend.id,
        display_name=friend.display_name,
        on_venn=friend.kind == "connection",
        you_only=you_only[:MAX_VENN_ITEMS],
        shared=[_pretty(term, all_labels) for term in shared[:MAX_VENN_ITEMS]],
        them_only=them_only[:MAX_VENN_ITEMS],
        summary=summary,
        suggestions=suggestions,
    )


# ----------------------------------------------------------------- friend list
def _open_follow_up_rows(db: Session, user: User) -> list[FollowUp]:
    return list(
        db.scalars(
            select(FollowUp)
            .where(FollowUp.owner_user_id == user.id, FollowUp.done_at.is_(None))
            .order_by(FollowUp.created_at, FollowUp.id)
        ).all()
    )


def _follow_up_key(row: FollowUp) -> tuple[str, str]:
    return ("person", str(row.person_id)) if row.person_id else ("connection", str(row.connection_id))


def list_friends(db: Session, user: User) -> FriendListOut:
    """Everyone in the user's circle in one list: connections and private notes, by name."""
    counts: dict[tuple[str, str], int] = {}
    for row in _open_follow_up_rows(db, user):
        counts[_follow_up_key(row)] = counts.get(_follow_up_key(row), 0) + 1
    friends = [
        FriendSummary(
            kind=f.kind,
            id=f.id,
            display_name=f.display_name,
            on_venn=f.kind == "connection",
            relationship=f.person.relationship if f.person else None,
            interests=f.interest_labels,
            last_interaction_at=f.last_interaction_at,
            since=f.since,
            is_sample=f.is_sample,
            open_follow_ups=counts.get((f.kind, f.id), 0),
        )
        for f in all_friends(db, user)
    ]
    friends.sort(key=lambda f: f.display_name.lower())
    return FriendListOut(friends=friends, count=len(friends))


def list_open_follow_ups(db: Session, user: User) -> FollowUpListOut:
    """Every open follow-up across the circle, oldest first, with the friend it is about."""
    by_key = {(f.kind, f.id): f for f in all_friends(db, user)}
    out: list[OpenFollowUpOut] = []
    for row in _open_follow_up_rows(db, user):
        friend = by_key.get(_follow_up_key(row))
        if friend is None:
            continue  # e.g. a blocked connection
        out.append(
            OpenFollowUpOut(
                follow_up_id=str(row.id),
                text=row.text,
                created_at=as_aware(row.created_at),
                kind=friend.kind,
                id=friend.id,
                display_name=friend.display_name,
            )
        )
    return FollowUpListOut(follow_ups=out, count=len(out))


# -------------------------------------------------------------------- this week
THIS_WEEK_MIN_DAYS = 14


def _reach_out_draft(friend: Friend, shared: list[str]) -> str:
    first = first_name(friend.display_name)
    if shared:
        hook = f"I was just thinking about {shared[0]} and it made me think of you."
    elif friend.last_activity:
        hook = f"I was thinking about last time (“{friend.last_activity}”)."
    elif friend.interest_labels:
        hook = f"How is the {friend.interest_labels[0].lower()} going?"
    else:
        hook = "How have you been?"
    return f"Hi {first}, it's been too long! {hook} Want to catch up this week?"


def this_week(db: Session, user: User) -> ThisWeekView:
    """Up to three concrete things to do this week: reach out, follow up, plan something."""
    friends = all_friends(db, user)
    if not friends:
        return ThisWeekView(
            actions=[], empty_reason="Add a few people first, then Venn can suggest who to reach out to."
        )
    mine = my_terms(db, user)
    by_key = {(f.kind, f.id): f for f in friends}
    actions: list[ThisWeekAction] = []
    used: set[tuple[str, str]] = set()

    def ref(friend: Friend) -> dict:
        return {"kind": friend.kind, "id": friend.id, "display_name": friend.display_name}

    # 1. Reach out: whoever the user has not seen for the longest time.
    overdue = sorted((f for f in friends if days_since(f) >= THIS_WEEK_MIN_DAYS), key=days_since, reverse=True)
    if overdue:
        friend = overdue[0]
        days = days_since(friend)
        first = first_name(friend.display_name)
        reason = (
            f"No logged hangout in {days} days."
            if friend.last_interaction_at
            else f"No hangout logged since you added {first} {days} days ago."
        )
        actions.append(
            ThisWeekAction(
                type="reach_out",
                title=f"Reach out to {first}",
                reason=reason,
                draft_message=_reach_out_draft(friend, shared_terms(mine, friend)),
                **ref(friend),
            )
        )
        used.add((friend.kind, friend.id))

    # 2. Follow up: the oldest thing the user wanted to ask someone, preferably someone else.
    rows = [r for r in _open_follow_up_rows(db, user) if _follow_up_key(r) in by_key]
    row = next((r for r in rows if _follow_up_key(r) not in used), rows[0] if rows else None)
    if row is not None:
        friend = by_key[_follow_up_key(row)]
        actions.append(
            ThisWeekAction(
                type="follow_up",
                title=f"Follow up with {first_name(friend.display_name)}",
                reason=f"You wanted to: {row.text}",
                follow_up=_follow_up_out(row),
                **ref(friend),
            )
        )
        used.add((friend.kind, friend.id))

    # 3. Plan: the friend with the most common ground, preferably someone not mentioned yet.
    best: tuple[int, Friend, tuple[str, str, list[str]]] | None = None
    for friend in sorted(friends, key=lambda f: ((f.kind, f.id) in used, f.display_name.lower())):
        shared = shared_terms(mine, friend)
        idea = next((i for i in ideas_for(shared, friend) if i[2]), None)
        if idea is None:
            continue
        score = len(shared) * 2 + (0 if (friend.kind, friend.id) in used else 1)
        if best is None or score > best[0]:
            best = (score, friend, idea)
    if best is not None:
        _, friend, (title, description, grounded) = best
        first = first_name(friend.display_name)
        shared = shared_terms(mine, friend)
        reason = f"You're both into {grounded[0]}." if grounded[0] in shared else f"{first} is into {grounded[0]}."
        actions.append(
            ThisWeekAction(
                type="plan",
                title=f"Plan something with {first}",
                reason=reason,
                suggestion=ActivitySuggestion(
                    title=title, description=description, grounded_in=grounded, suggested_action=_NO_CONTACT
                ),
                **ref(friend),
            )
        )

    analytics.track(db, "this_week", user.id, count=len(actions))
    empty = None if actions else "Nothing needs your attention this week. You're all caught up."
    return ThisWeekView(actions=actions, empty_reason=empty)
