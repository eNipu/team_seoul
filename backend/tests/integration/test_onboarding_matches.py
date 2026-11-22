"""Exercise onboarding through authenticated MCP requests, including fresh sessions."""

import pytest

from app.config import ALL_SCOPES
from app.mcp.common import CONNECTIONS, MEMORIES_READ
from tests.integration.test_demo_import import preview
from tests.integration.test_social_flow import connect, save

FIND = "venn_find_interest_matches"


def assert_progress(user, memories, contacts, reviewed):
    expected = {"memories_ready": memories, "contacts_ready": contacts, "matches_reviewed": reviewed}
    for tool in ("venn_show_dashboard", "venn_help"):
        assert user.ok(tool)["onboarding"] == expected, tool


def import_contacts(user, site, *people):
    proposal = site.ok("POST", "/linkedin/import-preview", {"people": [{"name": p["name"]} for p in people]})
    imported = user.ok("venn_import_people", import_id=proposal["import_id"], indexes=list(range(len(people))))
    for person, fields in zip(imported["imported"], people, strict=True):
        if "interests" in fields:
            user.ok("venn_update_person", person_id=person["person_id"], **fields)


def test_only_approved_imports_advance_progress_and_review_survives_reload(alice, bob, web, make_user):
    assert alice.ok("venn_show_dashboard")["view"] == "welcome"
    assert_progress(alice, False, False, False)
    alice.ok("venn_load_sample_circle")
    proposal = alice.ok(
        "venn_propose_memories",
        source="chatgpt_memory",
        suggested=[{"category": "INTEREST", "title": "Pottery", "description": "I throw bowls on weekends"}],
    )
    # Use the actual LinkedIn import path, not starter data or a hand-added note.
    me = web("alice")
    imported = me.ok(
        "POST", "/linkedin/import-preview", {"people": [{"name": "Nico Lane", "public_identifier": "nico-lane"}]}
    )
    assert_progress(alice, False, False, False)
    alice.ok("venn_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])
    assert_progress(alice, True, False, False)
    # The starter circle has a pottery contact. Searching early cannot complete review.
    assert "import first" in alice.err(FIND)
    assert_progress(alice, True, False, False)
    person = me.ok("POST", "/people/import", {"import_id": imported["import_id"], "indexes": [0]})["imported"][0]
    assert person["is_sample"] is False
    assert_progress(alice, True, True, False)
    assert alice.ok(FIND)["matches"] == []
    assert_progress(make_user("alice"), True, True, True)
    assert_progress(bob, False, False, False)
    alice.ok("venn_delete_person", person_id=person["person_id"])
    assert_progress(alice, True, False, False)
    generic = alice.ok("venn_propose_people_import", source="linkedin", people=[{"name": "Generic contact"}])
    alice.ok("venn_import_people", import_id=generic["import_id"], indexes=[0])
    assert_progress(alice, True, False, False)
    import_contacts(alice, me, {"name": "Another contact"})
    assert_progress(alice, True, True, False)


def test_match_evidence_uses_only_explicit_labels_on_eligible_owned_contacts(alice, bob, web):
    memory = save(alice, "INTEREST", "Pottery", "Coffee after class", "PRIVATE")
    save(bob, "INTEREST", "Swimming", "Pool laps", "PRIVATE")
    import_contacts(bob, web("bob"), {"name": "Foreign contact", "interests": ["Pottery"]})
    import_contacts(
        alice,
        web("alice"),
        {"name": "Ada", "interests": ["ceramics"]},
        {"name": "Zoe", "interests": ["pottery"]},
        {"name": "Nico", "interests": ["Coffee", "Swimming"], "notes": "Pottery"},
    )
    alice.ok("venn_add_person", name="Manual note", interests=["Pottery"])
    card = alice.ok(FIND)
    assert card["view"] == "interest_matches"
    matches = card["matches"]
    assert [row["display_name"] for row in matches] == ["Zoe", "Ada"]
    evidence = {row["display_name"]: row["interest_matches"] for row in matches}
    assert evidence == {
        "Zoe": [{"my_label": "Pottery", "their_label": "pottery", "kind": "exact"}],
        "Ada": [{"my_label": "Pottery", "their_label": "ceramics", "kind": "related"}],
    }
    assert alice.ok(FIND, limit=1)["matches"] == matches[:1]
    alice.ok("venn_delete_memory", memory_id=memory["memory_id"])
    assert not alice.ok("venn_help")["onboarding"]["memories_ready"]
    assert not alice.ok("venn_show_dashboard")["onboarding"]["matches_reviewed"]


@pytest.mark.parametrize("platform", ["instagram", "linkedin"])
def test_one_confirmed_platform_is_enough_and_matches_only_selected_profiles(alice, platform):
    card, confirm = preview(alice, platform)
    chosen = card["candidates"][0]
    label = chosen["interests"][0]
    person = alice.ok("venn_import_demo_people", **confirm, indexes=[0])["imported"][0]
    assert "import first" in alice.err(FIND)
    assert_progress(alice, False, True, False)
    save(alice, "INTEREST", label, "A weekend hobby", "PRIVATE")
    assert_progress(alice, True, True, False)
    matches = alice.ok(FIND)["matches"]
    assert [(row["kind"], row["id"], row["display_name"]) for row in matches] == [
        ("person", person["person_id"], chosen["name"])
    ]
    assert {"my_label": label, "their_label": label, "kind": "exact"} in matches[0]["interest_matches"]
    assert_progress(alice, True, True, True)


def test_connection_match_requires_visible_interest_and_disappears_after_block(alice, bob, web):
    connection = connect(alice, bob)
    save(alice, "INTEREST", "Pottery", "Evening class", "PRIVATE")
    assert_progress(alice, True, False, False)  # Connecting isn't importing.
    import_contacts(alice, web("alice"), {"name": "Nonmatching contact"})
    save(bob, "INTEREST", "Pottery", "Throwing bowls", "PRIVATE")
    assert alice.ok(FIND)["matches"] == []
    save(bob, "INTEREST", "ceramics", "Classes", "SHARED_WITH_CONNECTIONS")
    assert alice.ok(FIND)["matches"] == [
        {
            "kind": "connection",
            "id": connection,
            "display_name": "Bob",
            "interest_matches": [{"my_label": "Pottery", "their_label": "ceramics", "kind": "related"}],
        }
    ]
    assert_progress(alice, True, True, True)
    bob.ok("venn_block_user", connection_id=connection)
    assert alice.ok(FIND)["matches"] == []


def test_match_tool_has_bounded_input_and_requires_both_data_scopes(alice, make_user, web):
    tools = {tool["name"]: tool for tool in alice.rpc("tools/list").json()["result"]["tools"]}
    schema = tools[FIND]["inputSchema"]
    assert set(schema["properties"]) == {"limit"}
    limit = schema["properties"]["limit"]
    assert (limit["minimum"], limit["default"], limit["maximum"]) == (1, 10, 20)
    save(alice, "INTEREST", "Pottery", "Studio classes", "PRIVATE")
    import_contacts(alice, web("alice"), {"name": "Ada", "interests": ["Pottery"]})
    for invalid in (0, 21):
        assert "limit" in alice.err(FIND, limit=invalid)
    params = {"name": FIND, "arguments": {}}
    assert alice.rpc("tools/call", params, token="").status_code == 401
    for missing in (CONNECTIONS, MEMORIES_READ):
        restricted = make_user("alice", scopes=[s for s in ALL_SCOPES if s != missing])
        assert restricted.rpc("tools/call", params).status_code == 403
    assert_progress(alice, True, True, False)
