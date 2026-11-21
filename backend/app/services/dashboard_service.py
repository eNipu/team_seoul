"""Aggregated, owner-only view model for the widget dashboard."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import User
from app.schemas.social import DashboardView
from app.services import memory_service, social_service, user_service


def build_dashboard(db: Session, user: User) -> DashboardView:
    profile = user_service.get_profile(db, user)
    memories = memory_service.list_memories(db, user, limit=200).memories
    connections = social_service.list_connections(db, user).connections
    pending = social_service.pending_requests(db, user).incoming
    return DashboardView(
        profile=profile.model_dump(mode="json"),
        memories=[m.model_dump(mode="json") for m in memories],
        connections=[c.model_dump(mode="json") for c in connections],
        pending_requests=[p.model_dump(mode="json") for p in pending],
    )
