"""People notes (friends who are not on Venn) and the friend-facing views."""

from datetime import timedelta

from app.db.database import session_scope
from app.models import Connection, Person, PersonInteraction
from app.models._base import utcnow
from tests.integration.test_social_flow import connect, save


def add(user, name="Maya", **kwargs) -> dict:
    return user.ok("venn_add_person", name=name, **kwargs)


def test_add_list_update_delete_person(alice):
    maya = add(
        alice, relationship="  college   roommate ", notes="Moved to Busan.", interests=["Hiking", "hiking", " Jazz "]
    )
    assert maya["name"] == "Maya"
    assert maya["relationship"] == "college roommate"
    assert maya["interests"] == ["Hiking", "Jazz"]  # de-duplicated, trimmed
    assert maya["last_interaction_at"] is None

    listed = alice.ok("venn_list_people")
    assert listed["count"] == 1
    assert listed["people"][0]["person_id"] == maya["person_id"]

    updated = alice.ok("venn_update_person", person_id=maya["person_id"], notes="", interests=["Climbing"])
    assert updated["notes"] is None  # empty string clears
    assert updated["relationship"] == "college roommate"  # omitted fields are kept
    assert updated["interests"] == ["Climbing"]

    assert alice.ok("venn_delete_person", person_id=maya["person_id"]) == {
        "deleted": True,
        "person_id": maya["person_id"],
    }
    assert alice.ok("venn_list_people")["people"] == []


def test_people_appear_on_dashboard(alice):
    maya = add(alice)
    view = alice.ok("venn_show_dashboard")
    assert view["view"] == "dashboard"
    assert [p["person_id"] for p in view["people"]] == [maya["person_id"]]


def test_view_person(alice):
    save(alice, "INTEREST", "Hiking", "Loves hiking on weekends", "PRIVATE", ["hiking"])
    maya = add(alice, relationship="cousin", notes="Has a dog called Bori.", interests=["Hiking", "Pottery"])
    alice.ok("venn_log_interaction", person_id=maya["person_id"], activity="Dinner")

    view = alice.ok("venn_view_friend", person_id=maya["person_id"])
    assert (view["view"], view["kind"], view["id"]) == ("friend", "person", maya["person_id"])
    assert view["on_venn"] is False
    assert view["relationship"] == "cousin"
    assert view["notes"] == "Has a dog called Bori."
    assert view["interests"] == ["Hiking", "Pottery"]
    assert view["shared_interests"] == ["hiking"]
    assert view["shared_memories"] == []
    assert [i["activity"] for i in view["recent_interactions"]] == ["Dinner"]
    assert view["last_interaction_at"] is not None


def test_view_connection_shows_only_what_they_shared(alice, bob):
    connection_id = connect(alice, bob)
    save(alice, "INTEREST", "Climbing", "Climbs weekly", "PRIVATE", ["climbing"])
    save(bob, "INTEREST", "Climbing", "Loves the climbing gym", "SHARED_WITH_CONNECTIONS", ["climbing"])
    save(bob, "PERSONAL_MEMORY", "Secret diary", "Nobody should read this", "PRIVATE", ["diary"])
    bob.ok("venn_update_profile", bio="Bob's private bio")

    view = alice.ok("venn_view_friend", connection_id=connection_id)
    assert (view["kind"], view["id"], view["display_name"]) == ("connection", connection_id, "Bob")
    assert view["on_venn"] is True
    assert view["interests"] == ["Climbing"]
    assert view["shared_interests"] == ["climbing"]
    assert [m["title"] for m in view["shared_memories"]] == ["Climbing"]
    assert view["bio"] is None  # Bob's profile is PRIVATE by default
    assert "diary" not in str(view).lower()

    bob.ok("venn_update_profile", profile_visibility="CONNECTIONS")
    assert alice.ok("venn_view_friend", connection_id=connection_id)["bio"] == "Bob's private bio"


