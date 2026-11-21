"""Memory lifecycle: propose -> user review -> save. Users can list, edit and delete their memories.

Persisting memories requires a server-held proposal owned by the caller. A model claiming
"the user approved" is not sufficient: approvals must reference a live, unconsumed proposal,
and the widget/ChatGPT confirmation flow is where the user actually picks items.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.extraction import contains_sensitive, extract_candidates, mentioned_people, sanitize_candidates
from app.models import Memory, MemoryProposal, Person, User
from app.models._base import as_aware, utcnow
from app.schemas.memory import (
    DeleteMemoryOut,
    ImportArea,
    MemoryApproval,
    MemoryCandidate,
    MemoryCategory,
    MemoryImportView,
    MemoryListOut,
    MemoryOut,
    MemoryProposalOut,
    MemorySource,
    MemoryVisibility,
    ProposedMemory,
    SaveMemoriesOut,
    clean_names,
)
from app.services import analytics, people_service, social_service
from app.services.errors import InvalidRequest, NotFound, PrivacyViolation

PROPOSAL_TTL = timedelta(hours=24)
MAX_MEMORIES_PER_USER = 500
MAX_PROPOSED = 8
# An import brings over what ChatGPT already remembered, so one card may hold more.
MAX_IMPORT_ITEMS = 30
CHATGPT_MEMORY = "chatgpt_memory"
SAMPLE = "sample"
_SOURCES = {CHATGPT_MEMORY, SAMPLE}

# What the user can ask ChatGPT to look for. Sensitive areas are not offered at all.
IMPORT_AREAS: tuple[tuple[str, str, str, bool], ...] = (
    ("interests", "Interests and hobbies", "What you enjoy doing and talking about.", True),
    (
        "preferences",
        "Likes, dislikes and preferences",
        "Food, places, plans — what you go for and what you avoid.",
        True,
    ),
    ("work", "Work and projects", "What you do and what you are building.", True),
    ("goals", "Goals and plans", "What you are working towards.", True),
    ("experiences", "Experiences and places", "Trips, events and things you have done.", True),
    ("personal", "Personal life", "Family, relationships and milestones.", False),
)
IMPORT_ALWAYS_EXCLUDED = "Health, money, passwords and ID numbers are never imported."
IMPORT_NOTE = (
    "Venn cannot read ChatGPT's memory; only you can. Nothing has been imported. When the user presses "
    "the button on this card (or asks in chat), list in the chat what you already remember about them in "
    "the areas they chose — numbered, at most 30, leaving out health, money, credentials, ID numbers and "
    "anything you are not sure is about them — and do NOT call a Venn tool with those items yet. Only "
    'after the user says which ones to keep, call venn_propose_memories with source "chatgpt_memory" '
    "and just those items. If you remember nothing about the user, say so instead of guessing."
)


def _parse_uuid(value: str, what: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        raise NotFound(f"{what} not found") from None


def to_out(m: Memory) -> MemoryOut:
    return MemoryOut(
        memory_id=str(m.id),
        category=MemoryCategory(m.category),
        title=m.title,
        description=m.description,
        tags=list(m.tags or []),
        visibility=MemoryVisibility(m.visibility),
        source=m.source if m.source in _SOURCES else None,
        people=list(m.people or []),
        created_at=as_aware(m.created_at),
    )


def _title_key(title: str) -> str:
    return " ".join(title.lower().split())


# ------------------------------------------------------------ people a memory is about
def circle_names(db: Session, user: User) -> list[str]:
    """Names of everyone in the caller's circle: their private notes and their connections."""
    names = list(db.scalars(select(Person.name).where(Person.owner_user_id == user.id)))
    names += [c.display_name for c in social_service.list_connections(db, user).connections]
    return names


def same_person(name: str, full: str) -> bool:
    """ "Maya" and "Maya Chen" are taken to be the same person; "May" and "Maya" are not."""
    a, b = " ".join(name.lower().split()), " ".join(full.lower().split())
    if not a or not b:
        return False
    return a == b or a == b.split()[0] or b == a.split()[0]


