from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base, JSONType
from app.models._base import created_at_col, updated_at_col, uuid_pk


class Availability(Base):
    """When the owner takes meetings. Owner-only; read by the slot finder."""

    __tablename__ = "availability"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    # Weekdays, Monday = 0.
    work_days: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    # Local wall-clock minutes since midnight; day_end may be 1440.
    day_start_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    day_end_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    buffer_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    min_notice_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    default_length_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()
