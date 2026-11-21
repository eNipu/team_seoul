from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models._base import created_at_col, updated_at_col, uuid_pk


class Plan(Base):
    """Something the owner intends to do with one or more friends. Owner-only.

    A plan is a note to self: Venn never tells the friends about it.
    """

    __tablename__ = "plans"
    __table_args__ = (Index("ix_plans_owner", "owner_user_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    details: Mapped[str | None] = mapped_column(Text)
    planned_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()


class PlanMember(Base):
    """A friend a plan is with: exactly one of a connection or a person note."""

    __tablename__ = "plan_members"
    __table_args__ = (
        Index("ix_plan_members_plan", "plan_id"),
        CheckConstraint(
            "(connection_id IS NOT NULL AND person_id IS NULL) OR (connection_id IS NULL AND person_id IS NOT NULL)",
            name="ck_plan_members_one_target",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    plan_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    connection_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("connections.id", ondelete="CASCADE"))
    person_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("people.id", ondelete="CASCADE"))
