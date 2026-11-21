"""Minimal, privacy-conscious product analytics (no memory text or transcripts)."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from app.models import AnalyticsEvent

log = logging.getLogger("venn.analytics")

EVENT_TYPES = {
    "profile_created",
    "memory_approved",
    "memory_proposed",
    "memory_deleted",
    "invite_created",
    "invitation_redeemed",
    "connection_requested",
    "connection_accepted",
    "activity_suggested",
    "reconnection_suggested",
    "person_added",
    "people_imported",
    "people_searched",
    "group_planned",
    "meetup_brief",
    "meetup_recapped",
    "quiz_started",
}

_ALLOWED_METADATA_KEYS = {"count", "source", "category"}


def track(
    db: Session,
    event_type: str,
    user_id: uuid.UUID | None,
    session_id: uuid.UUID | None = None,
    **metadata: object,
) -> None:
    if event_type not in EVENT_TYPES:
        raise ValueError(f"unknown analytics event {event_type}")
    safe = {k: str(v) if isinstance(v, uuid.UUID) else v for k, v in metadata.items() if k in _ALLOWED_METADATA_KEYS}
    db.add(AnalyticsEvent(event_type=event_type, user_id=user_id, session_id=session_id, event_metadata=safe))
    log.info("analytics event=%s user=%s", event_type, user_id)
