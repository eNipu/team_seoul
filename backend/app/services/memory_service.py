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

from app.ai.extraction import contains_sensitive, extract_candidates, sanitize_candidates
from app.models import Memory, MemoryProposal, User
from app.models._base import as_aware, utcnow
from app.schemas.memory import (
    DeleteMemoryOut,
    MemoryApproval,
    MemoryCandidate,
    MemoryCategory,
    MemoryListOut,
    MemoryOut,
    MemoryProposalOut,
    MemoryVisibility,
    ProposedMemory,
    SaveMemoriesOut,
)
from app.services import analytics
from app.services.errors import InvalidRequest, NotFound, PrivacyViolation

PROPOSAL_TTL = timedelta(hours=24)
MAX_MEMORIES_PER_USER = 500


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
        created_at=as_aware(m.created_at),
    )


def propose_memories(
    db: Session,
    user: User,
    text: str | None = None,
    suggested: list[MemoryCandidate] | None = None,
) -> MemoryProposalOut:
    """Create a proposal from user-provided text and/or assistant-suggested candidates."""
    candidates: list[MemoryCandidate] = []
    source = "assistant"
    if text and text.strip():
        extracted, source = extract_candidates(text)
        candidates.extend(extracted)
    if suggested:
        candidates.extend(suggested)
        if not text:
            source = "assistant"
    candidates = sanitize_candidates(candidates)
    if not candidates:
        raise InvalidRequest(
            "No memory candidates found. Ask the user a question about their interests or goals first."
        )
    expires_at = utcnow() + PROPOSAL_TTL
    items = [
        ProposedMemory(index=i, suggested_visibility=MemoryVisibility.PRIVATE, **c.model_dump())
        for i, c in enumerate(candidates)
    ]
    proposal = MemoryProposal(
        user_id=user.id,
        items=[i.model_dump(mode="json") for i in items],
        source=source,
        expires_at=expires_at,
    )
    db.add(proposal)
    db.flush()
    analytics.track(db, "memory_proposed", user.id, count=len(items), source=source)
    return MemoryProposalOut(proposal_id=str(proposal.id), expires_at=expires_at, proposals=items)


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
        raise InvalidRequest("No items approved. Use heldly_discard_memory_proposal to discard.")

    items = {int(i["index"]): i for i in proposal.items}
    seen: set[int] = set()
    existing = db.scalar(select(func.count()).select_from(Memory).where(Memory.user_id == user.id)) or 0
    if existing + len(approvals) > MAX_MEMORIES_PER_USER:
        raise InvalidRequest(f"Memory limit reached ({MAX_MEMORIES_PER_USER}). Delete some memories first.")

    now = utcnow()
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
            raise PrivacyViolation("Heldly does not store credentials or financial/ID numbers.")
        m = Memory(
            user_id=user.id,
            category=item["category"],
            title=title[:120],
            description=description[:500],
            tags=list(item.get("tags") or []),
            visibility=a.visibility.value,
            approved_at=now,
        )
        db.add(m)
        saved.append(m)
    proposal.consumed_at = now
    db.flush()
    analytics.track(db, "memory_approved", user.id, count=len(saved))
    return SaveMemoriesOut(saved=[to_out(m) for m in saved], count=len(saved))


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

    Every query word must appear somewhere in the memory (title, tags, category or
    description). Scoring favours title and tag hits over description hits.
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
        score = 0
        for w in words:
            hit = 3 * (w in title) + 2 * (w in tags) + 2 * (w in category) + (w in description)
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
            raise PrivacyViolation("Heldly does not store credentials or financial/ID numbers.")
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