def test_stopwords_are_not_shared_interests(alice, bob):
    connection_id = connect(alice, bob)
    save(alice, "INTEREST", "Loves really long walks", "x", "SHARED_WITH_CONNECTIONS")
    save(bob, "INTEREST", "Loves really spicy food", "y", "SHARED_WITH_CONNECTIONS")
    out = alice.ok("venn_suggest_activity", connection_id=connection_id)
    assert out["shared_interests"] == []
    # Still grounded in what Bob shared, without claiming it is shared.
    assert out["suggestions"][0]["title"] == "Try a new place to eat"


def test_suggest_activity_for_person(alice):
    save(alice, "INTEREST", "Board games", "Plays most weekends", "PRIVATE", ["games"])
    maya = add(alice, interests=["Board games", "Baking"])
    out = alice.ok("venn_suggest_activity", person_id=maya["person_id"])
    assert (out["view"], out["kind"], out["id"], out["display_name"]) == (
        "activity_ideas",
        "person",
        maya["person_id"],
        "Maya",
    )
    assert "board games" in out["shared_interests"]
    assert out["suggestions"][0]["title"] == "Game night"
    assert 0 < out["match_score"] <= 1
    assert len(out["suggestions"]) <= 3


def test_friend_tools_need_exactly_one_id(alice, bob):
    connection_id = connect(alice, bob)
    maya = add(alice)
    for tool in ("venn_view_friend", "venn_suggest_activity", "venn_log_interaction"):
        assert alice.err(tool).startswith("INVALID_REQUEST")
        assert alice.err(tool, connection_id=connection_id, person_id=maya["person_id"]).startswith("INVALID_REQUEST")


def test_reconnection_covers_people_and_connections(alice, bob):
    connect(alice, bob)
    maya = add(alice, last_met_days_ago=60)
    recent = add(alice, name="Jun", last_met_days_ago=2)
    old_no_log = add(alice, name="Sora")
    with session_scope() as db:
        for conn in db.query(Connection).all():
            conn.created_at = utcnow() - timedelta(days=30)
        db.get(Person, __import__("uuid").UUID(old_no_log["person_id"])).created_at = utcnow() - timedelta(days=45)

    out = alice.ok("venn_reconnection_suggestions")
    assert out["view"] == "reconnect"
    assert out["min_days"] == 21
    assert [(c["kind"], c["display_name"], c["days_since_last_interaction"]) for c in out["candidates"]] == [
        ("person", "Maya", 60),
        ("person", "Sora", 45),
        ("connection", "Bob", 30),
    ]
    assert recent["person_id"] not in [c["id"] for c in out["candidates"]]

    logged = alice.ok("venn_log_interaction", person_id=maya["person_id"], activity="Ramen")
    assert (logged["recorded"], logged["kind"], logged["id"]) == (True, "person", maya["person_id"])
    names = [c["display_name"] for c in alice.ok("venn_reconnection_suggestions")["candidates"]]
    assert names == ["Sora", "Bob"]
    assert alice.ok("venn_reconnection_suggestions", min_days=50)["candidates"] == []


def test_invite_card_and_revoke(alice, bob):
    invite = alice.ok("venn_create_invite", max_uses=1)
    assert invite["view"] == "invite"
    assert invite["max_uses"] == 1
    assert invite["code"] in invite["share_text"]
    assert alice.ok("venn_revoke_invite", code=invite["code"]) == {"revoked": True}
    assert bob.err("venn_redeem_invite", code=invite["code"]).startswith("NOT_FOUND")


def test_deleting_account_deletes_people(alice):
    maya = add(alice, last_met_days_ago=3)
    assert maya["last_interaction_at"] is not None
    alice.ok("venn_delete_account", confirmation="DELETE MY VENN ACCOUNT")
    with session_scope() as db:
        assert db.query(Person).count() == 0
        assert db.query(PersonInteraction).count() == 0
