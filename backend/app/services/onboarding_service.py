"""Plugin progress derives from surviving records, never previews or dashboard reads."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Memory, Person, User
from app.models._base import as_aware, utcnow
from app.schemas.onboarding import InterestMatchesView, InterestMatchResult, OnboardingState
from app.services import memory_service, social_service
from app.services.errors import InvalidRequest
from app.services.interest_matching import match_interests, my_interest_labels

_PLATFORMS = ("instagram", "linkedin")


def state_sync(db: Session, user: User) -> OnboardingState:
    first_memory = as_aware(
        db.scalar(
            select(func.min(Memory.approved_at)).where(
                Memory.user_id == user.id, Memory.source.is_distinct_from("sample")
            )
        )
    )
    first_import = as_aware(
        db.scalar(
            select(func.min(Person.created_at)).where(
                Person.owner_user_id == user.id, Person.import_platform.in_(_PLATFORMS)
            )
        )
    )
    reviewed = as_aware(user.matches_reviewed_at)
    # Replacing a deleted prerequisite cannot revive a lookup made before its replacement.
    return OnboardingState(
        memories_ready=first_memory is not None,
        contacts_ready=first_import is not None,
        matches_reviewed=bool(
            reviewed and first_memory and first_import and max(first_memory, first_import) <= reviewed
        ),
    )


def find_matches_sync(db: Session, user: User, limit: int = 10) -> InterestMatchesView:
    if not 1 <= limit <= 20:
        raise InvalidRequest("Choose a limit between 1 and 20.")
    progress = state_sync(db, user)
    if not progress.memories_ready or not progress.contacts_ready:
        raise InvalidRequest("Approve a memory and confirm an Instagram or LinkedIn contact import first.")
    mine = my_interest_labels(db, user)
    matches = []
    if mine:
        for person in db.scalars(
            select(Person).where(Person.owner_user_id == user.id, Person.import_platform.in_(_PLATFORMS))
        ):
            if evidence := match_interests(mine, person.interests or []):
                matches.append(
                    InterestMatchResult(
                        kind="person", id=str(person.id), display_name=person.name, interest_matches=evidence
                    )
                )
        # The connection list is owner-scoped and excludes blocks in either direction.
        for conn in social_service.list_connections(db, user).connections:
            if conn.is_sample:
                continue
            visible = memory_service.visible_memories_of(db, UUID(conn.user_id), connected=True)
            labels = (
                label
                for m in visible
                if m.category == "INTEREST" and not m.people and m.source != "sample"
                for label in (m.title, *(m.tags or []))
            )
            if evidence := match_interests(mine, labels):
                matches.append(
                    InterestMatchResult(
                        kind="connection",
                        id=conn.connection_id,
                        display_name=conn.display_name,
                        interest_matches=evidence,
                    )
                )
    matches.sort(key=lambda m: (m.interest_matches[0].kind != "exact", m.display_name.casefold(), m.kind, m.id))
    result = InterestMatchesView(matches=matches[:limit])
    user.matches_reviewed_at = utcnow()
    db.flush()
    return result