def unknown_people(names: list[str], circle: list[str]) -> list[str]:
    return [n for n in names if not any(same_person(n, full) for full in circle)]


def _safe_names(names: list[str] | None) -> list[str]:
    return [n for n in clean_names(names) if not contains_sensitive(n)]


def _add_unknown_people(db: Session, user: User, names: list[str]) -> list[dict]:
    """Add a private note for each name that is not in the circle yet. Returns the notes created."""
    circle = circle_names(db, user)
    added: list[dict] = []
    for name in unknown_people(names, circle):
        try:
            person = people_service.add_person(db, user, name=name)
        except (InvalidRequest, PrivacyViolation):
            continue  # at the limit, or not a storable name: keep the memory, skip the note
        circle.append(person.name)
        added.append(person.model_dump(mode="json"))
    return added


def import_view(db: Session, user: User) -> MemoryImportView:
    """Chooser card for an import from ChatGPT's memory. Reads nothing but the caller's own count."""
    imported = (
        db.scalar(
            select(func.count()).select_from(Memory).where(Memory.user_id == user.id, Memory.source == CHATGPT_MEMORY)
        )
        or 0
    )
    return MemoryImportView(
        areas=[ImportArea(value=v, label=label, description=d, selected=on) for v, label, d, on in IMPORT_AREAS],
        always_excluded=IMPORT_ALWAYS_EXCLUDED,
        imported_count=imported,
        max_items=MAX_IMPORT_ITEMS,
        note=IMPORT_NOTE,
    )


def propose_memories(
    db: Session,
    user: User,
    text: str | None = None,
    suggested: list[MemoryCandidate] | None = None,
    source: MemorySource = "conversation",
) -> MemoryProposalOut:
    """Create a proposal from user-provided text and/or assistant-suggested candidates.

    `source` says where the candidates come from: this conversation, or ChatGPT's own memory
    of the user (an import the user asked for and already narrowed down in the chat).
    """
    from_memory = source == CHATGPT_MEMORY
    limit = MAX_IMPORT_ITEMS if from_memory else MAX_PROPOSED
    candidates: list[MemoryCandidate] = []
    origin = "assistant"
    if text and text.strip():
        extracted, origin = extract_candidates(text)
        candidates.extend(extracted)
    if suggested:
        candidates.extend(suggested)
        if not text:
            origin = "assistant"
    if from_memory:
        origin = CHATGPT_MEMORY
    candidates = sanitize_candidates(candidates, limit=limit)
    if not candidates:
        raise InvalidRequest(
            "No memory candidates found. Ask the user a question about their interests or goals first."
        )
    have = {_title_key(t) for t in db.scalars(select(Memory.title).where(Memory.user_id == user.id))}
    circle = circle_names(db, user)
    expires_at = utcnow() + PROPOSAL_TTL
    items = []
    for i, c in enumerate(candidates):
        # The assistant names who a memory is about; when it did not, pick up the obvious cases
        # ("Maya and I…"). Either way the review card shows who would be added.
        people = _safe_names(c.people or mentioned_people(f"{c.title}. {c.description}"))
        items.append(
            ProposedMemory(
                index=i,
                suggested_visibility=MemoryVisibility.PRIVATE,
                already_saved=_title_key(c.title) in have,
                new_people=unknown_people(people, circle),
                **{**c.model_dump(), "people": people},
            )
        )
    proposal = MemoryProposal(
        user_id=user.id,
        items=[i.model_dump(mode="json") for i in items],
        source=origin,
        expires_at=expires_at,
    )
    db.add(proposal)
    db.flush()
    analytics.track(db, "memory_proposed", user.id, count=len(items), source=origin)
    return MemoryProposalOut(
        proposal_id=str(proposal.id),
        expires_at=expires_at,
        source=CHATGPT_MEMORY if from_memory else "conversation",
        proposals=items,
    )


