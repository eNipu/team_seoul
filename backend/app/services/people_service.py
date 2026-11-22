"""Private notes about friends who are not on Venn.

Rules:
- Owner-only. A person note is never shared with connections or shown on a profile.
- Venn never contacts the person; notes only feed suggestions shown to the owner.
- Credentials and financial/ID numbers are refused, same as memories.
- Unknown and other users' person ids are indistinguishable (NOT_FOUND).
- Bulk imports are two-step: the assistant proposes, the user picks on a review card, and only
  the picked entries of that stored proposal are added. Contact details are stripped.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta
from hashlib import sha256
from secrets import compare_digest
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.extraction import contains_sensitive
from app.models import PeopleImport, Person, PersonInteraction, User
from app.models._base import as_aware, utcnow
from app.schemas.social import (
    DeletePersonOut,
    DemoPlatform,
    ImportCandidateOut,
    ImportPeopleOut,
    InteractionOut,
    LinkedInCandidate,
    PeopleImportView,
    PeopleListOut,
    PersonCandidate,
    PersonOut,
)
from app.services import analytics, instagram_demo, linkedin_demo
from app.services.errors import InvalidRequest, NotFound, PrivacyViolation
from app.services.interest_matching import match_interests, my_interest_labels

MAX_PEOPLE_PER_USER = 500
MAX_IMPORT_CANDIDATES = 50
MAX_DEMO_IMPORT_CANDIDATES = 100
IMPORT_TTL = timedelta(hours=24)
DemoChannel = Literal["chatgpt", "web"]
# Venn keeps notes about people, not ways to reach them.
_CONTACT_DETAIL = re.compile(
    r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"  # email addresses
    r"|https?://\S+|www\.\S+"  # links (profile URLs)
    r"|\+?\d[\d\s().-]{7,}\d"  # phone-number-like runs; see _drop_contact_detail
)
MAX_INTERESTS = 12
MAX_INTEREST_LEN = 40
MAX_NOTES_LEN = 1000


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        raise NotFound("person not found") from None


def clean_line(value: str | None, limit: int) -> str | None:
    """Collapse whitespace; empty -> None."""
    if value is None:
        return None
    return " ".join(str(value).split())[:limit] or None


def clean_interests(interests: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in interests or []:
        label = clean_line(raw, MAX_INTEREST_LEN)
        if label and label.lower() not in seen:
            seen.add(label.lower())
            out.append(label)
    return out[:MAX_INTERESTS]


def reject_sensitive(*values: str | None) -> None:
    if any(v and contains_sensitive(v) for v in values):
        raise PrivacyViolation("Venn does not store credentials or financial/ID numbers.")


def strip_contact_details(text: str | None) -> str | None:
    """Remove email addresses, links and phone numbers (used for bulk imports)."""
    if not text:
        return None
    return " ".join(_CONTACT_DETAIL.sub(_drop_contact_detail, text).split()).strip(" ,;:-") or None


def _drop_contact_detail(match: re.Match[str]) -> str:
    found = match.group()
    if "@" in found or found.lower().startswith(("http", "www.")):
        return " "
    # Keep year ranges like "2019 - 2021"; a phone number has more digits than that.
    return " " if sum(ch.isdigit() for ch in found) >= 9 else found


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
        is_sample=bool(person.is_sample),
    )


def lock_people_writes(db: Session, user: User) -> None:
    """Serialize count and duplicate checks for people writes in PostgreSQL."""
    db.scalar(select(User.id).where(User.id == user.id).with_for_update(key_share=True))


def add_person(
    db: Session,
    user: User,
    name: str,
    relationship: str | None = None,
    notes: str | None = None,
    interests: list[str] | None = None,
    last_met_days_ago: int | None = None,
) -> PersonOut:
    clean_name = clean_line(name, 80)
    if not clean_name:
        raise InvalidRequest("A name is required.")
    notes_clean = (notes or "").strip()[:MAX_NOTES_LEN] or None
    reject_sensitive(clean_name, relationship, notes_clean, *(interests or []))
    lock_people_writes(db, user)
    count = db.scalar(select(func.count()).select_from(Person).where(Person.owner_user_id == user.id)) or 0
    if count >= MAX_PEOPLE_PER_USER:
        raise InvalidRequest(f"You can keep notes on up to {MAX_PEOPLE_PER_USER} people.")
    person = Person(
        owner_user_id=user.id,
        name=clean_name,
        relationship=clean_line(relationship, 80),
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
    reject_sensitive(name, relationship, notes, *(interests or []))
    if name is not None:
        clean_name = clean_line(name, 80)
        if not clean_name:
            raise InvalidRequest("A name is required.")
        person.name = clean_name
    if relationship is not None:
        person.relationship = clean_line(relationship, 80)
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
    db.add(PersonInteraction(person_id=person.id, activity=clean_line(activity, 120), created_at=now))
    db.flush()
    return now


# ---------------------------------------------------------------------- imports
def existing_names(db: Session, user: User, *, include_samples: bool = False) -> set[str]:
    query = select(Person.name).where(Person.owner_user_id == user.id)
    if not include_samples:
        query = query.where(Person.is_sample.is_(False))
    return {name.lower() for name in db.scalars(query)}


def _is_sample_import(items: list[dict]) -> bool:
    return bool(items and items[0].get("is_sample"))


def _clear_demo_previews(db: Session, user: User, *, expired_only: bool) -> None:
    query = select(PeopleImport).where(
        PeopleImport.user_id == user.id, PeopleImport.source.in_((instagram_demo.SOURCE, linkedin_demo.SOURCE))
    )
    if expired_only:
        query = query.where(PeopleImport.expires_at < utcnow())
    for row in db.scalars(query):
        if _is_sample_import(row.items):
            db.delete(row)


def clear_demo_previews(db: Session, user: User) -> None:
    _clear_demo_previews(db, user, expired_only=False)


def propose_import(
    db: Session, user: User, people: list[PersonCandidate], source: str | None = None, *, match_interests: bool = False
) -> PeopleImportView:
    """Store a list of people for the user to review. Adds nothing to their notes yet."""
    return _propose_import(db, user, people[:MAX_IMPORT_CANDIDATES], source, read_interests=match_interests)


def propose_demo_import(
    db: Session,
    user: User,
    platform: DemoPlatform,
    *,
    channel: DemoChannel,
    match_interests: bool = False,
    confirmation_token: str | None = None,
) -> PeopleImportView:
    lock_people_writes(db, user)
    _clear_demo_previews(db, user, expired_only=True)
    fixture = instagram_demo if platform == "instagram" else linkedin_demo
    return _propose_import(
        db,
        user,
        fixture.candidates()[:MAX_DEMO_IMPORT_CANDIDATES],
        fixture.SOURCE,
        demo_platform=platform,
        demo_channel=channel,
        read_interests=match_interests,
        confirmation_token=confirmation_token,
    )


def _propose_import(
    db: Session,
    user: User,
    people: list[PersonCandidate],
    source: str | None,
    *,
    read_interests: bool = False,
    demo_platform: DemoPlatform | None = None,
    demo_channel: DemoChannel | None = None,
    confirmation_token: str | None = None,
) -> PeopleImportView:
    is_sample = demo_platform is not None
    existing: dict[str, list[str]] = {}
    query = select(Person.name, Person.relationship).where(Person.owner_user_id == user.id)
    if not is_sample:
        query = query.where(Person.is_sample.is_(False))
    for name, relationship in db.execute(query.order_by(Person.id)):
        clues = existing.setdefault(name.casefold(), [])
        clue = strip_contact_details(relationship)
        if clue and clue not in clues:
            clues.append(clue)
    items: list[dict] = []
    seen: set[tuple[str, str, str, tuple[str, ...], int | None]] = set()
    skipped = 0
    for candidate in people:
        raw = (candidate.name, candidate.relationship, candidate.notes, *candidate.interests)
        if any(v and contains_sensitive(v) for v in raw):
            skipped += 1
            continue
        name = clean_line(strip_contact_details(candidate.name), 80)
        relationship = clean_line(strip_contact_details(candidate.relationship), 80)
        notes = (strip_contact_details(candidate.notes) or "")[:MAX_NOTES_LEN] or None
        interests = clean_interests([i for i in map(strip_contact_details, candidate.interests) if i])
        if not name:
            continue
        key = (
            name.casefold(),
            (relationship or "").casefold(),
            (notes or "").casefold(),
            tuple(sorted(interest.casefold() for interest in interests)),
            candidate.last_met_days_ago,
        )
        if key in seen:
            continue
        seen.add(key)
        items.append(
            {
                "name": name,
                "relationship": relationship,
                "notes": notes,
                "interests": interests,
                "last_met_days_ago": candidate.last_met_days_ago,
                # Only the server-owned demo proposal sets this; source is untrusted.
                "is_sample": is_sample,
                "demo_channel": demo_channel,
                "import_platform": demo_platform or ("linkedin" if isinstance(candidate, LinkedInCandidate) else None),
            }
        )
    if not items:
        raise InvalidRequest("No people to import. Ask the user who they'd like to add.")
    if demo_channel == "chatgpt" and confirmation_token:
        # The proposal, not the tool caller, controls which widget can confirm it.
        items[0]["confirmation_digest"] = sha256(confirmation_token.encode()).hexdigest()
    row = PeopleImport(
        user_id=user.id,
        items=items,
        source=clean_line(source, 60),
        expires_at=utcnow() + IMPORT_TTL,
    )
    db.add(row)
    db.flush()
    mine = my_interest_labels(db, user) if read_interests else []
    candidates = []
    for i, item in enumerate(items):
        matches = match_interests(mine, item["interests"]) if mine else []
        candidates.append(
            ImportCandidateOut(
                index=i,
                interest_matches=matches,
                shared_interests=[m.their_label for m in matches if m.kind == "exact"],
                already_added=item["name"].casefold() in existing,
                existing_relationships=existing.get(item["name"].casefold(), []),
                **item,
            )
        )
    return PeopleImportView(
        import_id=str(row.id),
        expires_at=as_aware(row.expires_at),
        source=row.source,
        candidates=candidates,
        skipped=skipped,
        demo_platform=demo_platform,
    )


def import_people(
    db: Session,
    user: User,
    import_id: str,
    indexes: list[int],
    *,
    channel: Literal["regular"] | DemoChannel = "regular",
    confirmation_token: str | None = None,
) -> ImportPeopleOut:
    """Add the entries the user picked from an import they were shown. Single-use."""
    try:
        iid = uuid.UUID(str(import_id))
    except (ValueError, TypeError):
        raise NotFound("import not found") from None
    lock_people_writes(db, user)
    row = db.scalar(select(PeopleImport).where(PeopleImport.id == iid, PeopleImport.user_id == user.id))
    if row is None:
        raise NotFound("import not found")
    if row.consumed_at is not None:
        raise InvalidRequest("This import was already used. Propose a new one.")
    if as_aware(row.expires_at) < utcnow():
        raise InvalidRequest("This import expired. Propose a new one.")
    items = list(row.items or [])
    is_sample = _is_sample_import(items)
    if is_sample:
        # Older website demo proposals predate channel metadata.
        demo_channel = items[0].get("demo_channel", "web")
        if demo_channel != channel:
            raise InvalidRequest("Use the Add button on the matching import review card.")
        if channel == "chatgpt":
            digest = items[0].get("confirmation_digest")
            if (
                not digest
                or not confirmation_token
                or not compare_digest(digest, sha256(confirmation_token.encode()).hexdigest())
            ):
                raise InvalidRequest("Open a fresh import review and use its Add button to confirm your selection.")
    elif channel == "chatgpt":
        raise InvalidRequest("Use the Add button on the matching import review card.")
    limit = MAX_DEMO_IMPORT_CANDIDATES if is_sample else MAX_IMPORT_CANDIDATES
    if len(indexes) > limit:
        raise InvalidRequest(f"You can import up to {limit} people at a time.")
    picked = list(dict.fromkeys(indexes))
    if not picked:
        raise InvalidRequest("Pick at least one person to add.")
    if any(not isinstance(i, int) or i < 0 or i >= len(items) for i in picked):
        raise InvalidRequest("Unknown entry in this import.")
    if is_sample:
        # A demo proposal can outlive another import (or a new real note with the same name).
        existing = existing_names(db, user, include_samples=True)
        picked = [i for i in picked if items[i]["name"].lower() not in existing]
    count = db.scalar(select(func.count()).select_from(Person).where(Person.owner_user_id == user.id)) or 0
    if count + len(picked) > MAX_PEOPLE_PER_USER:
        raise InvalidRequest(f"You can keep notes on up to {MAX_PEOPLE_PER_USER} people.")

    now = utcnow()
    added: list[Person] = []
    for i in picked:
        item = items[i]
        person = Person(
            owner_user_id=user.id,
            name=item["name"],
            relationship=item.get("relationship"),
            notes=item.get("notes"),
            interests=list(item.get("interests") or []),
            is_sample=is_sample,
            import_platform=item.get("import_platform"),
        )
        db.add(person)
        db.flush()
        days = item.get("last_met_days_ago")
        if days is not None:
            db.add(PersonInteraction(person_id=person.id, activity=None, created_at=now - timedelta(days=days)))
        added.append(person)
    row.consumed_at = now
    row.items = []  # the unpicked entries are not kept
    db.flush()
    analytics.track(db, "people_imported", user.id, count=len(added))
    return ImportPeopleOut(imported=[to_out(db, p) for p in added], count=len(added))
