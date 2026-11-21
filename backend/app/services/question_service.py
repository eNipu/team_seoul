"""Ask-a-friend links: a friend without an account answers four short questions.

- The owner creates a link (unguessable token) and shares it themselves; Venn sends nothing.
- The friend opens a public page, agrees to share their answers with the owner, and submits.
- Answers wait for the owner's review. Only the answers the owner approves are saved, into the
  owner's private note about that person. A reviewed response is emptied.
- Answers are text typed by someone else: they are stored as data, stripped of contact details,
  and dropped when they look like credentials or ID numbers.
"""

from __future__ import annotations

import re
import secrets
import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.extraction import contains_sensitive
from app.config import get_settings
from app.models import Person, QuestionLink, QuestionResponse, User
from app.models._base import as_aware, utcnow
from app.schemas.social import (
    AnswerItem,
    AnswerLinkOut,
    AnswerResponseOut,
    AnswersView,
    AskLinkView,
    DiscardAnswersOut,
    RevokeLinkOut,
    SaveAnswersOut,
)
from app.services import analytics, people_service, social_service, user_service
from app.services import relationship_service as rel
from app.services.errors import InvalidRequest, NotFound

LINK_TTL = timedelta(days=14)
MAX_ACTIVE_LINKS = 20
MAX_RESPONSES_OPEN_LINK = 10
MAX_PENDING_RESPONSES = 50
MAX_ANSWER_LEN = 180
MAX_NAME_LEN = 80
_TOKEN = re.compile(r"^[A-Za-z0-9_-]{20,64}$")


@dataclass(frozen=True)
class Question:
    key: str
    text: str
    saves_as: str  # shown to the owner on the review card
    placeholder: str


QUESTIONS: tuple[Question, ...] = (
    Question("into", "What are you into these days?", "Interests", "e.g. bouldering, film photography"),
    Question("together", "What would you love to do together?", "Note", "e.g. a day hike, then noodles"),
    Question("treat", "What food or drink do you always say yes to?", "Note", "e.g. iced americano, tteokbokki"),
    Question("ask", "What should I ask you about next time?", "Thing to ask", "e.g. how the move went"),
)
_BY_KEY = {q.key: q for q in QUESTIONS}
QUESTION_KEYS: tuple[str, ...] = tuple(q.key for q in QUESTIONS)
_NOTE_PREFIX = {"together": "Would love to: ", "treat": "Always says yes to: "}


def link_url(token: str) -> str:
    return f"{get_settings().public_base_url.rstrip('/')}/q/{token}"


def _clean_answer(value: str | None) -> str | None:
    text = people_service.strip_contact_details(people_service.clean_line(value, MAX_ANSWER_LEN))
    if not text or contains_sensitive(text):
        return None
    return text


def _is_active(link: QuestionLink) -> bool:
    return link.revoked_at is None and as_aware(link.expires_at) > utcnow() and link.response_count < link.max_responses


def _own_links(db: Session, user: User) -> list[QuestionLink]:
    return list(
        db.scalars(
            select(QuestionLink)
            .where(QuestionLink.owner_user_id == user.id)
            .order_by(QuestionLink.created_at.desc(), QuestionLink.id)
            .limit(100)
        )
    )


# ---------------------------------------------------------------- owner: links
def create_link(db: Session, user: User, person_id: str | None = None, name: str | None = None) -> AskLinkView:
    """A link for one person (`person_id` or `name`: one answer) or an open one (up to ten answers)."""
    person = people_service.owned(db, user, person_id) if person_id else None
    for_name = person.name if person else people_service.clean_line(name, MAX_NAME_LEN)
    if for_name:
        people_service.reject_sensitive(for_name)
    if sum(1 for link in _own_links(db, user) if _is_active(link)) >= MAX_ACTIVE_LINKS:
        raise InvalidRequest(f"You have {MAX_ACTIVE_LINKS} open question links. Revoke one first.")
    link = QuestionLink(
        owner_user_id=user.id,
        token=secrets.token_urlsafe(24),
        person_id=person.id if person else None,
        for_name=for_name,
        max_responses=1 if for_name else MAX_RESPONSES_OPEN_LINK,
        expires_at=utcnow() + LINK_TTL,
    )
    db.add(link)
    db.flush()
    analytics.track(db, "question_link_created", user.id)
    url = link_url(link.token)
    greeting = f"Hi {rel.first_name(for_name)}! " if for_name else ""
    return AskLinkView(
        link_id=str(link.id),
        link=url,
        qr=social_service.qr_rows(url),
        expires_at=as_aware(link.expires_at),
        for_name=for_name,
        share_text=f"{greeting}Four quick questions so I know what you're into these days — no sign-up needed: {url}",
        questions=[q.text for q in QUESTIONS],
        max_responses=link.max_responses,
    )


