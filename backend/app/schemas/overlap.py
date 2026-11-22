"""Closed-vocabulary inputs and responses for Overlap."""

from datetime import date as LocalDate
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator

Area = Literal["seongsu", "hongdae", "yeonnam", "berlin-mitte", "berlin-kreuzberg", "berlin-pberg"]
Slot = Literal["morning", "afternoon", "evening"]
Interest = Literal["photography", "architecture", "walking", "coffee", "books", "art"]


class OverlapLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    area: Area | None


class OverlapWindow(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    area: Area
    date: LocalDate
    slot: Slot
    interests: Annotated[list[Interest], Field(min_length=1, max_length=3)]


class OverlapPreferenceInput(OverlapWindow):
    adults_confirmed: StrictBool

    @field_validator("adults_confirmed")
    @classmethod
    def require_attestation(cls, value: bool) -> bool:
        if not value:
            raise ValueError("adult confirmation required")
        return value

    @field_validator("date", mode="before")
    @classmethod
    def require_iso_date(cls, value):
        if type(value) is LocalDate:
            return value
        if not isinstance(value, str) or LocalDate.fromisoformat(value).isoformat() != value:
            raise ValueError("use YYYY-MM-DD")
        return value

    @field_validator("interests")
    @classmethod
    def distinct(cls, value: list[Interest]) -> list[Interest]:
        if len(value) != len(set(value)):
            raise ValueError("choose distinct interests")
        return value


class MeetingPoint(BaseModel):
    label: str
    status: Literal["available", "suggested_by_you", "suggested_to_you", "agreed"]


class OverlapCard(BaseModel):
    id: str
    status: Literal["offered", "waiting", "introduced"]
    title: str
    reason: str
    challenge: str
    other_name: str | None
    meeting_point: MeetingPoint | None = None


class OverlapState(BaseModel):
    preference: OverlapWindow | None = None
    match: OverlapCard | None = None
