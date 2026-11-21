"""Private notes about friends who are not on Heldly.

Rules:
- Owner-only. A person note is never shared with connections or shown on a profile.
- Heldly never contacts the person; notes only feed suggestions shown to the owner.
- Credentials and financial/ID numbers are refused, same as memories.
- Unknown and other users' person ids are indistinguishable (NOT_FOUND).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.extraction import contains_sensitive
from app.models import Person, PersonInteraction, User
from app.models._base import as_aware, utcnow
from app.schemas.social import DeletePersonOut, InteractionOut, PeopleListOut, PersonOut
from app.services import analytics
from app.services.errors import InvalidRequest, NotFound, PrivacyViolation

MAX_PEOPLE_PER_USER = 200
MAX_INTERESTS = 12
MAX_INTEREST_LEN = 40
MAX_NOTES_LEN = 1000


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        raise NotFound("person not found") from None


def _clean_line(value: str | None, limit: int) -> str | None:
    """Collapse whitespace; empty -> None."""
    if value is None:
        return None
    return " ".join(str(value).split())[:limit] or None


def clean_interests(interests: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in interests or []:
        label = _clean_line(raw, MAX_INTEREST_LEN)
        if label and label.lower() not in seen:
            seen.add(label.lower())
            out.append(label)
    return out[:MAX_INTERESTS]


def _reject_sensitive(*values: str | None) -> None:
    if any(v and contains_sensitive(v) for v in values):
        raise PrivacyViolation("Heldly does not store credentials or financial/ID numbers.")


def owned(db: Session, user: User, person_id: str) -> Person:
    person = db.scalar(select(Person).where(Person.id == _parse_uuid(person_id), Person.owner_user_id == user.id))
    if person is None:
        raise NotFound("person not found")
    return person


def last_interaction(db: Session, person_id: uuid.UUID) -> datetime | None:
    return as_aware(
        db.scalar(select(func.max(PersonInteraction.created_at)).where(PersonInteraction.person_id == person_id))
    )


def recent_interactions(db: Session, person_id: uuid.UUID, limit: int = 10) -> list[InteractionOut]:
    rows = db.scalars(
        select(PersonInteraction)
        .where(PersonInteraction.person_id == person_id)
        .order_by(PersonInteraction.created_at.desc())
        .limit(limit)
    ).all()
    return [InteractionOut(occurred_at=as_aware(r.created_at), activity=r.activity) for r in rows]


def to_out(db: Session, person: Person) -> PersonOut:
    return PersonOut(
        person_id=str(person.id),
        name=person.name,
        relationship=person.relationship,
        notes=person.notes,
        interests=list(person.interests or []),
        last_interaction_at=last_interaction(db, person.id),
        created_at=as_aware(person.created_at),
    )


def add_person(
    db: Session,
    user: User,
    name: str,
    relationship: str | None = None,
    notes: str | None = None,
    interests: list[str] | None = None,
    last_met_days_ago: int | None = None,
) -> PersonOut:
    clean_name = _clean_line(name, 80)
    if not clean_name:
        raise InvalidRequest("A name is required.")
    notes_clean = (notes or "").strip()[:MAX_NOTES_LEN] or None
    _reject_sensitive(clean_name, relationship, notes_clean, *(interests or []))
    count = db.scalar(select(func.count()).select_from(Person).where(Person.owner_user_id == user.id)) or 0
    if count >= MAX_PEOPLE_PER_USER:
        raise InvalidRequest(f"You can keep notes on up to {MAX_PEOPLE_PER_USER} people.")
    person = Person(
        owner_user_id=user.id,
        name=clean_name,
        relationship=_clean_line(relationship, 80),
        notes=notes_clean,
        interests=clean_interests(interests),
    )
    db.add(person)
    db.flush()
    if last_met_days_ago is not None:
        when = utcnow() - timedelta(days=min(max(last_met_days_ago, 0), 3650))
        db.add(PersonInteraction(person_id=person.id, activity=None, created_at=when))
        db.flush()
    analytics.track(db, "person_added", user.id)
    return to_out(db, person)


def update_person(
    db: Session,
    user: User,
    person_id: str,
    name: str | None = None,
    relationship: str | None = None,
    notes: str | None = None,
    interests: list[str] | None = None,
) -> PersonOut:
    """Partial update. Empty strings clear `relationship`/`notes`; an empty list clears interests."""
    person = owned(db, user, person_id)
    _reject_sensitive(name, relationship, notes, *(interests or []))
    if name is not None:
        clean_name = _clean_line(name, 80)
        if not clean_name:
            raise InvalidRequest("A name is required.")
        person.name = clean_name
    if relationship is not None:
        person.relationship = _clean_line(relationship, 80)
    if notes is not None:
        person.notes = notes.strip()[:MAX_NOTES_LEN] or None
    if interests is not None:
        person.interests = clean_interests(interests)
    db.flush()
    return to_out(db, person)


def delete_person(db: Session, user: User, person_id: str) -> DeletePersonOut:
    person = owned(db, user, person_id)
    pid = str(person.id)
    db.delete(person)
    db.flush()
    return DeletePersonOut(deleted=True, person_id=pid)


def list_people(db: Session, user: User) -> PeopleListOut:
    rows = db.scalars(select(Person).where(Person.owner_user_id == user.id).order_by(Person.name)).all()
    people = [to_out(db, p) for p in rows]
    return PeopleListOut(people=people, count=len(people))


def log_interaction(db: Session, person: Person, activity: str | None = None) -> datetime:
    now = utcnow()
    db.add(PersonInteraction(person_id=person.id, activity=_clean_line(activity, 120), created_at=now))
    db.flush()
    return now
