"""ORM models. Importing this package registers every table on Base.metadata."""

from app.models.connection import (
    AbuseReport,
    AnalyticsEvent,
    Block,
    Connection,
    ConnectionRequest,
    Consent,
    DevOAuthClient,
    DevOAuthCode,
    RelationshipEvent,
)
from app.models.invite import Invite
from app.models.memory import Memory, MemoryProposal
from app.models.user import User, UserProfile

__all__ = [
    "AbuseReport",
    "AnalyticsEvent",
    "Block",
    "Connection",
    "ConnectionRequest",
    "Consent",
    "DevOAuthClient",
    "DevOAuthCode",
    "Invite",
    "Memory",
    "MemoryProposal",
    "RelationshipEvent",
    "User",
    "UserProfile",
]