def save_memories(db: Session, user: User, proposal_id: str, approvals: list[MemoryApproval]) -> SaveMemoriesOut:
    pid = _parse_uuid(proposal_id, "proposal")
    proposal = db.scalar(
        select(MemoryProposal).where(MemoryProposal.id == pid, MemoryProposal.user_id == user.id).with_for_update()
    )
    if proposal is None:
        raise NotFound("proposal not found")
    if proposal.consumed_at is not None:
        raise InvalidRequest("This proposal was already reviewed. Create a new proposal.")
    if as_aware(proposal.expires_at) < utcnow():
        raise InvalidRequest("This proposal expired. Create a new proposal.")
    if not approvals:
        raise InvalidRequest("No items approved. Use venn_discard_memory_proposal to discard.")

    items = {int(i["index"]): i for i in proposal.items}
    seen: set[int] = set()
    existing = db.scalar(select(func.count()).select_from(Memory).where(Memory.user_id == user.id)) or 0
    if existing + len(approvals) > MAX_MEMORIES_PER_USER:
        raise InvalidRequest(f"Memory limit reached ({MAX_MEMORIES_PER_USER}). Delete some memories first.")

    now = utcnow()
    source = CHATGPT_MEMORY if proposal.source == CHATGPT_MEMORY else None
    saved: list[Memory] = []
    for a in approvals:
        if a.index in seen:
            raise InvalidRequest(f"Duplicate approval for index {a.index}")
        seen.add(a.index)
        item = items.get(a.index)
        if item is None:
            raise InvalidRequest(f"Proposal has no item {a.index}")
        title = (a.title or item["title"]).strip()
        description = (a.description or item["description"]).strip()
        if contains_sensitive(title) or contains_sensitive(description):
            raise PrivacyViolation("Venn does not store credentials or financial/ID numbers.")
        m = Memory(
            user_id=user.id,
            category=item["category"],
            title=title[:120],
            description=description[:500],
            tags=list(item.get("tags") or []),
            visibility=a.visibility.value,
            source=source,
            people=_safe_names(item.get("people")) or None,
            approved_at=now,
        )
        db.add(m)
        saved.append(m)
    proposal.consumed_at = now
    proposal.items = []  # whatever the user did not pick is dropped, not kept
    db.flush()
    # The review card said which people an approved item also adds; unapproved items add nobody.
    people_added = _add_unknown_people(db, user, [n for m in saved for n in (m.people or [])])
    analytics.track(db, "memory_approved", user.id, count=len(saved), source=source or "conversation")
    return SaveMemoriesOut(saved=[to_out(m) for m in saved], count=len(saved), people_added=people_added)


def create_memory(
    db: Session,
    user: User,
    category: MemoryCategory,
    title: str,
    description: str,
    tags: list[str] | None = None,
    visibility: MemoryVisibility = MemoryVisibility.PRIVATE,
    people: list[str] | None = None,
) -> SaveMemoriesOut:
    """Save one memory the user typed in themselves (the website's form).

    There is no proposal step because nothing is inferred: the user wrote the text and pressed save.
    The assistant has no tool for this; in ChatGPT a memory is always proposed and reviewed first.
    """
    candidate = MemoryCandidate(
        category=category, title=title.strip(), description=description.strip(), tags=tags or [], people=people or []
    )
    if contains_sensitive(candidate.title) or contains_sensitive(candidate.description):
        raise PrivacyViolation("Venn does not store credentials or financial/ID numbers.")
    existing = db.scalar(select(func.count()).select_from(Memory).where(Memory.user_id == user.id)) or 0
    if existing >= MAX_MEMORIES_PER_USER:
        raise InvalidRequest(f"Memory limit reached ({MAX_MEMORIES_PER_USER}). Delete some memories first.")
    m = Memory(
        user_id=user.id,
        category=candidate.category.value,
        title=candidate.title,
        description=candidate.description,
        tags=candidate.tags,
        visibility=visibility.value,
        people=_safe_names(candidate.people) or None,
        approved_at=utcnow(),
    )
    db.add(m)
    db.flush()
    people_added = _add_unknown_people(db, user, list(m.people or []))
    analytics.track(db, "memory_approved", user.id, count=1, source="web")
    return SaveMemoriesOut(saved=[to_out(m)], count=1, people_added=people_added)