def _own_link(db: Session, user: User, link_id: str) -> QuestionLink:
    try:
        lid = uuid.UUID(str(link_id))
    except (ValueError, TypeError):
        raise NotFound("link not found") from None
    link = db.scalar(select(QuestionLink).where(QuestionLink.id == lid, QuestionLink.owner_user_id == user.id))
    if link is None:
        raise NotFound("link not found")
    return link


def revoke_link(db: Session, user: User, link_id: str) -> RevokeLinkOut:
    """Stop a link from accepting answers. Answers already received stay for review. Idempotent."""
    link = _own_link(db, user, link_id)
    if link.revoked_at is None:
        link.revoked_at = utcnow()
        db.flush()
    return RevokeLinkOut(revoked=True, link_id=str(link.id))


# ------------------------------------------------------------ public: the page
@dataclass(frozen=True)
class PublicLink:
    """What the public page may show: who is asking and whom the link was made for."""

    asker: str
    for_name: str | None


def _active_link(db: Session, token: str, *, lock: bool = False) -> QuestionLink | None:
    if not _TOKEN.fullmatch(token or ""):
        return None
    query = select(QuestionLink).where(QuestionLink.token == token)
    if lock:
        query = query.with_for_update()
    link = db.scalar(query)
    return link if link is not None and _is_active(link) else None


def public_link(db: Session, token: str) -> PublicLink | None:
    """None for unknown, expired, revoked and used-up links alike."""
    link = _active_link(db, token)
    if link is None:
        return None
    owner = db.get(User, link.owner_user_id)
    if owner is None:
        return None
    return PublicLink(asker=user_service.display_name(owner), for_name=link.for_name)


def submit(db: Session, token: str, name: str | None, answers: dict[str, str | None]) -> bool:
    """Store a friend's answers for the owner's review. False when the link is not available."""
    link = _active_link(db, token, lock=True)
    if link is None:
        return False
    clean_name = people_service.strip_contact_details(people_service.clean_line(name, MAX_NAME_LEN))
    if not clean_name or contains_sensitive(clean_name):
        raise InvalidRequest("Please add your name.")
    kept = {q.key: text for q in QUESTIONS if (text := _clean_answer(answers.get(q.key)))}
    if not kept:
        raise InvalidRequest("Please answer at least one question.")
    pending = db.scalar(
        select(func.count())
        .select_from(QuestionResponse)
        .where(QuestionResponse.owner_user_id == link.owner_user_id, QuestionResponse.reviewed_at.is_(None))
    )
    if (pending or 0) >= MAX_PENDING_RESPONSES:
        return False
    db.add(QuestionResponse(link_id=link.id, owner_user_id=link.owner_user_id, name=clean_name, answers=kept))
    link.response_count += 1
    db.flush()
    analytics.track(db, "answers_received", link.owner_user_id)
    return True


# --------------------------------------------------------------- owner: review
def _pending(db: Session, user: User) -> list[QuestionResponse]:
    return list(
        db.scalars(
            select(QuestionResponse)
            .where(QuestionResponse.owner_user_id == user.id, QuestionResponse.reviewed_at.is_(None))
            .order_by(QuestionResponse.created_at, QuestionResponse.id)
        )
    )


def pending_count(db: Session, user: User) -> int:
    return len(_pending(db, user))


def _target_person(db: Session, user: User, response: QuestionResponse, name: str | None = None) -> Person | None:
    """The note these answers would go into: the person the link was made for, else a same-named one."""
    link = db.get(QuestionLink, response.link_id)
    if name is None and link is not None and link.person_id is not None:
        person = db.get(Person, link.person_id)
        if person is not None and person.owner_user_id == user.id:
            return person
    wanted = (name or response.name).strip().lower()
    people = list(db.scalars(select(Person).where(Person.owner_user_id == user.id).order_by(Person.created_at)))
    for person in people:
        if person.name.lower() == wanted:
            return person
    return None


