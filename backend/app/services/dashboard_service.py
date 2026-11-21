"""Aggregated, owner-only view models for the widget's home screen."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import User
from app.schemas.profile import SocialGoal
from app.schemas.social import DashboardView, GoalOption, WelcomeView
from app.services import memory_service, people_service, social_service, user_service

GOAL_LABELS: dict[SocialGoal, str] = {
    SocialGoal.make_friends: "Make new friends",
    SocialGoal.maintain_friendships: "Keep up with friends",
    SocialGoal.deepen_relationships: "Deepen relationships",
    SocialGoal.find_activity_partners: "Find activity partners",
    SocialGoal.reconnect: "Reconnect with old friends",
    SocialGoal.meet_people_with_shared_interests: "Meet people with shared interests",
}


def build_dashboard(db: Session, user: User) -> DashboardView:
    profile = user_service.get_profile(db, user)
    memories = memory_service.list_memories(db, user, limit=200).memories
    connections = social_service.list_connections(db, user).connections
    people = people_service.list_people(db, user).people
    pending = social_service.pending_requests(db, user).incoming
    return DashboardView(
        profile=profile.model_dump(mode="json", exclude={"is_new"}),
        memories=[m.model_dump(mode="json") for m in memories],
        connections=[c.model_dump(mode="json") for c in connections],
        people=[p.model_dump(mode="json") for p in people],
        pending_requests=[p.model_dump(mode="json") for p in pending],
    )


def build_home(db: Session, user: User) -> DashboardView | WelcomeView:
    """Welcome card for an account with nothing in it yet, otherwise the dashboard."""
    dashboard = build_dashboard(db, user)
    empty = not (
        dashboard.memories
        or dashboard.connections
        or dashboard.people
        or dashboard.pending_requests
        or dashboard.profile["social_goals"]
    )
    if not empty:
        return dashboard
    return WelcomeView(
        display_name=dashboard.profile["display_name"],
        goal_options=[GoalOption(value=goal.value, label=label) for goal, label in GOAL_LABELS.items()],
    )
