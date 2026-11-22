from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base, JSONType
from app.models._base import created_at_col, updated_at_col, uuid_pk


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    # "<issuer>|<sub>" — the only identity source; never derived from names or chat content.
    auth_subject: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(80))
    overlap_area: Mapped[str | None] = mapped_column(String(16))
    matches_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # First time an OAuth access token for this account reached the MCP server (ChatGPT connected).
    chatgpt_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()

    profile: Mapped[UserProfile] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    bio: Mapped[str | None] = mapped_column(Text)
    social_goals: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    # PRIVATE | CONNECTIONS | PUBLIC
    visibility: Mapped[str] = mapped_column(String(32), default="PRIVATE", nullable=False)
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()

    user: Mapped[User] = relationship(back_populates="profile")