def review(db: Session, user: User) -> AnswersView:
    responses = []
    for row in _pending(db, user):
        person = _target_person(db, user, row)
        items = [
            AnswerItem(key=q.key, question=q.text, answer=row.answers[q.key], saves_as=q.saves_as)
            for q in QUESTIONS
            if row.answers.get(q.key)
        ]
        responses.append(
            AnswerResponseOut(
                response_id=str(row.id),
                name=row.name,
                received_at=as_aware(row.created_at),
                person_id=str(person.id) if person else None,
                person_name=person.name if person else None,
                items=items,
            )
        )
    links = [
        AnswerLinkOut(
            link_id=str(link.id),
            for_name=link.for_name,
            link=link_url(link.token),
            expires_at=as_aware(link.expires_at),
            responses=link.response_count,
            active=True,
        )
        for link in _own_links(db, user)
        if _is_active(link)
    ]
    return AnswersView(responses=responses, links=links)


def _own_response(db: Session, user: User, response_id: str) -> QuestionResponse:
    try:
        rid = uuid.UUID(str(response_id))
    except (ValueError, TypeError):
        raise NotFound("answers not found") from None
    row = db.scalar(
        select(QuestionResponse).where(
            QuestionResponse.id == rid,
            QuestionResponse.owner_user_id == user.id,
            QuestionResponse.reviewed_at.is_(None),
        )
    )
    if row is None:
        raise NotFound("answers not found")
    return row


def _interest_labels(answer: str) -> list[str]:
    parts = re.split(r"[,;/\n]|\s+and\s+|\s+&\s+", answer)
    return people_service.clean_interests([p.strip(" .!") for p in parts])


def save_answers(db: Session, user: User, response_id: str, keys: list[str], name: str | None = None) -> SaveAnswersOut:
    """Save the approved answers into the owner's private note about this person, then empty the response."""
    row = _own_response(db, user, response_id)
    chosen = [k for k in dict.fromkeys(keys) if k in _BY_KEY and row.answers.get(k)]
    if not chosen:
        raise InvalidRequest("Pick at least one answer to save, or discard them.")
    name = people_service.clean_line(name, MAX_NAME_LEN)
    person = _target_person(db, user, row, name)
    if person is None:
        created = people_service.add_person(db, user, name or row.name)
        person = people_service.owned(db, user, created.person_id)

    added_interests: list[str] = []
    if "into" in chosen:
        have = {i.lower() for i in person.interests or []}
        room = people_service.MAX_INTERESTS - len(person.interests or [])
        added_interests = [i for i in _interest_labels(row.answers["into"]) if i.lower() not in have][: max(room, 0)]
        if added_interests:
            person.interests = [*(person.interests or []), *added_interests]
    lines = [f"{_NOTE_PREFIX[k]}{row.answers[k]}" for k in ("together", "treat") if k in chosen]
    if lines:
        notes = "\n".join([*([person.notes] if person.notes else []), *lines])
        if len(notes) > people_service.MAX_NOTES_LEN:
            raise InvalidRequest(f"The note on {person.name} is full. Shorten it first, then save these answers.")
        person.notes = notes
    db.flush()
    follow_up = None
    if "ask" in chosen:
        text = f"Ask about: {row.answers['ask']}"
        follow_up = rel.add_follow_up(db, user, person_id=str(person.id), text=text)

    row.answers = {}
    row.reviewed_at = utcnow()
    db.flush()
    analytics.track(db, "answers_saved", user.id, count=len(chosen))
    return SaveAnswersOut(
        saved=True,
        response_id=str(row.id),
        person=people_service.to_out(db, person),
        added_interests=added_interests,
        follow_up=follow_up,
    )


def discard_answers(db: Session, user: User, response_id: str) -> DiscardAnswersOut:
    row = _own_response(db, user, response_id)
    row.answers = {}
    row.reviewed_at = utcnow()
    db.flush()
    return DiscardAnswersOut(discarded=True, response_id=str(row.id))
