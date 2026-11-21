from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class SocialGoal(StrEnum):
    make_friends = "make_friends"
    maintain_friendships = "maintain_friendships"
    deepen_relationships = "deepen_relationships"
    find_activity_partners = "find_activity_partners"
    reconnect = "reconnect"
    meet_people_with_shared_interests = "meet_people_with_shared_interests"


class ProfileVisibility(StrEnum):
    PRIVATE = "PRIVATE"
    CONNECTIONS = "CONNECTIONS"
    PUBLIC = "PUBLIC"


class ProfileOut(BaseModel):
    user_id: str
    display_name: str
    bio: str | None
    social_goals: list[str]
    interests: list[str]
    memory_count: int
    profile_visibility: ProfileVisibility
    is_new: bool = False


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=60)
    bio: str | None = Field(default=None, max_length=500)
    social_goals: list[SocialGoal] | None = Field(default=None, max_length=6)
    profile_visibility: ProfileVisibility | None = None