def discard_proposal(db: Session, user: User, proposal_id: str) -> None:
    pid = _parse_uuid(proposal_id, "proposal")
    proposal = db.scalar(select(MemoryProposal).where(MemoryProposal.id == pid, MemoryProposal.user_id == user.id))
    if proposal is None:
        raise NotFound("proposal not found")
    if proposal.consumed_at is None:
        proposal.consumed_at = utcnow()
        proposal.items = []  # drop unapproved text
    db.flush()


def list_memories(db: Session, user: User, category: MemoryCategory | None = None, limit: int = 100) -> MemoryListOut:
    q = select(Memory).where(Memory.user_id == user.id)
    if category:
        q = q.where(Memory.category == category.value)
    rows = db.scalars(q.order_by(Memory.created_at.desc()).limit(min(max(limit, 1), 200))).all()
    return MemoryListOut(memories=[to_out(m) for m in rows], count=len(rows))


def search_memories(db: Session, user: User, query: str, limit: int = 10) -> MemoryListOut:
    """Keyword search over the caller's own memories, best match first.

    Every query word must appear somewhere in the memory (title, tags, category, description
    or the people it is about). Scoring favours title and tag hits over description hits.
    """
    words = [w for w in " ".join(query.lower().split())[:200].split() if len(w) > 1][:8]
    if not words:
        raise InvalidRequest("Give at least one search word of two or more characters.")
    rows = db.scalars(select(Memory).where(Memory.user_id == user.id).order_by(Memory.created_at.desc())).all()
    scored: list[tuple[int, Memory]] = []
    for m in rows:
        title = m.title.lower()
        tags = " ".join(m.tags or []).lower()
        category = m.category.lower().replace("_", " ")
        description = m.description.lower()
        people = " ".join(m.people or []).lower()
        score = 0
        for w in words:
            hit = 3 * (w in title) + 2 * (w in tags) + 2 * (w in category) + (w in description) + 2 * (w in people)
            if not hit:
                score = 0
                break
            score += hit
        if score:
            scored.append((score, m))
    scored.sort(key=lambda pair: pair[0], reverse=True)  # stable: newest first within a score
    top = [to_out(m) for _, m in scored[: min(max(limit, 1), 50)]]
    return MemoryListOut(memories=top, count=len(top))


def _owned(db: Session, user: User, memory_id: str) -> Memory:
    mid = _parse_uuid(memory_id, "memory")
    m = db.scalar(select(Memory).where(Memory.id == mid, Memory.user_id == user.id))
    if m is None:
        raise NotFound("memory not found")
    return m


def update_memory(
    db: Session,
    user: User,
    memory_id: str,
    title: str | None = None,
    description: str | None = None,
    visibility: MemoryVisibility | None = None,
) -> MemoryOut:
    m = _owned(db, user, memory_id)
    for value in (title, description):
        if value is not None and contains_sensitive(value):
            raise PrivacyViolation("Venn does not store credentials or financial/ID numbers.")
    if title is not None:
        m.title = title.strip()[:120] or m.title
    if description is not None:
        m.description = description.strip()[:500] or m.description
    if visibility is not None:
        m.visibility = visibility.value
    db.flush()
    return to_out(m)


def delete_memory(db: Session, user: User, memory_id: str) -> DeleteMemoryOut:
    m = _owned(db, user, memory_id)
    mid = str(m.id)
    db.delete(m)
    db.flush()
    analytics.track(db, "memory_deleted", user.id)
    return DeleteMemoryOut(deleted=True, memory_id=mid)


def visible_memories_of(db: Session, owner_id: uuid.UUID, *, connected: bool) -> list[Memory]:
    """Memories of `owner_id` that another user may see (never PRIVATE)."""
    allowed = ["PUBLIC_PROFILE"] + (["SHARED_WITH_CONNECTIONS"] if connected else [])
    return list(db.scalars(select(Memory).where(Memory.user_id == owner_id, Memory.visibility.in_(allowed))).all())
