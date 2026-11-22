"""The ChatGPT demo is a private review flow, not a social account import."""

import pytest

from app.config import ALL_SCOPES
from app.mcp.common import CONNECTIONS


@pytest.mark.parametrize("platform", ["instagram", "linkedin"])
def test_preview_then_add_all_sample_profiles(alice, bob, platform):
    card = alice.ok("venn_preview_demo_people_import", platform=platform)
    assert card["view"] == "people_import" and card["demo_platform"] == platform
    candidates = card["candidates"]
    assert len(candidates) == len({p["name"].casefold() for p in candidates}) == 100
    assert all(not p["already_added"] and p["notes"] and p["interests"] for p in candidates)
    assert alice.ok("venn_list_people")["count"] == 0
    assert alice.ok("venn_show_dashboard")["view"] == "welcome"

    import_id = card["import_id"]
    assert "NOT_FOUND" in bob.err("venn_import_demo_people", import_id=import_id, indexes=[0])
    assert "matching import review card" in alice.err("venn_import_people", import_id=import_id, indexes=[0])
    assert "Unknown entry" in alice.err("venn_import_demo_people", import_id=import_id, indexes=[100])
    added = alice.ok("venn_import_demo_people", import_id=import_id, indexes=list(range(100)))
    assert added["count"] == 100 and all(p["is_sample"] for p in added["imported"])
    assert bob.ok("venn_list_people")["count"] == 0
    dashboard = alice.ok("venn_show_dashboard")
    assert dashboard["view"] == "dashboard" and dashboard["sample_loaded"] is True
    assert not next(s for s in dashboard["setup"] if s["key"] == "your_people")["done"]
    assert "already used" in alice.err("venn_import_demo_people", import_id=import_id, indexes=[0])

    repeat = alice.ok("venn_preview_demo_people_import", platform=platform)
    assert len(repeat["candidates"]) == 100 and all(p["already_added"] for p in repeat["candidates"])
    real = alice.ok("venn_add_person", name="Real friend")
    assert alice.ok("venn_remove_sample_circle")["people"] == 100
    listed = alice.ok("venn_list_people")
    assert [p["person_id"] for p in listed["people"]] == [real["person_id"]]
    assert "NOT_FOUND" in alice.err("venn_import_demo_people", import_id=repeat["import_id"], indexes=[0])


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
    assert "matching import review card" in alice.err(
        "venn_import_demo_people", import_id=ordinary["import_id"], indexes=[0]
    )
    result = alice.ok("venn_import_people", import_id=ordinary["import_id"], indexes=[0])
    assert result["count"] == 1 and result["imported"][0]["is_sample"] is False


def test_demo_imports_are_confirmed_on_the_originating_surface(alice, web):
    me = web("alice")
    chatgpt = alice.ok("venn_preview_demo_people_import", platform="instagram")
    website = me.ok("POST", "/linkedin/demo-preview")
    assert me.err("POST", "/people/import", {"import_id": chatgpt["import_id"], "indexes": [0]}) == (
        400,
        "INVALID_REQUEST",
    )
    assert "matching import review card" in alice.err(
        "venn_import_demo_people", import_id=website["import_id"], indexes=[0]
    )
    assert alice.ok("venn_list_people")["count"] == 0


def test_loading_sample_circle_preserves_demo_profiles_and_unconfirmed_review(alice):
    first = alice.ok("venn_preview_demo_people_import", platform="instagram")
    added = alice.ok("venn_import_demo_people", import_id=first["import_id"], indexes=[0])["imported"][0]
    second = alice.ok("venn_preview_demo_people_import", platform="linkedin")
    alice.ok("venn_load_sample_circle")
    assert any(p["person_id"] == added["person_id"] for p in alice.ok("venn_list_people")["people"])
    assert alice.ok("venn_import_demo_people", import_id=second["import_id"], indexes=[0])["count"] == 1
    assert alice.ok("venn_load_sample_circle")["people"] == 0  # loading twice does not duplicate or replace samples
    assert alice.ok("venn_remove_sample_circle")["people"] == 7
    assert alice.ok("venn_show_dashboard")["view"] == "welcome"


def test_demo_confirmation_only_saves_the_selected_indexes(alice):
    card = alice.ok("venn_preview_demo_people_import", platform="instagram")
    picked = [31, 79]
    result = alice.ok("venn_import_demo_people", import_id=card["import_id"], indexes=picked)
    assert result["count"] == len(picked)
    assert [p["name"] for p in result["imported"]] == [card["candidates"][i]["name"] for i in picked]
    repeat = alice.ok("venn_preview_demo_people_import", platform="instagram")
    assert [p["index"] for p in repeat["candidates"] if p["already_added"]] == picked
