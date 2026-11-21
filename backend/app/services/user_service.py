"""User identity resolution and profile management."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Memory, User, UserProfile
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.services import analytics


def get_or_create_user(db: Session, auth_subject: str, display_name_hint: str | None = None) -> tuple[User, bool]:
    """Resolve (or provision) the Heldly user for a validated token subject."""
    user = db.scalar(select(User).where(User.auth_subject == auth_subject))
    if user:
        return user, False
    name = (display_name_hint or "").strip()[:60] or None
    user = User(auth_subject=auth_subject, display_name=name)
    user.profile = UserProfile(social_goals=[], visibility="PRIVATE")
    db.add(user)
    db.flush()
    analytics.track(db, "profile_created", user.id)
    return user, True


def display_name(user: User | None) -> str:
    if user is None:
        return "Someone"
    return user.display_name or "A Heldly friend"


def _ensure_profile(db: Session, user: User) -> UserProfile:
    if user.profile is None:
        user.profile = UserProfile(social_goals=[], visibility="PRIVATE")
        db.flush()
    return user.profile


def get_profile(db: Session, user: User, is_new: bool = False) -> ProfileOut:
    profile = _ensure_profile(db, user)
    interests = db.scalars(
        select(Memory.title).where(Memory.user_id == user.id, Memory.category == "INTEREST").order_by(Memory.created_at)
    ).all()
    count = db.scalar(select(func.count()).select_from(Memory).where(Memory.user_id == user.id)) or 0
    return ProfileOut(
        user_id=str(user.id),
        display_name=display_name(user),
        bio=profile.bio,
        social_goals=list(profile.social_goals or []),
        interests=list(interests),
        memory_count=count,
        profile_visibility=profile.visibility,
        is_new=is_new or count == 0,
    )


def update_profile(db: Session, user: User, update: ProfileUpdate) -> ProfileOut:
    profile = _ensure_profile(db, user)
    if update.display_name is not None:
        user.display_name = update.display_name.strip()
    if update.bio is not None:
        profile.bio = update.bio.strip() or None
    if update.social_goals is not None:
        profile.social_goals = [g.value for g in update.social_goals]
    if update.profile_visibility is not None:
        profile.visibility = update.profile_visibility.value
    db.flush()
    return get_profile(db, user)


def delete_account(db: Session, user: User) -> None:
    """Delete the user and (via ON DELETE CASCADE) all owned data."""
    db.delete(user)
    db.flush()
