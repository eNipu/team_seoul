import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base, JSONType
from app.models._base import created_at_col


class SavedReply(Base):
    __tablename__ = "saved_replies"
    __table_args__ = (Index("ix_saved_replies_owner_created", "owner_user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    reply: Mapped[dict] = mapped_column(JSONType)
    created_at: Mapped[datetime] = created_at_col()
