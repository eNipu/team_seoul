from typing import Literal

from pydantic import BaseModel


class OnboardingState(BaseModel):
    memories_ready: bool
    contacts_ready: bool
    matches_reviewed: bool


class InterestMatch(BaseModel):
    my_label: str
    their_label: str
    kind: Literal["exact", "related"]


class InterestMatchResult(BaseModel):
    kind: Literal["person", "connection"]
    id: str
    display_name: str
    interest_matches: list[InterestMatch]


class InterestMatchesView(BaseModel):
    view: Literal["interest_matches"] = "interest_matches"
    matches: list[InterestMatchResult]
