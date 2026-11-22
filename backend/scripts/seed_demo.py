"""Fill a development account with the sample circle from the command line.

    make seed me=<dev username>          # add (or refresh) the sample friends
    make seed-remove me=<dev username>   # take them out again

`<dev username>` is the name you sign in with (AUTH_MODE=dev). This is the same sample circle a user
gets from "Try with sample friends" on the welcome card or the website (`app/services/sample_service.py`);
the script additionally sets two social goals when the account has none.

Running it again replaces the sample data; your own memories, notes and connections are untouched.
The command refuses to run in production or with real (non-dev) sign-in, because it creates the
account for a username that has never signed in.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db.database import init_engine, session_scope  # noqa: E402
from app.db.migrate import upgrade_to_head  # noqa: E402
from app.models import User, UserProfile  # noqa: E402
from app.services import sample_service  # noqa: E402

USERNAME = re.compile(r"^[a-z0-9][a-z0-9_.-]{1,31}$")
MY_GOALS = ["maintain_friendships", "reconnect"]


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
    if me is None:
        return {"friends": 0, "people": 0, "memories": 0}
    removed = sample_service.remove(db, me)
    return {"friends": removed.friends, "people": removed.people, "memories": removed.memories}


def seed(db: Session, me: User) -> dict[str, int]:
    # The dev command explicitly refreshes all sample data; in-app loading does not.
    sample_service.remove(db, me)
    loaded = sample_service.load(db, me)
    if not me.profile.social_goals:
        me.profile.social_goals = list(MY_GOALS)
        db.flush()
    return {
        "connections": loaded.connections,
        "pending_requests": loaded.pending_requests,
        "people": loaded.people,
        "my_memories": loaded.memories_added,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Add (or remove) the Venn sample circle for one dev account.")
    parser.add_argument("--me", required=True, help="your dev sign-in username")
    parser.add_argument("--remove", action="store_true", help="remove the sample data instead of adding it")
    args = parser.parse_args(argv)

    settings = get_settings()
    if settings.is_production or settings.auth_mode != "dev":
        print("Refusing to seed: this command is only for development with AUTH_MODE=dev.", file=sys.stderr)
        return 2
    username = args.me.strip().lower()
    if not USERNAME.match(username):
        print(f"'{args.me}' is not a valid dev username.", file=sys.stderr)
        return 2

    init_engine(settings.database_url)
    if settings.database_url.startswith("sqlite"):
        upgrade_to_head(settings.database_url)

    with session_scope() as db:
        if args.remove:
            me = db.scalar(select(User).where(User.auth_subject == f"dev|{username}"))
            removed = remove(db, me)
            print(
                f"Removed {removed['friends']} sample friends, {removed['people']} sample notes and "
                f"{removed['memories']} sample memories for '{username}'."
            )
            return 0
        counts = seed(db, _me(db, username))

    print(
        f"Seeded '{username}': {counts['connections']} connections, {counts['pending_requests']} pending request, "
        f"{counts['people']} notes about people not on Venn"
        + (
            f", {counts['my_memories']} sample memories of your own."
            if counts["my_memories"]
            else " (your memories untouched)."
        )
    )
    print("Sign in as that username on the website, or ask ChatGPT to open Venn in a new chat.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
