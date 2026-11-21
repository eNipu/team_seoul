from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base, JSONType
from app.models._base import created_at_col, uuid_pk


class ConnectionRequest(Base):
    __tablename__ = "connection_requests"
    __table_args__ = (Index("ix_conn_req_recipient", "recipient_user_id", "status"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    sender_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), default="PENDING", nullable=False)
    # Invite code that led to this request (if any).
    context_invite_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("invites.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = created_at_col()
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Connection(Base):
    """Accepted mutual connection. Pairs are canonicalized: user_a_id < user_b_id."""

    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_connections_pair"),
        CheckConstraint("user_a_id <> user_b_id", name="ck_connections_distinct"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_a_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_b_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = created_at_col()


class RelationshipEvent(Base):
    __tablename__ = "relationship_events"
    __table_args__ = (Index("ix_rel_events_connection", "connection_id", "created_at"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("connections.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    event_data: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    created_at: Mapped[datetime] = created_at_col()


class Block(Base):
    __tablename__ = "blocks"

    blocker_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    blocked_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = created_at_col()


class AbuseReport(Base):
    __tablename__ = "abuse_reports"

    id: Mapped[uuid.UUID] = uuid_pk()
    reporter_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reported_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = created_at_col()


class Consent(Base):
    __tablename__ = "consents"
    __table_args__ = (Index("ix_consents_user_type", "user_id", "consent_type"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    consent_type: Mapped[str] = mapped_column(String(40), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    granted_at: Mapped[datetime] = created_at_col()
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AnalyticsEvent(Base):
    """Privacy-conscious product analytics: no memory text or transcripts."""

    __tablename__ = "analytics_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    session_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    event_metadata: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    created_at: Mapped[datetime] = created_at_col()


class DevOAuthClient(Base):
    """Dynamic-client-registration records for the DEVELOPMENT-ONLY OAuth server."""

    __tablename__ = "dev_oauth_clients"

    client_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    client_info: Mapped[dict] = mapped_column(JSONType, nullable=False)
    created_at: Mapped[datetime] = created_at_col()


class DevOAuthCode(Base):
    __tablename__ = "dev_oauth_codes"

    code: Mapped[str] = mapped_column(String(128), primary_key=True)
    client_id: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[dict] = mapped_column(JSONType, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_col()
