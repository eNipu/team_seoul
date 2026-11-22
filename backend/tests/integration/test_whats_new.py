"""venn_whats_new: fresh signals friends chose to share, matched to the user's memories, as plain text."""

from datetime import timedelta

from app.db.database import session_scope
from app.models import Memory
from app.models._base import utcnow
from tests.integration.test_social_flow import connect, save


def _text(user, **args) -> str:
    result = user.call("venn_whats_new", **args)
    assert not result.get("isError"), result
    return result["content"][0]["text"]


def test_tool_is_model_only_read_without_a_card(alice):
    tools = {t["name"]: t for t in alice.rpc("tools/list").json()["result"]["tools"]}
    tool = tools["venn_whats_new"]
    assert tool["annotations"]["readOnlyHint"] is True
    assert tool["annotations"]["destructiveHint"] is False
    meta = tool["_meta"]
    assert meta["ui"] == {"visibility": ["model"]}
    assert "resourceUri" not in meta["ui"]
    assert "openai/outputTemplate" not in meta
    assert "openai/widgetAccessible" not in meta


def test_in_town_signal_matched_to_my_interests(alice, bob):
    save(alice, "INTEREST", "Marketing", "Love brand marketing", "PRIVATE", tags=["marketing"])
    save(alice, "PERSONAL_MEMORY", "Lived in Berlin", "Spent two years in Berlin", "PRIVATE")
    save(bob, "INTEREST", "Marketing", "Growth marketing nerd", "SHARED_WITH_CONNECTIONS", tags=["marketing"])
    save(bob, "EXPERIENCE", "In Berlin this month", "Working from Berlin until June", "SHARED_WITH_CONNECTIONS")
    conn = connect(alice, bob)

    view = alice.ok("venn_whats_new")
    assert "view" not in view  # no widget view
    [signal] = view["signals"]
    assert signal["connection_id"] == conn
    assert signal["kind"] == "in_town"
    assert signal["signal"] == "is in Berlin right now"
    assert "berlin" in signal["matched"]
    assert (
        signal["line"]
        == "Btw, Bob is in Berlin right now and is into marketing. I think you should reconnect while they're around."
    )

    text = _text(alice)
    assert "Bob is in Berlin right now" in text
    assert "at most two plain sentences" in text
    assert "No card, no draft" in text


def test_private_and_unmatched_signals_are_never_used(alice, bob):
    save(alice, "INTEREST", "Photography", "Film cameras", "PRIVATE", tags=["photography"])
    save(bob, "WORK", "Photography startup", "Building a photography app", "PRIVATE", tags=["photography"])
    save(bob, "INTEREST", "Knitting", "Knits scarves", "SHARED_WITH_CONNECTIONS")
    connect(alice, bob)
    view = alice.ok("venn_whats_new")
    assert view["signals"] == []
    assert "Say nothing about Venn" in _text(alice)

    save(bob, "WORK", "Photography app", "Building a photography app", "SHARED_WITH_CONNECTIONS", tags=["photography"])
    [signal] = alice.ok("venn_whats_new")["signals"]
    assert signal["kind"] == "working_on"
    assert signal["shared_title"] == "Photography app"
    assert signal["recommendation"] == "swap notes on photography"


def test_stale_signals_and_strangers_are_ignored(alice, bob, carol):
    save(alice, "INTEREST", "Climbing", "Bouldering on weekends", "PRIVATE", tags=["climbing"])
    save(
        bob,
        "SOCIAL_GOAL",
        "Looking for a climbing partner",
        "Anyone to climb with?",
        "SHARED_WITH_CONNECTIONS",
        tags=["climbing"],
    )
    save(carol, "SOCIAL_GOAL", "Looking for a climbing buddy", "Weekday evenings", "PUBLIC_PROFILE", tags=["climbing"])
    connect(alice, bob)  # carol is not connected

    [signal] = alice.ok("venn_whats_new")["signals"]
    assert signal["display_name"] == "Bob"
    assert signal["kind"] == "looking_for"
    assert signal["signal"] == "is looking for a climbing partner"

    with session_scope() as db:
        for m in db.query(Memory).all():
            m.created_at = m.updated_at = m.approved_at = utcnow() - timedelta(days=40)
    assert alice.ok("venn_whats_new")["signals"] == []
    assert len(alice.ok("venn_whats_new", days=60)["signals"]) == 1


def test_needs_connections(alice):
    assert alice.ok("venn_whats_new")["signals"] == []
