from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class MemoryCategory(StrEnum):
    INTEREST = "INTEREST"
    DISLIKE = "DISLIKE"
    PREFERENCE = "PREFERENCE"
    EXPERIENCE = "EXPERIENCE"
    WORK = "WORK"
    PERSONAL_MEMORY = "PERSONAL_MEMORY"
    SOCIAL_GOAL = "SOCIAL_GOAL"
    RELATIONSHIP_CONTEXT = "RELATIONSHIP_CONTEXT"


class MemoryVisibility(StrEnum):
    PRIVATE = "PRIVATE"
    SHARED_WITH_CONNECTIONS = "SHARED_WITH_CONNECTIONS"
    PUBLIC_PROFILE = "PUBLIC_PROFILE"


def _clean_tags(tags: list[str]) -> list[str]:
    out: list[str] = []
    for t in tags:
        t = " ".join(str(t).strip().lower().split())[:32]
        if t and t not in out:
            out.append(t)
    return out[:8]


class MemoryCandidate(BaseModel):
    """A proposed (not yet saved) memory."""

    category: MemoryCategory
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("tags")
    @classmethod
    def _normalize_tags(cls, v: list[str]) -> list[str]:
        return _clean_tags(v)


class ProposedMemory(MemoryCandidate):
    index: int
    suggested_visibility: MemoryVisibility = MemoryVisibility.PRIVATE
    # The user already has a memory with this title (e.g. a repeated import).
    already_saved: bool = False


# Where proposed memories come from: what the user said in this conversation, or what ChatGPT
# already remembered about them (its saved memories / past chats) and the user picked to bring over.
MemorySource = Literal["conversation", "chatgpt_memory"]


class MemoryProposalOut(BaseModel):
    proposal_id: str
    expires_at: datetime
    source: MemorySource = "conversation"
    proposals: list[ProposedMemory]
    note: str = "Nothing has been saved. Show these to the user and save only the items they explicitly approve."


class MemoryApproval(BaseModel):
    index: int = Field(ge=0, description="Index of the proposal item the user approved.")
    visibility: MemoryVisibility = MemoryVisibility.PRIVATE
    title: str | None = Field(default=None, min_length=1, max_length=120, description="User edit, optional.")
    description: str | None = Field(default=None, min_length=1, max_length=500, description="User edit.")


class MemoryOut(BaseModel):
    memory_id: str
    category: MemoryCategory
    title: str
    description: str
    tags: list[str]
    visibility: MemoryVisibility
    source: Literal["chatgpt_memory"] | None = None
    created_at: datetime


class SaveMemoriesOut(BaseModel):
    saved: list[MemoryOut]
    count: int


class MemoryListOut(BaseModel):
    memories: list[MemoryOut]
    count: int


class DeleteMemoryOut(BaseModel):
    deleted: bool
    memory_id: str


class ImportArea(BaseModel):
    value: str
    label: str
    description: str
    selected: bool


class MemoryImportView(BaseModel):
    """Chooser card for bringing over what ChatGPT already remembers about the user."""

    view: Literal["memory_import"] = "memory_import"
    areas: list[ImportArea]
    always_excluded: str
    imported_count: int
    max_items: int
    note: str
