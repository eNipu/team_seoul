from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ConnectionRequestOut(BaseModel):
    request_id: str | None
    status: Literal["PENDING", "ACCEPTED", "REJECTED", "ALREADY_CONNECTED", "ALREADY_PENDING"]
    recipient_display_name: str


class RespondConnectionOut(BaseModel):
    request_id: str
    status: Literal["ACCEPTED", "REJECTED"]
    connection_id: str | None


class ConnectionOut(BaseModel):
    connection_id: str
    user_id: str
    display_name: str
    since: datetime
    last_interaction_at: datetime | None


class ConnectionListOut(BaseModel):
    connections: list[ConnectionOut]


class PendingRequestOut(BaseModel):
    request_id: str
    sender_display_name: str
    created_at: datetime


class PendingRequestListOut(BaseModel):
    incoming: list[PendingRequestOut]
    outgoing_count: int


class ActivitySuggestion(BaseModel):
    title: str
    description: str
    grounded_in: list[str]
    suggested_action: str


class SuggestActivityOut(BaseModel):
    connection_id: str
    friend_display_name: str
    shared_interests: list[str]
    match_score: float
    score_explanation: list[str]
    suggestions: list[ActivitySuggestion]
    note: str = "Heldly never contacts anyone automatically; the user decides whether to reach out."


class ReconnectionCandidate(BaseModel):
    connection_id: str
    display_name: str
    days_since_last_interaction: int
    last_activity: str | None
    reason: str
    suggested_activity: str


class ReconnectionOut(BaseModel):
    candidates: list[ReconnectionCandidate]


class DashboardView(BaseModel):
    view: Literal["dashboard"] = "dashboard"
    profile: dict
    memories: list[dict]
    connections: list[dict]
    pending_requests: list[dict]


class SimpleOk(BaseModel):
    ok: bool
    message: str


class InviteOut(BaseModel):
    code: str
    expires_at: datetime
    max_uses: int
    share_text: str
    note: str = "Share this code only with people you know. You can revoke it anytime."


class InviteListOut(BaseModel):
    invites: list[dict]


class RedeemInviteOut(BaseModel):
    status: Literal["PENDING", "ALREADY_CONNECTED", "ALREADY_PENDING"]
    request_id: str | None
    inviter_display_name: str
    message: str


class LogInteractionOut(BaseModel):
    connection_id: str
    recorded: bool
    last_interaction_at: datetime
