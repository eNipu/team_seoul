from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, Uuid
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


class PeopleImport(Base):
    """People the assistant proposed to add, waiting for the owner to confirm on the review card.

    Stored server-side so that nothing is added on the model's say-so: `heldly_import_people`
    only accepts an import the same user was shown, once, before it expires.
    """

    __tablename__ = "people_imports"
    __table_args__ = (Index("ix_people_imports_user", "user_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    items: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    source: Mapped[str | None] = mapped_column(String(60))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_col()


class FollowUp(Base):
    """Something the owner wants to ask a friend about next time. Owner-only.

    Targets exactly one of a connection or a person note.
    """

    __tablename__ = "follow_ups"
    __table_args__ = (
        Index("ix_follow_ups_owner", "owner_user_id"),
        CheckConstraint(
            "(connection_id IS NOT NULL AND person_id IS NULL) OR (connection_id IS NULL AND person_id IS NOT NULL)",
            name="ck_follow_ups_one_target",
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    connection_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("connections.id", ondelete="CASCADE"))
    person_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("people.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(String(200), nullable=False)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_col()
