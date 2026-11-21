from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base, JSONType
from app.models._base import created_at_col, updated_at_col, uuid_pk


class Memory(Base):
    __tablename__ = "memories"
    __table_args__ = (Index("ix_memories_user_id", "user_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    visibility: Mapped[str] = mapped_column(String(32), default="PRIVATE", nullable=False)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Where the approved memory came from: NULL = this conversation, "chatgpt_memory" = imported.
    source: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()


class MemoryProposal(Base):
    """Server-held candidate memories awaiting explicit user review.

    Saving requires a proposal owned by the caller, so memories can only be persisted from
    content the user supplied and reviewed — never from a free-form model-generated payload.
    """

    __tablename__ = "memory_proposals"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    items: Mapped[list] = mapped_column(JSONType, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)  # openai | heuristic | assistant | chatgpt_memory
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_col()
