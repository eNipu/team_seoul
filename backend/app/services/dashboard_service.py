"""Aggregated, owner-only view models for the widget's home screen."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import User
from app.schemas.profile import SocialGoal
from app.schemas.social import DashboardView, GoalOption, HelpTopic, HelpView, SetupStep, WelcomeView
from app.services import memory_service, people_service, social_service, user_service

GOAL_LABELS: dict[SocialGoal, str] = {
    SocialGoal.make_friends: "Make new friends",
    SocialGoal.maintain_friendships: "Keep up with friends",
    SocialGoal.deepen_relationships: "Deepen relationships",
    SocialGoal.find_activity_partners: "Find activity partners",
    SocialGoal.reconnect: "Reconnect with old friends",
    SocialGoal.meet_people_with_shared_interests: "Meet people with shared interests",
}


@dataclass(frozen=True)
class _Step:
    key: str
    title: str
    description: str
    guidance: str
    """What the assistant should do for this step. Sent to the model, never shown to the user."""


# Set-up, in the order a new user is walked through it.
SETUP_STEPS: tuple[_Step, ...] = (
    _Step(
        "about_you",
        "Tell Venn about you",
        "Bring over what ChatGPT already remembers, or answer a couple of questions.",
        "About you: offer to bring over what you already remember about them (venn_import_chatgpt_memory), "
        "or ask what they enjoy and what they avoid and call venn_propose_memories with their answers.",
    ),
    _Step(
        "your_people",
        "Add your people",
        "Paste a list, upload your contacts, or name a few friends.",
        "Your people: ask who they want to stay close to - they can paste a list of names, upload a contacts "
        "export or just name a few people - then call venn_propose_people_import.",
    ),
    _Step(
        "connect",
        "Connect with friends",
        "Share an invite so friends on ChatGPT can connect with you.",
        "Connect: offer an invite for friends who use ChatGPT (venn_create_invite; the user shares the code, "
        "link or QR themselves), or redeem a code they were given (venn_redeem_invite).",
    ),
)


def _setup(db: Session, user: User, dashboard: DashboardView) -> list[SetupStep]:
    """Each step is done when the data it produces exists; nothing extra is stored for set-up."""
    invited = any(i["active"] or i["use_count"] for i in social_service.list_invites(db, user))
    done = {
        "about_you": bool(dashboard.memories),
        "your_people": bool(dashboard.people or dashboard.connections),
        "connect": bool(dashboard.connections or dashboard.pending_requests or invited),
    }
    return [SetupStep(key=s.key, title=s.title, description=s.description, done=done[s.key]) for s in SETUP_STEPS]


def build_dashboard(db: Session, user: User) -> DashboardView:
    profile = user_service.get_profile(db, user)
    memories = memory_service.list_memories(db, user, limit=200).memories
    connections = social_service.list_connections(db, user).connections
    people = people_service.list_people(db, user).people
    pending = social_service.pending_requests(db, user).incoming
    dashboard = DashboardView(
        profile=profile.model_dump(mode="json", exclude={"is_new"}),
        memories=[m.model_dump(mode="json") for m in memories],
        connections=[c.model_dump(mode="json") for c in connections],
        people=[p.model_dump(mode="json") for p in people],
        pending_requests=[p.model_dump(mode="json") for p in pending],
    )
    dashboard.setup = _setup(db, user, dashboard)
    return dashboard


def build_home(db: Session, user: User) -> DashboardView | WelcomeView:
    """Welcome card for an account with nothing in it yet, otherwise the dashboard."""
    dashboard = build_dashboard(db, user)
    empty = not (
        dashboard.memories
        or dashboard.connections
        or dashboard.people
        or dashboard.pending_requests
        or dashboard.profile["social_goals"]
    )
    if not empty:
        return dashboard
    return WelcomeView(
        display_name=dashboard.profile["display_name"],
        goal_options=[GoalOption(value=goal.value, label=label) for goal, label in GOAL_LABELS.items()],
        setup=dashboard.setup,
    )


def setup_guidance(setup: list[SetupStep], *, start: bool = True) -> str:
    """What the assistant should do next about set-up; empty when set-up is complete.

    `start=False` is for replies that answer something else first (help): offer set-up, don't begin it.
    """
    open_steps = [s.key for s in setup if not s.done]
    if not open_steps:
        return ""
    todo = {s.key: s.guidance for s in SETUP_STEPS}
    names = ", ".join(key.replace("_", " ") for key in open_steps)
    if not start:
        return (
            f"Set-up is not finished (open: {names}). Offer, in one line, to continue with the first open "
            f"step. {todo[open_steps[0]]}"
        )
    return (
        f"Set-up is not finished (open: {names}). Unless the user asked for something specific, start the "
        f"first open step in this same reply, with one short question and no feature list. {todo[open_steps[0]]} "
        "When a step is done or the user skips it, go straight to the next open one."
    )


# ----------------------------------------------------------------------- help

HELP_TOPICS: tuple[HelpTopic, ...] = (
    HelpTopic(
        key="setup",
        title="Getting set up",
        description="Three short steps: tell Venn about you, add your people, connect with friends.",
        examples=["Set up Venn"],
    ),
    HelpTopic(
        key="memories",
        title="Remember what matters to you",
        description="Venn suggests memories from what you say; you choose what to keep and who can see it.",
        examples=[
            "Remember that I love bouldering and ramen",
            "Import my ChatGPT memory into Venn",
            "What did I save about food?",
        ],
    ),
    HelpTopic(
        key="people",
        title="Keep notes on your people",
        description=("Add friends who are not on Venn, one at a time or a whole list. Notes stay private to you."),
        examples=["Import my friends into Venn", "Who do I know who likes hiking?"],
    ),
    HelpTopic(
        key="connect",
        title="Connect with friends on Venn",
        description="Share an invite code, link or QR. Friends accept before you are connected.",
        examples=["Create a Venn invite", "I have a Venn invite code"],
    ),
    HelpTopic(
        key="stay_close",
        title="Stay close",
        description=(
            "Ideas for time together, a brief before you meet, a recap after, and nudges when it has been a while."
        ),
        examples=[
            "Who should I reconnect with?",
            "Plan something with a few friends",
            "I'm seeing a friend tomorrow — brief me",
        ],
    ),
    HelpTopic(
        key="quiz",
        title="Play",
        description="A quick quiz on how well you know your friends, from what they chose to share.",
        examples=["Play the Venn quiz"],
    ),
)

HELP_PRIVACY: tuple[str, ...] = (
    "Nothing is saved until you approve it.",
    "Memories are private unless you choose to share them.",
    "Venn never contacts anyone for you.",
    "You can edit or delete anything, or delete your whole account.",
)


def build_help(db: Session, user: User) -> HelpView:
    dashboard = build_dashboard(db, user)
    return HelpView(
        display_name=dashboard.profile["display_name"],
        topics=list(HELP_TOPICS),
        setup=dashboard.setup,
        privacy=list(HELP_PRIVACY),
    )
