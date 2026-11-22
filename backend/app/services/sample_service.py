"""A made-up circle of friends, so a new account can see every card without anyone else signing up.

`load` adds sample Venn users (connected to the caller, with things they "shared", past hangouts and
one pending request), private notes about people who are not on Venn, and — only when the account has
no memories yet — a few memories of the caller's own. `remove` takes all of it out again.

Everything is tagged so it can be told apart from real data and removed exactly:

- sample users have the auth subject `sample|<owner id>|<slug>`: nobody can sign in as them, and they
  belong to one account, so removing one person's sample circle never touches another's;
- sample notes have `people.is_sample`;
- sample memories have `memories.source = "sample"`.

Anything the user adds themselves is never tagged and therefore never removed.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
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
from app.models._base import utcnow
from app.schemas.social import SampleLoadedOut, SampleRemovedOut
from app.services import analytics, people_service
from app.services.user_service import SAMPLE_SUBJECT_PREFIX

SOURCE = "sample"
SHARED = "SHARED_WITH_CONNECTIONS"
PRIVATE = "PRIVATE"

# (category, title, description, tags, visibility)
MemorySeed = tuple[str, str, str, list[str], str]

# slug -> name, bio, connected days ago (None = pending request), hangouts (days ago, activity), memories
SAMPLE_USERS: dict[str, dict] = {
    "jun": {
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
    "hana": {
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
    "diego": {
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
    "sofia": {
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


def _prefix(owner: User) -> str:
    return f"{SAMPLE_SUBJECT_PREFIX}{owner.id}|"


def _ago(days: int):
    return utcnow() - timedelta(days=days)


def _add_memories(db: Session, user: User, memories: list[MemorySeed], source: str | None = None) -> None:
    for category, title, description, tags, visibility in memories:
        db.add(
            Memory(
                user_id=user.id,
                category=category,
                title=title,
                description=description,
                tags=tags,
                visibility=visibility,
                source=source,
                approved_at=utcnow(),
            )
        )


def sample_users(db: Session, owner: User) -> list[User]:
    return list(db.scalars(select(User).where(User.auth_subject.like(f"{_prefix(owner)}%"))).all())


def is_loaded(db: Session, owner: User) -> bool:
    if db.scalar(select(User.id).where(User.auth_subject.like(f"{_prefix(owner)}%")).limit(1)):
        return True
    return bool(
        db.scalar(select(Person.id).where(Person.owner_user_id == owner.id, Person.is_sample.is_(True)).limit(1))
    )


def remove(db: Session, owner: User) -> SampleRemovedOut:
    """Delete the caller's sample circle and discard pending demo imports."""
    people_service.lock_people_writes(db, owner)
    people_service.clear_demo_previews(db, owner)
    friends = sample_users(db, owner)
    for friend in friends:
        db.delete(friend)
    people = db.scalars(select(Person).where(Person.owner_user_id == owner.id, Person.is_sample.is_(True))).all()
    for person in people:
        db.delete(person)
    memories = db.scalars(select(Memory).where(Memory.user_id == owner.id, Memory.source == SOURCE)).all()
    for memory in memories:
        db.delete(memory)
    db.flush()
    return SampleRemovedOut(removed=True, friends=len(friends), people=len(people), memories=len(memories))


def load(db: Session, owner: User) -> SampleLoadedOut:
    """Add the sample circle (replacing an earlier copy). The caller's own data is left alone."""
    remove(db, owner)
    out = SampleLoadedOut(loaded=True, connections=0, people=0, pending_requests=0, memories_added=0)

    has_memories = db.scalar(select(func.count()).select_from(Memory).where(Memory.user_id == owner.id)) or 0
    if not has_memories:
        _add_memories(db, owner, MY_MEMORIES, source=SOURCE)
        out.memories_added = len(MY_MEMORIES)

    for slug, spec in SAMPLE_USERS.items():
        friend = User(auth_subject=f"{_prefix(owner)}{slug}", display_name=spec["name"])
        friend.profile = UserProfile(bio=spec["bio"], social_goals=[], visibility="CONNECTIONS")
        db.add(friend)
        db.flush()
        _add_memories(db, friend, spec["memories"])

        if spec["connected"] is None:
            db.add(ConnectionRequest(sender_user_id=friend.id, recipient_user_id=owner.id, status="PENDING"))
            out.pending_requests += 1
            continue

        user_a, user_b = (owner.id, friend.id) if str(owner.id) < str(friend.id) else (friend.id, owner.id)
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
                    event_data={"by": str(owner.id), "activity": activity},
                    created_at=_ago(days),
                )
            )
        for text in spec["follow_ups"]:
            db.add(FollowUp(owner_user_id=owner.id, connection_id=connection.id, text=text))
        out.connections += 1

    for name, relationship, notes, interests, hangouts, follow_ups in PEOPLE:
        person = Person(
            owner_user_id=owner.id,
            name=name,
            relationship=relationship,
            notes=notes,
            interests=interests,
            is_sample=True,
            created_at=_ago(max([days for days, _ in hangouts], default=30) + 30),
        )
        db.add(person)
        db.flush()
        for days, activity in hangouts:
            db.add(PersonInteraction(person_id=person.id, activity=activity, created_at=_ago(days)))
        for text in follow_ups:
            db.add(FollowUp(owner_user_id=owner.id, person_id=person.id, text=text))
        out.people += 1

    db.flush()
    analytics.track(db, "sample_loaded", owner.id)
    return out
