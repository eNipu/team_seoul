from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base, JSONType
from app.models._base import created_at_col, uuid_pk


class QuestionLink(Base):
    """A link the owner shares so a friend without an account can answer a few questions.

    The token in the URL is the only credential. Answers wait in `question_responses` until
    the owner reviews them; nothing reaches the owner's notes without that review.
    """

    __tablename__ = "question_links"
    __table_args__ = (Index("ix_question_links_owner", "owner_user_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # Set when the link was made for one person the owner already has a note about.
    person_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("people.id", ondelete="SET NULL"))
    for_name: Mapped[str | None] = mapped_column(String(80))
    max_responses: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    response_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_col()


class QuestionResponse(Base):
    """What a friend answered on a question link. Emptied once the owner saved or discarded it."""

    __tablename__ = "question_responses"
    __table_args__ = (Index("ix_question_responses_owner", "owner_user_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    link_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("question_links.id", ondelete="CASCADE"), nullable=False
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    answers: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_col()
