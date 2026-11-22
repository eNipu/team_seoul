from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Index, String, Text, Uuid, false
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base, JSONType
from app.models._base import created_at_col, uuid_pk


class OverlapMatch(Base):
    __tablename__ = "overlap_matches"

    id: Mapped[uuid.UUID] = uuid_pk()
    interest: Mapped[str] = mapped_column(String(64))


class OverlapPreference(Base):
    __tablename__ = "overlap_preferences"
    __table_args__ = (Index("ix_overlap_preferences_window", "area", "date", "slot"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    area: Mapped[str] = mapped_column(String(64))
    date: Mapped[dt.date] = mapped_column(Date)
    slot: Mapped[str] = mapped_column(String(32))
    interests: Mapped[list[str]] = mapped_column(JSONType)
    adults_confirmed: Mapped[bool] = mapped_column(Boolean)
    match_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("overlap_matches.id", ondelete="SET NULL"))
    accepted: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    spot_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class OverlapExclusion(Base):
    __tablename__ = "overlap_exclusions"
    __table_args__ = (CheckConstraint("kind IN ('pass', 'block', 'report')", name="ck_overlap_exclusions_kind"),)

    actor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    other_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = created_at_col()
