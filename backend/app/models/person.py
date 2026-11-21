from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base, JSONType
from app.models._base import created_at_col, updated_at_col, uuid_pk


class Person(Base):
    """A private note about a friend who is NOT on Heldly.

    Owner-only: never shared with connections, never shown on a profile, and never used to
    contact anyone. Deleted with the owner's account.
    """

    __tablename__ = "people"
    __table_args__ = (Index("ix_people_owner", "owner_user_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    # How the owner knows them, e.g. "college roommate".
    relationship: Mapped[str | None] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)
    interests: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()


class PersonInteraction(Base):
    """A hangout the owner logged with a Person."""

    __tablename__ = "person_interactions"
    __table_args__ = (Index("ix_person_interactions_person", "person_id", "created_at"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    person_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    activity: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = created_at_col()
