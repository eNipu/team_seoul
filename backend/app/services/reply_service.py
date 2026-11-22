from uuid import UUID, uuid5

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.ai.extraction import contains_sensitive
from app.models import SavedReply, User
from app.schemas.reply import ChecklistReply, DiscussionReply, Reply, SaveReplyResult, ThreadReply
from app.services import analytics
from app.services.errors import InvalidRequest, NotFound, PrivacyViolation


def check_content(reply: Reply) -> None:
    fields = [reply.title, reply.body]
    if isinstance(reply, ChecklistReply):
        fields.extend(reply.steps)
    if isinstance(reply, DiscussionReply):
        fields.append(reply.question)
    if isinstance(reply, ThreadReply):
        for entry in reply.entries:
            fields.extend((entry.title, entry.body))
    text = "\n".join(fields)
    if "\0" in text:
        raise InvalidRequest("A Venn reply must be plain text.")
    if contains_sensitive(text):
        raise PrivacyViolation("A Venn reply can't include credentials or other sensitive numbers.")


def save(db: Session, user: User, reply: Reply) -> SaveReplyResult:
    check_content(reply)
    # The same owner and content get the same ID, including when save requests overlap.
    reply_id = uuid5(user.id, reply.model_dump_json())
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else pg_insert
    stmt = insert(SavedReply).values(id=reply_id, owner_user_id=user.id, reply=reply.model_dump(mode="json"))
    inserted = db.execute(
        stmt.on_conflict_do_nothing(index_elements=[SavedReply.id]).returning(SavedReply.id)
    ).scalar_one_or_none()
    if inserted is not None:
        analytics.track(db, "reply_saved", user.id, category=reply.kind, count=1)
    return SaveReplyResult(reply_id=str(reply_id))


def list_saved(db: Session, user: User) -> list[dict]:
    rows = db.scalars(
        select(SavedReply)
        .where(SavedReply.owner_user_id == user.id)
        .order_by(SavedReply.created_at.desc(), SavedReply.id)
    )
    return [{"reply_id": str(row.id), "reply": row.reply} for row in rows]


def remove(db: Session, user: User, reply_id: str) -> None:
    try:
        parsed = UUID(reply_id)
    except ValueError:
        raise NotFound("Saved reply not found.") from None
    removed = db.execute(
        delete(SavedReply).where(SavedReply.id == parsed, SavedReply.owner_user_id == user.id).returning(SavedReply.id)
    ).scalar_one_or_none()
    if removed is None:
        raise NotFound("Saved reply not found.")
