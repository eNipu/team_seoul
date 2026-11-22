"""One read-only home suggestion, grounded in explicitly saved interests."""

from collections import defaultdict
from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models import Memory, User
from app.services import relationship_service as rel
from app.services.activity_topics import activity_topic
from app.services.interest_matching import match_interests


def _topics(labels: Iterable[str]) -> set[str]:
    # Keep the saved wording: an allowlisted alias isn't an exact label match.
    return {" ".join(label.casefold().split()) for label in labels if activity_topic(label)}


def _interest_topics(memories: Iterable[Memory]) -> set[str]:
    # A memory about someone else isn't a declaration of the owner's interests.
    return _topics(
        label for m in memories if m.category == "INTEREST" and not m.people for label in [m.title, *(m.tags or [])]
    )


def _person(friend: rel.Friend) -> dict[str, str]:
    return {"kind": friend.kind, "id": friend.id, "display_name": friend.display_name}


def _suggest(db: Session, mine: set[str], friends: list[rel.Friend]) -> dict | None:
    holders: dict[str, list[rel.Friend]] = defaultdict(list)
    for friend in friends:
        theirs = _topics(friend.interest_labels) if friend.person else _interest_topics(friend.memories)
        for term in theirs:
            holders[term].append(friend)

    # Only whole, allowlisted topics reach the matcher on either side.
    matches = sorted(
        match_interests(sorted(mine), sorted(holders)),
        key=lambda m: (
            m.kind != "exact",
            len(holders[m.their_label]) < 2,
            -len(m.their_label.split()),
            m.their_label,
            m.my_label,
        ),
    )
    for match in matches:
        topic = activity_topic(match.their_label)
        if topic and (ideas := rel._ideas_from([[topic]], [], limit=1)):
            activity = ideas[0][0]
            break
    else:
        return None
    first = holders[match.their_label][0]
    prefix = "Starter circle: " if first.is_sample else ""
    compatible = {(f.kind, f.id) for f in rel.compatible_companions(db, first, friends)}

    def companion(label: str) -> rel.Friend | None:
        return next((f for f in holders[label] if (f.kind, f.id) in compatible), None)

    group = None
    for label in sorted(holders):
        bridge = rel.bridge_for_topics(topic, activity_topic(label) or label)
        extra = companion(label) if bridge else None
        if bridge and extra:
            title, description = bridge
            group = {
                "person": _person(extra),
                "activity": title,
                "reason": f"{extra.display_name} brings an interest in {label}. {description}",
                "draft": f"How about a {title.lower()} together?",
            }
            break
    if group is None:
        for label in sorted(holders):
            if activity_topic(label) == topic and (extra := companion(label)):
                group = {
                    "person": _person(extra),
                    "activity": activity,
                    "reason": f"{extra.display_name} has {label} as a saved interest.",
                    "draft": f"Group idea: {activity.lower()}. Want to pick a day?",
                }
                break
    if match.kind == "exact":
        reason = f"Your saved interests and {first.display_name}'s both include {match.my_label}."
    else:
        reason = (
            f"Your saved interest in {match.my_label} is related to "
            f"{first.display_name}'s interest in {match.their_label}."
        )
    return {
        "topic": topic,
        "person": _person(first),
        "activity": activity,
        "reason": prefix + reason,
        "draft": f"Hey {rel.first_name(first.display_name)}! Catch-up idea: {activity.lower()}. Interested?",
        "group": group,
    }


def circle_idea(db: Session, user: User) -> dict:
    memories = rel.own_memories(db, user)
    mine = _interest_topics(m for m in memories if m.source != "sample")
    demo = _interest_topics(m for m in memories if m.source == "sample")
    if not (mine or demo):
        return {"idea": None}
    friends = sorted(rel.all_friends(db, user), key=lambda f: (f.display_name.casefold(), f.kind, f.id))
    # Don't use a demo preference as evidence about the user, or mix real and fictional guests.
    idea = _suggest(db, mine, [f for f in friends if not f.is_sample]) if mine else None
    if idea is None and demo:
        idea = _suggest(db, demo, [f for f in friends if f.is_sample])
    return {"idea": idea}
