"""Match explicit interest labels, never words extracted from notes or descriptions."""

import json
from collections.abc import Iterable
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Memory, User
from app.schemas.social import InterestMatch

# The two browser previews use this same whole-label vocabulary.
_VOCABULARY = json.loads(Path(__file__).with_name("interest_families.json").read_text(encoding="utf-8"))
_FAMILIES = {label: family for family, labels in _VOCABULARY["families"].items() for label in labels}

# Match broad topics in either direction, but never infer a match between sibling topics.
_RELATED_TOPICS: dict[str, set[str]] = {}
for _broad, _specifics in _VOCABULARY["broader_topics"].items():
    for _specific in _specifics:
        _RELATED_TOPICS.setdefault(_broad, set()).add(_specific)
        _RELATED_TOPICS.setdefault(_specific, set()).add(_broad)


def _labels(values: Iterable[str]) -> dict[str, str]:
    """One stable display spelling per nonempty, casefolded label."""
    labels = {}
    for label in sorted(" ".join(value.split()) for value in values):
        if label:
            labels.setdefault(label.casefold(), label)
    return labels


def interest_family(key: str) -> str:
    return _FAMILIES.get(key, key)


def match_interests(mine: Iterable[str], theirs: Iterable[str]) -> list[InterestMatch]:
    """Return the strongest match per distinct incoming label, exact matches first."""
    own, other = _labels(mine), _labels(theirs)
    by_family: dict[str, str] = {}
    by_related_topic: dict[str, str] = {}
    for key in sorted(own):
        family = interest_family(key)
        by_family.setdefault(family, own[key])
        for related in _RELATED_TOPICS.get(family, ()):
            by_related_topic.setdefault(related, own[key])

    matches = [InterestMatch(my_label=own[k], their_label=other[k], kind="exact") for k in sorted(own.keys() & other)]
    for key in sorted(other.keys() - own):
        family = interest_family(key)
        if label := by_family.get(family) or by_related_topic.get(family):
            matches.append(InterestMatch(my_label=label, their_label=other[key], kind="related"))
    return matches


def my_interest_labels(db: Session, user: User) -> list[str]:
    """The acting user's own saved interests, excluding people memories and demo seed data."""
    rows = db.execute(
        select(Memory.title, Memory.tags, Memory.people).where(
            Memory.user_id == user.id, Memory.category == "INTEREST", Memory.source.is_distinct_from("sample")
        )
    )
    return list(
        _labels(label for title, tags, people in rows if not people for label in (title, *(tags or []))).values()
    )
