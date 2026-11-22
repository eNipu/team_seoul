"""Demo imports are private review flows, not social account imports."""

import pytest

from app.config import ALL_SCOPES
from app.mcp.common import CONNECTIONS
from app.services import instagram_demo, linkedin_demo
from app.services.people_service import MAX_INTEREST_LEN, MAX_INTERESTS


@pytest.mark.parametrize("fixture", [instagram_demo, linkedin_demo])
def test_demo_profiles_have_stable_review_ready_interests(fixture):
    profiles = fixture.candidates()
    assert profiles == fixture.candidates()
    assert len(profiles) == 100
    for profile in profiles:
        labels = profile.interests
        assert 5 <= len(labels) <= MAX_INTERESTS
        assert len({label.casefold() for label in labels}) == len(labels)
        assert all(label == label.strip() and 0 < len(label) <= MAX_INTEREST_LEN for label in labels)


def preview(client, platform):
    result = client.call("venn_preview_demo_people_import", platform=platform)
    assert not result.get("isError"), result["content"]
    card = result["structuredContent"]
    token = result["_meta"]["venn/demoImportConfirmation"]
    assert len(token) == 43
    assert token not in str(card) and token not in str(result["content"])
    return card, {"import_id": card["import_id"], "confirmation_token": token}


@pytest.mark.parametrize("platform", ["instagram", "linkedin"])
def test_preview_then_add_all_sample_profiles(alice, bob, platform):
    card, confirm = preview(alice, platform)
    assert card["view"] == "people_import" and card["demo_platform"] == platform
    candidates = card["candidates"]
    assert len(candidates) == len({p["name"].casefold() for p in candidates}) == 100
    assert all(not p["already_added"] and p["notes"] and p["interests"] for p in candidates)
    assert alice.ok("venn_list_people")["count"] == 0
    assert alice.ok("venn_show_dashboard")["view"] == "welcome"

    assert "NOT_FOUND" in bob.err("venn_import_demo_people", **confirm, indexes=[0])
    assert "matching import review card" in alice.err("venn_import_people", import_id=card["import_id"], indexes=[0])
    assert "Unknown entry" in alice.err("venn_import_demo_people", **confirm, indexes=[100])
    added = alice.ok("venn_import_demo_people", **confirm, indexes=list(range(100)))
    assert confirm["confirmation_token"] not in str(added)
    assert added["count"] == 100 and all(p["is_sample"] for p in added["imported"])
    assert {p["name"]: p["interests"] for p in added["imported"]} == {p["name"]: p["interests"] for p in candidates}
    assert bob.ok("venn_list_people")["count"] == 0
    dashboard = alice.ok("venn_show_dashboard")
    assert dashboard["view"] == "dashboard" and dashboard["sample_loaded"] is True
    assert not next(s for s in dashboard["setup"] if s["key"] == "your_people")["done"]
    assert "already used" in alice.err("venn_import_demo_people", **confirm, indexes=[0])

    repeat, confirm_repeat = preview(alice, platform)
    assert len(repeat["candidates"]) == 100 and all(p["already_added"] for p in repeat["candidates"])
    real = alice.ok("venn_add_person", name="Real friend")
    assert alice.ok("venn_remove_sample_circle")["people"] == 100
    listed = alice.ok("venn_list_people")
    assert [p["person_id"] for p in listed["people"]] == [real["person_id"]]
    assert "NOT_FOUND" in alice.err("venn_import_demo_people", **confirm_repeat, indexes=[0])


@pytest.mark.parametrize("platform", ["instagram", "linkedin"])
def test_related_import_evidence_on_web_and_plugin(alice, bob, web, make_user, platform):
    me = web("alice")
    me.ok("POST", "/memories", {"category": "INTEREST", "title": "Photo walks", "description": "Weekend ritual"})
    card, _ = preview(alice, platform)
    assert card["candidates"] == me.ok("POST", f"/{platform}/demo-preview")["candidates"]
    pairs = [pair for c in card["candidates"] for pair in c["interest_matches"]]
    assert any(p["kind"] == "related" and p["my_label"] == "Photo walks" for p in pairs)
    assert not any(c["interest_matches"] for c in preview(bob, platform)[0]["candidates"])
    # A token without memory read either fails the transport scope check or yields no evidence.
    limited = make_user("alice", scopes=[s for s in ALL_SCOPES if s != "venn.memories.read"])
    res = limited.rpc("tools/call", {"name": "venn_preview_demo_people_import", "arguments": {"platform": platform}})
    if res.status_code != 403:
        assert res.status_code == 200
        candidates = res.json()["result"]["structuredContent"]["candidates"]
        assert not any(c["interest_matches"] or c["shared_interests"] for c in candidates)


