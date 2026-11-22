"""Aggregated, owner-only view models for the widget's home screen."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import User
from app.schemas.profile import SocialGoal
from app.schemas.social import (
    DashboardView,
    GoalOption,
    HelpTopic,
    HelpView,
    PluginDashboardView,
    PluginHelpView,
    PluginWelcomeView,
    SetupStep,
    WelcomeView,
)
from app.services import (
    memory_service,
    onboarding_service,
    people_service,
    plan_service,
    question_service,
    sample_service,
    social_service,
    user_service,
)

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
        "Connect your AI memories",
        "One tap. Saved privately.",
        "Connect your AI memories: when the user taps Connect, call venn_propose_memories at once with "
        'source "chatgpt_memory", quick_import: true and everything you remember about them (up to 30; never '
        "health, money, credentials or ID numbers). Do not list them in chat first; the card saves them "
        "privately and offers Review. If you remember nothing, ask one short question about them instead.",
    ),
    _Step(
        "your_people",
        "Import contacts",
        "From LinkedIn, Instagram or a list.",
        "Import contacts: the user uploads a LinkedIn or Instagram export or pastes names -> "
        "venn_propose_people_import; they confirm on the card. Never infer interests from names or job titles. "
        "If the user picked Partner on the welcome card, do Invite someone first.",
    ),
    _Step(
        "connect",
        "Invite someone",
        "Share a link to Venn.",
        "Invite someone: create an invite (venn_create_invite; the user shares the link, code "
        "or QR themselves), or redeem a code they were given (venn_redeem_invite).",
    ),
)


def _setup(db: Session, user: User, dashboard: DashboardView) -> list[SetupStep]:
    """Each step is done when the data it produces exists; nothing extra is stored for set-up.

    Sample data (the "try with sample friends" circle) never counts: it is not the user's own.
    """
    invited = any(i["active"] or i["use_count"] for i in social_service.list_invites(db, user))
    memories = [m for m in dashboard.memories if m.get("source") != memory_service.SAMPLE]
    people = [p for p in dashboard.people if not p.get("is_sample")]
    connections = [c for c in dashboard.connections if not c.get("is_sample")]
    requests = [r for r in dashboard.pending_requests if not r.get("is_sample")]
    done = {
        "about_you": bool(memories),
        "your_people": bool(people or connections),
        "connect": bool(connections or requests or invited),
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
        plans=[p.model_dump(mode="json") for p in plan_service.list_plans(db, user, "planned").plans],
        pending_answers=question_service.pending_count(db, user),
        sample_loaded=sample_service.is_loaded(db, user),
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
        or dashboard.plans
        or dashboard.pending_answers
    )
    if not empty:
        return dashboard
    return WelcomeView(
        display_name=dashboard.profile["display_name"],
        goal_options=[GoalOption(value=goal.value, label=label) for goal, label in GOAL_LABELS.items()],
        setup=dashboard.setup,
    )


def plugin_home(db: Session, user: User) -> PluginDashboardView | PluginWelcomeView:
    home = build_home(db, user)
    cls = PluginWelcomeView if isinstance(home, WelcomeView) else PluginDashboardView
    return cls(**home.model_dump(), onboarding=onboarding_service.state_sync(db, user))


def plugin_help(db: Session, user: User) -> PluginHelpView:
    return PluginHelpView(**build_help(db, user).model_dump(), onboarding=onboarding_service.state_sync(db, user))


def setup_guidance(setup: list[SetupStep], *, start: bool = True) -> str:
    """What to do about optional set-up on home or in help; empty when set-up is complete."""
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
        f"Set-up is not finished (open: {names}). Start the first open step only if the user asked for "
        f"set-up. Otherwise let them choose an action on the card. {todo[open_steps[0]]} "
        "Once in set-up, move to the next open step when they finish or skip one."
    )


# ----------------------------------------------------------------------- help

HELP_TOPICS: tuple[HelpTopic, ...] = (
    HelpTopic(
        key="setup",
        title="Getting set up",
        description="Three short steps: connect your AI memories, import contacts, invite someone.",
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
        description=(
            "Add friends who are not on Venn, one at a time or a whole list, then ask who comes to mind for "
            "something. Notes stay private to you."
        ),
        examples=[
            "Who do I know who'd enjoy a photo walk?",
            "Import my friends into Venn",
        ],
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
            "Venn quietly tells you when a friend is nearby, working on something you care about, or "
            "looking for what you have, from what they chose to share."
        ),
        examples=[
            "What's new with my people?",
            "What do I have in common with a friend?",
            "I'm seeing a friend tomorrow — brief me",
        ],
    ),
)

HELP_PRIVACY: tuple[str, ...] = (
    "Nothing is saved until you approve it.",
    "Memories are private unless you choose to share them.",
    "Venn never contacts anyone for you. It only tells you; reaching out is up to you.",
    "What you save to Venn is there in ChatGPT and on the Venn website. "
    "Your ChatGPT chats and ChatGPT's own memory are not synced.",
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
