from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models._base import created_at_col, uuid_pk


class Invite(Base):
    """Short-lived, revocable invite code a user shares so a friend can request a connection.

    Redeeming a code never reveals the creator's private memories; it only lets the redeemer
    send a connection request that the creator must still accept.
    """

    __tablename__ = "invites"
    __table_args__ = (Index("ix_invites_creator", "created_by_user_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    max_uses: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_col()