def test_demo_import_platform_scope_and_regular_import_separation(alice, make_user):
    restricted = make_user("restricted", scopes=[s for s in ALL_SCOPES if s != CONNECTIONS])
    assert (
        restricted.rpc(
            "tools/call", {"name": "venn_preview_demo_people_import", "arguments": {"platform": "instagram"}}
        ).status_code
        == 403
    )
    assert "platform" in alice.err("venn_preview_demo_people_import", platform="unknown")
    ordinary = alice.ok("venn_propose_people_import", people=[{"name": "Real contact"}], source="instagram_demo")
    assert ordinary["demo_platform"] is None
    _, confirm = preview(alice, "instagram")
    assert "matching import review card" in alice.err(
        "venn_import_demo_people", **{**confirm, "import_id": ordinary["import_id"]}, indexes=[0]
    )
    result = alice.ok("venn_import_people", import_id=ordinary["import_id"], indexes=[0])
    assert result["count"] == 1 and result["imported"][0]["is_sample"] is False


@pytest.mark.parametrize("platform", ["instagram", "linkedin"])
def test_demo_imports_are_confirmed_on_the_originating_surface(alice, web, platform):
    me = web("alice")
    chatgpt, confirm = preview(alice, platform)
    website = me.ok("POST", f"/{platform}/demo-preview")
    assert me.err("POST", "/people/import", {"import_id": chatgpt["import_id"], "indexes": [0]}) == (
        400,
        "INVALID_REQUEST",
    )
    assert "matching import review card" in alice.err(
        "venn_import_demo_people", **{**confirm, "import_id": website["import_id"]}, indexes=[0]
    )
    assert "confirmation_token" not in website
    assert alice.ok("venn_list_people")["count"] == 0


def test_web_instagram_demo_uses_private_sample_notes_and_existing_cleanup(alice, web):
    path = "/instagram/demo-preview"
    assert web().err("POST", path)[0] == 401
    me, other = web("alice"), web("bob")
    real = me.ok("POST", "/people", {"name": "My real friend"})
    preview = me.ok("POST", path)
    candidates = preview["candidates"]
    assert preview["source"] == "instagram_demo" and preview["demo_platform"] == "instagram"
    assert preview["skipped"] == 0 and len(candidates) == len({c["name"].casefold() for c in candidates}) == 100
    assert all(c["relationship"] == "Instagram connection" and not c["already_added"] for c in candidates)
    assert me.ok("GET", "/people")["count"] == 1

    picked = [31, 79]
    payload = {"import_id": preview["import_id"], "indexes": picked}
    assert other.err("POST", "/people/import", payload) == (404, "NOT_FOUND")
    added = me.ok("POST", "/people/import", payload)
    assert added["count"] == len(picked) and all(p["is_sample"] for p in added["imported"])
    assert [p["name"] for p in added["imported"]] == [candidates[i]["name"] for i in picked]
    assert other.ok("GET", "/people")["count"] == 0
    assert me.ok("GET", "/home")["sample_loaded"]
    repeat = me.ok("POST", path)
    assert [p["index"] for p in repeat["candidates"] if p["already_added"]] == picked
    plugin_repeat = alice.ok("venn_preview_demo_people_import", platform="instagram")
    assert repeat["candidates"] == plugin_repeat["candidates"]

    assert me.ok("DELETE", "/sample")["people"] == len(picked)
    assert me.err("POST", "/people/import", {"import_id": repeat["import_id"], "indexes": [0]}) == (404, "NOT_FOUND")
    assert [p["person_id"] for p in me.ok("GET", "/people")["people"]] == [real["person_id"]]


def test_loading_sample_circle_preserves_demo_profiles_and_unconfirmed_review(alice):
    _, first = preview(alice, "instagram")
    added = alice.ok("venn_import_demo_people", **first, indexes=[0])["imported"][0]
    _, second = preview(alice, "linkedin")
    alice.ok("venn_load_sample_circle")
    assert any(p["person_id"] == added["person_id"] for p in alice.ok("venn_list_people")["people"])
    assert alice.ok("venn_import_demo_people", **second, indexes=[0])["count"] == 1
    assert alice.ok("venn_load_sample_circle")["people"] == 0  # loading twice does not duplicate or replace samples
    assert alice.ok("venn_remove_sample_circle")["people"] == 7
    assert alice.ok("venn_show_dashboard")["view"] == "welcome"


def test_demo_confirmation_only_saves_the_selected_indexes(alice):
    card, confirm = preview(alice, "instagram")
    _, other = preview(alice, "linkedin")
    picked = [31, 79]
    assert "fresh import review" in alice.err("venn_import_demo_people", import_id=card["import_id"], indexes=picked)
    malformed = "private-argument-marker"
    invalid = alice.err(
        "venn_import_demo_people", import_id=card["import_id"], indexes=picked, confirmation_token=malformed
    )
    assert "fresh import review" in invalid and malformed not in invalid
    assert confirm["confirmation_token"] not in alice.err("venn_import_demo_people", **confirm)
    assert "fresh import review" in alice.err(
        "venn_import_demo_people",
        import_id=card["import_id"],
        indexes=picked,
        confirmation_token=other["confirmation_token"],
    )
    assert alice.ok("venn_list_people")["count"] == 0
    result = alice.ok("venn_import_demo_people", **confirm, indexes=picked)
    assert result["count"] == len(picked)
    assert [p["name"] for p in result["imported"]] == [card["candidates"][i]["name"] for i in picked]
    repeat = alice.ok("venn_preview_demo_people_import", platform="instagram")
    assert [p["index"] for p in repeat["candidates"] if p["already_added"]] == picked
