"""Fill a development account with demo friends so every Heldly card has something to show.

    make seed me=<dev username>          # add (or refresh) the demo data
    make seed-remove me=<dev username>   # take it out again

`<dev username>` is the name you type on the dev sign-in page (AUTH_MODE=dev). The script:

- creates demo Heldly users (auth subjects `dev|demo-*`) with shared memories, connects three of
  them to you with past hangouts and leaves one pending request;
- adds private notes about people who are not on Heldly, with past hangouts and things to ask;
- adds a few memories and social goals to YOUR account only if it has none yet.

Running it again replaces the demo data; your own memories, notes and connections are untouched.
It refuses to run in production or with real (non-dev) sign-in.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db.database import init_engine, session_scope  # noqa: E402
from app.db.migrate import upgrade_to_head  # noqa: E402
from app.models import (  # noqa: E402
    Connection,
    ConnectionRequest,
    FollowUp,
    Memory,
    Person,
    PersonInteraction,
    RelationshipEvent,
    User,
    UserProfile,
)
from app.models._base import utcnow  # noqa: E402

USERNAME = re.compile(r"^[a-z0-9][a-z0-9_.-]{1,31}$")
DEMO_PREFIX = "dev|demo-"
SHARED = "SHARED_WITH_CONNECTIONS"
PRIVATE = "PRIVATE"

# (category, title, description, tags, visibility)
MemorySeed = tuple[str, str, str, list[str], str]

# username -> name, bio, connected days ago (None = pending request), hangouts (days ago, activity), memories
DEMO_USERS: dict[str, dict] = {
    "demo-jun": {
        "name": "Jun Park",
        "bio": "Product designer, weekend climber, always hunting for the best ramen.",
        "connected": 200,
        "hangouts": [(80, "Ramen in Mangwon"), (35, "Bouldering session")],
        "follow_ups": ["Ask how the new job is going"],
        "memories": [
            ("INTEREST", "Bouldering", "Climbs indoors twice a week.", ["climbing", "bouldering"], SHARED),
            ("INTEREST", "Ramen hunting", "Keeps a ranked list of ramen shops.", ["ramen", "food"], SHARED),
            ("INTEREST", "Film photography", "Shoots 35mm on weekend walks.", ["photography", "film"], SHARED),
            ("DISLIKE", "Early morning meetings", "Not a morning person.", ["mornings"], SHARED),
            ("EXPERIENCE", "Hiked Hallasan last spring", "Summit day on Jeju.", ["hiking", "jeju"], SHARED),
            ("PREFERENCE", "Small groups over big parties", "Prefers four people or fewer.", ["groups"], SHARED),
            ("PERSONAL_MEMORY", "Thinking about moving abroad", "Not ready to tell people yet.", [], PRIVATE),
        ],
    },
    "demo-hana": {
        "name": "Hana Kim",
        "bio": "Teacher. Board games, sourdough and small concerts.",
        "connected": 150,
        "hangouts": [(14, "Board game night")],
        "follow_ups": [],
        "memories": [
            ("INTEREST", "Board games", "Hosts a monthly game night.", ["board games"], SHARED),
            ("INTEREST", "Indie concerts", "Goes to small venues most months.", ["music", "concerts"], SHARED),
            ("INTEREST", "Baking sourdough", "Has kept a starter alive for three years.", ["baking"], SHARED),
            ("DISLIKE", "Very spicy food", "Mild is fine, fiery is not.", ["spicy"], SHARED),
            ("EXPERIENCE", "Ran the Seoul half marathon", "First race, finished smiling.", ["running"], SHARED),
            ("PREFERENCE", "Plans made a week ahead", "Likes time to look forward to things.", ["planning"], SHARED),
        ],
    },
    "demo-diego": {
        "name": "Diego Alvarez",
        "bio": "Engineer from Seville. Cooks for everyone, hikes on Sundays.",
        "connected": 100,
        "hangouts": [(60, "Sunday hike on Bukhansan")],
        "follow_ups": [],
        "memories": [
            ("INTEREST", "Cooking Mexican food", "Makes tortillas from scratch.", ["cooking", "food"], SHARED),
            ("INTEREST", "Hiking", "Out on a trail most Sundays.", ["hiking"], SHARED),
            ("INTEREST", "Board games", "Strategy games, the longer the better.", ["board games"], SHARED),
            ("INTEREST", "Five-a-side football", "Plays on Wednesday nights.", ["football"], SHARED),
            ("DISLIKE", "Horror movies", "Will leave the room.", ["movies"], SHARED),
            ("EXPERIENCE", "Road trip across Andalusia", "Two weeks, one tiny car.", ["travel"], SHARED),
        ],
    },
    "demo-sofia": {
        "name": "Sofia Rossi",
        "bio": "Illustrator, new in town.",
        "connected": None,
        "hangouts": [],
        "follow_ups": [],
        "memories": [
            ("INTEREST", "Sketching in cafes", "Always has a notebook.", ["art", "coffee"], SHARED),
            ("INTEREST", "Hiking", "Looking for trail buddies.", ["hiking"], SHARED),
        ],
    },
}

# name, relationship, notes, interests, hangouts (days ago, activity), follow-ups
PEOPLE: list[tuple[str, str, str, list[str], list[tuple[int, str]], list[str]]] = [
    (
        "Maya Chen",
        "college roommate",
        "Moved to Busan for a design job. Loves trail running and pottery.",
        ["trail running", "pottery", "coffee"],
        [(75, "Coffee near campus")],
        ["Ask about her pottery exhibition"],
    ),
    (
        "Tom Becker",
        "former coworker",
        "Just had a baby, Lena. Into cycling and craft beer.",
        ["cycling", "craft beer", "board games"],
        [(40, "Lunch near the old office")],
        ["Ask how Lena is sleeping"],
    ),
    (
        "Aunt Yuna",
        "family",
        "Keeps a rooftop garden and makes the best kimchi.",
        ["gardening", "cooking"],
        [(120, "Family dinner")],
        [],
    ),
    (
        "Priya Nair",
        "climbing gym",
        "Met at the bouldering wall. Teaches yoga on weekends.",
        ["climbing", "yoga", "photography"],
        [(10, "Climbing after work")],
        [],
    ),
    (
        "Lucas Meyer",
        "neighbor",
        "Moved in upstairs this year. Talks about hiking and football.",
        ["hiking", "football", "cooking"],
        [],
        [],
    ),
]

MY_MEMORIES: list[MemorySeed] = [
    ("INTEREST", "Hiking", "Happiest on a trail with a thermos of coffee.", ["hiking", "coffee"], SHARED),
    ("INTEREST", "Board games", "Will play anything cooperative.", ["board games"], SHARED),
    ("INTEREST", "Ramen", "Always up for trying a new ramen place.", ["ramen", "food"], SHARED),
    ("INTEREST", "Photography", "Mostly street photos on my phone.", ["photography"], SHARED),
    ("PREFERENCE", "Weekend mornings", "Best time to meet up.", ["mornings"], PRIVATE),
    ("SOCIAL_GOAL", "See old friends more often", "At least one catch-up a week.", [], PRIVATE),
]
MY_GOALS = ["maintain_friendships", "reconnect"]


def _ago(days: int):
    return utcnow() - timedelta(days=days)


def _add_memories(db: Session, user: User, memories: list[MemorySeed]) -> None:
    for category, title, description, tags, visibility in memories:
        db.add(
            Memory(
                user_id=user.id,
                category=category,
                title=title,
                description=description,
                tags=tags,
                visibility=visibility,
                approved_at=utcnow(),
            )
        )


def _me(db: Session, username: str) -> User:
    subject = f"dev|{username}"
    user = db.scalar(select(User).where(User.auth_subject == subject))
    if user is None:
        user = User(auth_subject=subject, display_name=username.capitalize())
        user.profile = UserProfile(social_goals=[], visibility="PRIVATE")
        db.add(user)
        db.flush()
    elif user.profile is None:
        user.profile = UserProfile(social_goals=[], visibility="PRIVATE")
        db.flush()
    return user


def remove(db: Session, me: User | None) -> dict[str, int]:
    """Delete demo users (their connections, hangouts and follow-ups cascade) and the seeded notes."""
    demo_users = db.scalars(select(User).where(User.auth_subject.like(f"{DEMO_PREFIX}%"))).all()
    for user in demo_users:
        db.delete(user)
    removed_people = 0
    if me is not None:
        for name, relationship, *_ in PEOPLE:
            # Name AND relationship must match, so a note you wrote yourself about another Maya stays.
            for person in db.scalars(
                select(Person).where(
                    Person.owner_user_id == me.id, Person.name == name, Person.relationship == relationship
                )
            ).all():
                db.delete(person)
                removed_people += 1
    db.flush()
    return {"demo_users": len(demo_users), "people": removed_people}


def seed(db: Session, me: User) -> dict[str, int]:
    remove(db, me)
    counts = {"connections": 0, "pending_requests": 0, "people": 0, "my_memories": 0}

    has_memories = db.scalar(select(func.count()).select_from(Memory).where(Memory.user_id == me.id)) or 0
    if not has_memories:
        _add_memories(db, me, MY_MEMORIES)
        counts["my_memories"] = len(MY_MEMORIES)
    if not me.profile.social_goals:
        me.profile.social_goals = list(MY_GOALS)

    for username, spec in DEMO_USERS.items():
        friend = User(auth_subject=f"dev|{username}", display_name=spec["name"])
        friend.profile = UserProfile(bio=spec["bio"], social_goals=[], visibility="CONNECTIONS")
        db.add(friend)
        db.flush()
        _add_memories(db, friend, spec["memories"])

        if spec["connected"] is None:
            db.add(ConnectionRequest(sender_user_id=friend.id, recipient_user_id=me.id, status="PENDING"))
            counts["pending_requests"] += 1
            continue

        user_a, user_b = (me.id, friend.id) if str(me.id) < str(friend.id) else (friend.id, me.id)
        connection = Connection(user_a_id=user_a, user_b_id=user_b, created_at=_ago(spec["connected"]))
        db.add(connection)
        db.flush()
        db.add(
            RelationshipEvent(
                connection_id=connection.id,
                event_type="CONNECTED",
                event_data={},
                created_at=_ago(spec["connected"]),
            )
        )
        for days, activity in spec["hangouts"]:
            db.add(
                RelationshipEvent(
                    connection_id=connection.id,
                    event_type="INTERACTION",
                    event_data={"by": str(me.id), "activity": activity},
                    created_at=_ago(days),
                )
            )
        for text in spec["follow_ups"]:
            db.add(FollowUp(owner_user_id=me.id, connection_id=connection.id, text=text))
        counts["connections"] += 1

    for name, relationship, notes, interests, hangouts, follow_ups in PEOPLE:
        person = Person(
            owner_user_id=me.id,
            name=name,
            relationship=relationship,
            notes=notes,
            interests=interests,
            created_at=_ago(max([days for days, _ in hangouts], default=30) + 30),
        )
        db.add(person)
        db.flush()
        for days, activity in hangouts:
            db.add(PersonInteraction(person_id=person.id, activity=activity, created_at=_ago(days)))
        for text in follow_ups:
            db.add(FollowUp(owner_user_id=me.id, person_id=person.id, text=text))
        counts["people"] += 1

    db.flush()
    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed (or remove) Heldly demo data for one dev account.")
    parser.add_argument("--me", required=True, help="your dev sign-in username, e.g. the one used on /dev/login")
    parser.add_argument("--remove", action="store_true", help="remove the demo data instead of adding it")
    args = parser.parse_args(argv)

    settings = get_settings()
    if settings.is_production or settings.auth_mode != "dev":
        print("Refusing to seed: demo data is only for development with AUTH_MODE=dev.", file=sys.stderr)
        return 2
    username = args.me.strip().lower()
    if not USERNAME.match(username) or username.startswith("demo-"):
        print(f"'{args.me}' is not a valid dev username (and must not start with 'demo-').", file=sys.stderr)
        return 2

    init_engine(settings.database_url)
    if settings.database_url.startswith("sqlite"):
        upgrade_to_head(settings.database_url)

    with session_scope() as db:
        if args.remove:
            me = db.scalar(select(User).where(User.auth_subject == f"dev|{username}"))
            removed = remove(db, me)
            print(f"Removed {removed['demo_users']} demo users and {removed['people']} demo notes for '{username}'.")
            return 0
        counts = seed(db, _me(db, username))

    print(
        f"Seeded '{username}': {counts['connections']} connections, {counts['pending_requests']} pending request, "
        f"{counts['people']} notes about people not on Heldly"
        + (
            f", {counts['my_memories']} memories of your own."
            if counts["my_memories"]
            else " (your memories untouched)."
        )
    )
    print("Sign in as that username, then ask ChatGPT to open Heldly. Start a new chat to see the changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
