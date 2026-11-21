def test_new_user_profile_is_created_from_token(alice):
    profile = alice.ok("heldly_get_profile")
    assert profile["display_name"] == "Alice"
    assert profile["is_new"] is True
    again = alice.ok("heldly_get_profile")
    assert again["user_id"] == profile["user_id"]
    # Still "new" (needs onboarding) until the user has approved at least one memory.
    assert again["is_new"] is True
    proposal = alice.ok(
        "heldly_propose_memories", suggested=[{"category": "INTEREST", "title": "Jazz", "description": "Live jazz"}]
    )
    alice.ok("heldly_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])
    assert alice.ok("heldly_get_profile")["is_new"] is False


def test_update_profile(alice):
    out = alice.ok("heldly_update_profile", bio="Climber and cook", social_goals=["make_friends"])
    assert out["bio"] == "Climber and cook"
    assert out["social_goals"] == ["make_friends"]


def test_propose_does_not_save_until_approved(alice):
    result = alice.call(
        "heldly_propose_memories",
        suggested=[
            {"category": "INTEREST", "title": "Bouldering", "description": "Climbs twice a week", "tags": ["climbing"]},
            {"category": "DISLIKE", "title": "Loud bars", "description": "Prefers quiet places"},
        ],
    )
    assert not result["isError"]
    proposal = result["structuredContent"]
    assert proposal["view"] == "memory_review"
    assert [p["index"] for p in proposal["proposals"]] == [0, 1]
    assert all(p["suggested_visibility"] == "PRIVATE" for p in proposal["proposals"])
    assert alice.ok("heldly_list_memories")["count"] == 0

    saved = alice.ok(
        "heldly_save_memories",
        proposal_id=proposal["proposal_id"],
        approvals=[{"index": 0, "visibility": "SHARED_WITH_CONNECTIONS"}],
    )
    assert saved["count"] == 1
    memories = alice.ok("heldly_list_memories")["memories"]
    assert [(m["title"], m["visibility"]) for m in memories] == [("Bouldering", "SHARED_WITH_CONNECTIONS")]


def test_text_extraction_heuristic(alice):
    proposal = alice.ok("heldly_propose_memories", text="I love hiking and board games. I hate crowded clubs.")
    cats = {p["category"] for p in proposal["proposals"]}
    assert "INTEREST" in cats
    assert "DISLIKE" in cats


def test_save_with_user_edits_and_default_private(alice):
    proposal = alice.ok(
        "heldly_propose_memories",
        suggested=[{"category": "PREFERENCE", "title": "Coffee", "description": "Likes oat flat whites"}],
    )
    saved = alice.ok(
        "heldly_save_memories",
        proposal_id=proposal["proposal_id"],
        approvals=[{"index": 0, "title": "Flat white"}],
    )
    assert saved["saved"][0]["title"] == "Flat white"
    assert saved["saved"][0]["visibility"] == "PRIVATE"


def test_proposal_is_single_use(alice):
    proposal = alice.ok(
        "heldly_propose_memories", suggested=[{"category": "INTEREST", "title": "Jazz", "description": "Live jazz"}]
    )
    alice.ok("heldly_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])
    msg = alice.err("heldly_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])
    assert msg.startswith("INVALID_REQUEST")
    assert alice.ok("heldly_list_memories")["count"] == 1


def test_discarded_proposal_cannot_be_saved(alice):
    proposal = alice.ok(
        "heldly_propose_memories", suggested=[{"category": "INTEREST", "title": "Jazz", "description": "Live jazz"}]
    )
    alice.ok("heldly_discard_memory_proposal", proposal_id=proposal["proposal_id"])
    assert alice.err("heldly_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])


def test_invalid_index_rejected(alice):
    proposal = alice.ok(
        "heldly_propose_memories", suggested=[{"category": "INTEREST", "title": "Jazz", "description": "Live jazz"}]
    )
    msg = alice.err("heldly_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 5}])
    assert msg.startswith("INVALID_REQUEST")


def test_update_and_delete_memory(alice):
    proposal = alice.ok(
        "heldly_propose_memories", suggested=[{"category": "INTEREST", "title": "Jazz", "description": "Live jazz"}]
    )
    memory = alice.ok("heldly_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])["saved"][0]
    updated = alice.ok("heldly_update_memory", memory_id=memory["memory_id"], visibility="PUBLIC_PROFILE")
    assert updated["visibility"] == "PUBLIC_PROFILE"
    deleted = alice.ok("heldly_delete_memory", memory_id=memory["memory_id"])
    assert deleted == {"deleted": True, "memory_id": memory["memory_id"]}
    assert alice.ok("heldly_list_memories")["count"] == 0


def test_empty_account_gets_welcome_view(alice):
    view = alice.ok("heldly_show_dashboard")
    assert view["view"] == "welcome"
    assert view["display_name"] == "Alice"
    assert {"value": "make_friends", "label": "Make new friends"} in view["goal_options"]
    assert len(view["goal_options"]) == 6
    # Picking goals (what the welcome card does) moves the user on to the dashboard.
    alice.ok("heldly_update_profile", social_goals=[view["goal_options"][0]["value"]])
    assert alice.ok("heldly_show_dashboard")["view"] == "dashboard"


def test_dashboard_view(alice):
    alice.ok("heldly_update_profile", social_goals=["reconnect"])
    view = alice.ok("heldly_show_dashboard")
    assert view["view"] == "dashboard"
    assert view["profile"]["display_name"] == "Alice"
    assert view["profile"]["social_goals"] == ["reconnect"]
    assert "is_new" not in view["profile"]
    assert view["memories"] == []
    assert view["connections"] == []
    assert view["people"] == []
    assert view["pending_requests"] == []


def test_search_memories(alice):
    proposal = alice.ok(
        "heldly_propose_memories",
        suggested=[
            {"category": "INTEREST", "title": "Bouldering", "description": "Climbs on Tuesdays", "tags": ["climbing"]},
            {"category": "EXPERIENCE", "title": "Lisbon trip", "description": "Went climbing near Sintra"},
            {"category": "DISLIKE", "title": "Loud bars", "description": "Too noisy to talk"},
        ],
    )
    alice.ok(
        "heldly_save_memories",
        proposal_id=proposal["proposal_id"],
        approvals=[{"index": i, "visibility": "PRIVATE"} for i in range(3)],
    )
    out = alice.ok("heldly_search_memories", query="climbing")
    # Tag hit outranks a description-only hit.
    assert [m["title"] for m in out["memories"]] == ["Bouldering", "Lisbon trip"]
    assert out["count"] == 2
    # Every word must match.
    assert [m["title"] for m in alice.ok("heldly_search_memories", query="climbing sintra")["memories"]] == [
        "Lisbon trip"
    ]
    assert alice.ok("heldly_search_memories", query="dislike")["memories"][0]["title"] == "Loud bars"
    assert alice.ok("heldly_search_memories", query="opera")["memories"] == []
    assert alice.ok("heldly_search_memories", query="climbing", limit=1)["count"] == 1


def test_widget_resource_served(alice):
    body = alice.rpc("resources/read", {"uri": "ui://heldly/app-v2.html"}).json()
    content = body["result"]["contents"][0]
    assert content["mimeType"] == "text/html;profile=mcp-app"
    assert "<html" in content["text"]


def test_render_tools_bound_to_widget(alice):
    tools = {t["name"]: t for t in alice.rpc("tools/list").json()["result"]["tools"]}
    assert len(tools) == 28
    render_tools = (
        "heldly_propose_memories",
        "heldly_show_dashboard",
        "heldly_create_invite",
        "heldly_view_friend",
        "heldly_suggest_activity",
        "heldly_reconnection_suggestions",
    )
    for name in render_tools:
        assert tools[name]["_meta"]["ui"]["resourceUri"] == "ui://heldly/app-v2.html"
    # Tools the widget calls directly must be callable from the app.
    for name in (
        "heldly_save_memories",
        "heldly_update_memory",
        "heldly_delete_memory",
        "heldly_update_profile",
        "heldly_revoke_invite",
        "heldly_respond_to_connection",
        "heldly_remove_connection",
        "heldly_log_interaction",
        "heldly_add_person",
        "heldly_update_person",
        "heldly_delete_person",
    ):
        assert tools[name]["_meta"]["openai/widgetAccessible"] is True, name
    assert "ui" not in (tools["heldly_list_memories"].get("_meta") or {})
    assert not any("game" in n for n in tools)
