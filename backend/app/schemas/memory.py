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


def clean_names(names: list[str] | None) -> list[str]:
    """People a memory is about: trimmed, de-duplicated (case-insensitive), at most five."""
    out: list[str] = []
    for name in names or []:
        name = " ".join(str(name).split())[:80]
        if name and name.lower() not in {n.lower() for n in out}:
            out.append(name)
    return out[:5]


def _clean_tags(tags: list[str]) -> list[str]:
    out: list[str] = []
    for t in tags:
        t = " ".join(str(t).strip().lower().split())[:32]
        if t and t not in out:
            out.append(t)
    return out[:8]


_CATEGORY_ALIASES: dict[str, str] = {
    "HOBBY": "INTEREST",
    "HOBBIES": "INTEREST",
    "INTERESTS": "INTEREST",
    "LIKES": "INTEREST",
    "DISLIKES": "DISLIKE",
    "PREFERENCES": "PREFERENCE",
    "EXPERIENCES": "EXPERIENCE",
    "JOB": "WORK",
    "CAREER": "WORK",
    "PROJECT": "WORK",
    "PROJECTS": "WORK",
    "WORK_AND_PROJECTS": "WORK",
    "MEMORY": "PERSONAL_MEMORY",
    "PERSONAL": "PERSONAL_MEMORY",
    "GOAL": "SOCIAL_GOAL",
    "GOALS": "SOCIAL_GOAL",
    "RELATIONSHIP": "RELATIONSHIP_CONTEXT",
    "RELATIONSHIPS": "RELATIONSHIP_CONTEXT",
}

_VISIBILITY_ALIASES: dict[str, str] = {
    "ONLY_YOU": "PRIVATE",
    "SHARED": "SHARED_WITH_CONNECTIONS",
    "CONNECTIONS": "SHARED_WITH_CONNECTIONS",
    "FRIENDS": "SHARED_WITH_CONNECTIONS",
    "PUBLIC": "PUBLIC_PROFILE",
}


def _normalize_enum(value: object, aliases: dict[str, str]) -> object:
    if not isinstance(value, str):
        return value
    key = "_".join(value.strip().upper().replace("-", " ").split())
    return aliases.get(key, key)


def _clean_text_field(value: object, limit: int, *, empty_to_none: bool = False) -> object:
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    cleaned = " ".join(value.split())[:limit]
    if not cleaned and empty_to_none:
        return None
    return cleaned


class MemoryCandidate(BaseModel):
    """A proposed (not yet saved) memory."""

    category: MemoryCategory
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=8)
    people: list[str] = Field(
        default_factory=list,
        max_length=5,
        description="Names of the friends this memory is about, e.g. ['Maya']. Empty when it is only about the user.",
    )

    @field_validator("category", mode="before")
    @classmethod
    def _normalize_category(cls, v: object) -> object:
        return _normalize_enum(v, _CATEGORY_ALIASES)

    @field_validator("title", mode="before")
    @classmethod
    def _normalize_title(cls, v: object) -> object:
        return _clean_text_field(v, 120)

    @field_validator("description", mode="before")
    @classmethod
    def _normalize_description(cls, v: object) -> object:
        return _clean_text_field(v, 500)

    @field_validator("tags", mode="before")
    @classmethod
    def _normalize_tags(cls, v: object) -> object:
        if v is None:
            return []
        if isinstance(v, list):
            return _clean_tags(v)
        return v

    @field_validator("people", mode="before")
    @classmethod
    def _normalize_people(cls, v: object) -> object:
        if v is None:
            return []
        if isinstance(v, list):
            return clean_names(v)
        return v


class ProposedMemory(MemoryCandidate):
    index: int
    suggested_visibility: MemoryVisibility = MemoryVisibility.PRIVATE
    # The user already has a memory with this title (e.g. a repeated import).
    already_saved: bool = False
    # The part of `people` that is not in the user's circle yet. Approving the item adds them as private notes.
    new_people: list[str] = []


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

    @field_validator("visibility", mode="before")
    @classmethod
    def _normalize_visibility(cls, v: object) -> object:
        if v is None:
            return MemoryVisibility.PRIVATE
        return _normalize_enum(v, _VISIBILITY_ALIASES)

    @field_validator("title", mode="before")
    @classmethod
    def _normalize_edit_title(cls, v: object) -> object:
        return _clean_text_field(v, 120, empty_to_none=True)

    @field_validator("description", mode="before")
    @classmethod
    def _normalize_edit_description(cls, v: object) -> object:
        return _clean_text_field(v, 500, empty_to_none=True)


class MemoryOut(BaseModel):
    memory_id: str
    category: MemoryCategory
    title: str
    description: str
    tags: list[str]
    visibility: MemoryVisibility
    source: Literal["chatgpt_memory", "sample"] | None = None
    people: list[str] = []
    created_at: datetime


class SaveMemoriesOut(BaseModel):
    saved: list[MemoryOut]
    count: int
    # Private notes created for people the approved memories are about (PersonOut as dicts).
    people_added: list[dict] = []


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
