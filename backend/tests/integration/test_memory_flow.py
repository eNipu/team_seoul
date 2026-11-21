def test_new_user_profile_is_created_from_token(alice):
    profile = alice.ok("venn_get_profile")
    assert profile["display_name"] == "Alice"
    assert profile["is_new"] is True
    again = alice.ok("venn_get_profile")
    assert again["user_id"] == profile["user_id"]
    # Still "new" (needs onboarding) until the user has approved at least one memory.
    assert again["is_new"] is True
    proposal = alice.ok(
        "venn_propose_memories", suggested=[{"category": "INTEREST", "title": "Jazz", "description": "Live jazz"}]
    )
    alice.ok("venn_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])
    assert alice.ok("venn_get_profile")["is_new"] is False


def test_update_profile(alice):
    out = alice.ok("venn_update_profile", bio="Climber and cook", social_goals=["make_friends"])
    assert out["bio"] == "Climber and cook"
    assert out["social_goals"] == ["make_friends"]


def test_propose_does_not_save_until_approved(alice):
    result = alice.call(
        "venn_propose_memories",
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
    assert alice.ok("venn_list_memories")["count"] == 0

    saved = alice.ok(
        "venn_save_memories",
        proposal_id=proposal["proposal_id"],
        approvals=[{"index": 0, "visibility": "SHARED_WITH_CONNECTIONS"}],
    )
    assert saved["count"] == 1
    memories = alice.ok("venn_list_memories")["memories"]
    assert [(m["title"], m["visibility"]) for m in memories] == [("Bouldering", "SHARED_WITH_CONNECTIONS")]


def test_text_extraction_heuristic(alice):
    proposal = alice.ok("venn_propose_memories", text="I love hiking and board games. I hate crowded clubs.")
    cats = {p["category"] for p in proposal["proposals"]}
    assert "INTEREST" in cats
    assert "DISLIKE" in cats


def test_save_with_user_edits_and_default_private(alice):
    proposal = alice.ok(
        "venn_propose_memories",
        suggested=[{"category": "PREFERENCE", "title": "Coffee", "description": "Likes oat flat whites"}],
    )
    saved = alice.ok(
        "venn_save_memories",
        proposal_id=proposal["proposal_id"],
        approvals=[{"index": 0, "title": "Flat white"}],
    )
    assert saved["saved"][0]["title"] == "Flat white"
    assert saved["saved"][0]["visibility"] == "PRIVATE"


def test_proposal_is_single_use(alice):
    proposal = alice.ok(
        "venn_propose_memories", suggested=[{"category": "INTEREST", "title": "Jazz", "description": "Live jazz"}]
    )
    alice.ok("venn_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])
    msg = alice.err("venn_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])
    assert msg.startswith("INVALID_REQUEST")
    assert alice.ok("venn_list_memories")["count"] == 1


def test_discarded_proposal_cannot_be_saved(alice):
    proposal = alice.ok(
        "venn_propose_memories", suggested=[{"category": "INTEREST", "title": "Jazz", "description": "Live jazz"}]
    )
    alice.ok("venn_discard_memory_proposal", proposal_id=proposal["proposal_id"])
    assert alice.err("venn_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])


def test_invalid_index_rejected(alice):
    proposal = alice.ok(
        "venn_propose_memories", suggested=[{"category": "INTEREST", "title": "Jazz", "description": "Live jazz"}]
    )
    msg = alice.err("venn_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 5}])
    assert msg.startswith("INVALID_REQUEST")


def test_update_and_delete_memory(alice):
    proposal = alice.ok(
        "venn_propose_memories", suggested=[{"category": "INTEREST", "title": "Jazz", "description": "Live jazz"}]
    )
    memory = alice.ok("venn_save_memories", proposal_id=proposal["proposal_id"], approvals=[{"index": 0}])["saved"][0]
    updated = alice.ok("venn_update_memory", memory_id=memory["memory_id"], visibility="PUBLIC_PROFILE")
    assert updated["visibility"] == "PUBLIC_PROFILE"
    deleted = alice.ok("venn_delete_memory", memory_id=memory["memory_id"])
    assert deleted == {"deleted": True, "memory_id": memory["memory_id"]}
    assert alice.ok("venn_list_memories")["count"] == 0


def test_empty_account_gets_welcome_view(alice):
    view = alice.ok("venn_show_dashboard")
    assert view["view"] == "welcome"
    assert view["display_name"] == "Alice"
    assert {"value": "make_friends", "label": "Make new friends"} in view["goal_options"]
    assert len(view["goal_options"]) == 6
    # Picking goals (what the welcome card does) moves the user on to the dashboard.
    alice.ok("venn_update_profile", social_goals=[view["goal_options"][0]["value"]])
    assert alice.ok("venn_show_dashboard")["view"] == "dashboard"


def test_dashboard_view(alice):
    alice.ok("venn_update_profile", social_goals=["reconnect"])
    view = alice.ok("venn_show_dashboard")
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
        "venn_propose_memories",
        suggested=[
            {"category": "INTEREST", "title": "Bouldering", "description": "Climbs on Tuesdays", "tags": ["climbing"]},
            {"category": "EXPERIENCE", "title": "Lisbon trip", "description": "Went climbing near Sintra"},
            {"category": "DISLIKE", "title": "Loud bars", "description": "Too noisy to talk"},
        ],
    )
    alice.ok(
        "venn_save_memories",
        proposal_id=proposal["proposal_id"],
        approvals=[{"index": i, "visibility": "PRIVATE"} for i in range(3)],
    )
    out = alice.ok("venn_search_memories", query="climbing")
    # Tag hit outranks a description-only hit.
    assert [m["title"] for m in out["memories"]] == ["Bouldering", "Lisbon trip"]
    assert out["count"] == 2
    # Every word must match.
    assert [m["title"] for m in alice.ok("venn_search_memories", query="climbing sintra")["memories"]] == [
        "Lisbon trip"
    ]
    assert alice.ok("venn_search_memories", query="dislike")["memories"][0]["title"] == "Loud bars"
    assert alice.ok("venn_search_memories", query="opera")["memories"] == []
    assert alice.ok("venn_search_memories", query="climbing", limit=1)["count"] == 1


def test_widget_resource_served(alice):
    body = alice.rpc("resources/read", {"uri": "ui://venn/app-v2.html"}).json()
    content = body["result"]["contents"][0]
    assert content["mimeType"] == "text/html;profile=mcp-app"
    assert "<html" in content["text"]


def test_render_tools_bound_to_widget(alice):
    tools = {t["name"]: t for t in alice.rpc("tools/list").json()["result"]["tools"]}
    assert len(tools) == 54
    render_tools = (
        "venn_propose_memories",
        "venn_import_chatgpt_memory",
        "venn_show_dashboard",
        "venn_help",
        "venn_create_invite",
        "venn_propose_people_import",
        "venn_view_friend",
        "venn_suggest_activity",
        "venn_reconnection_suggestions",
        "venn_find_people",
        "venn_plan_group",
        "venn_meetup_brief",
        "venn_start_quiz",
        "venn_compare",
        "venn_this_week",
        "venn_create_question_link",
        "venn_review_answers",
    )
    for name in render_tools:
        assert tools[name]["_meta"]["ui"]["resourceUri"] == "ui://venn/app-v2.html"
    # Tools the widget calls directly must be callable from the app.
    for name in (
        "venn_save_memories",
        "venn_update_memory",
        "venn_delete_memory",
        "venn_update_profile",
        "venn_revoke_invite",
        "venn_respond_to_connection",
        "venn_remove_connection",
        "venn_log_interaction",
        "venn_add_person",
        "venn_update_person",
        "venn_delete_person",
        "venn_import_people",
        "venn_add_follow_up",
        "venn_complete_follow_up",
        "venn_save_plan",
        "venn_complete_plan",
        "venn_delete_plan",
        "venn_save_answers",
        "venn_discard_answers",
        "venn_revoke_question_link",
        "venn_load_sample_circle",
        "venn_remove_sample_circle",
    ):
        assert tools[name]["_meta"]["openai/widgetAccessible"] is True, name
    assert "ui" not in (tools["venn_list_memories"].get("_meta") or {})
    assert sum("ui" in (t.get("_meta") or {}) for t in tools.values()) == 17


# ---------------------------------------------------------------- import from ChatGPT memory
def _remembered(n: int) -> list[dict]:
    return [{"category": "INTEREST", "title": f"Hobby {i}", "description": f"Enjoys hobby {i}"} for i in range(n)]


def test_import_card_takes_no_data_and_saves_nothing(alice):
    result = alice.call("venn_import_chatgpt_memory")
    assert not result["isError"]
    card = result["structuredContent"]
    assert card["view"] == "memory_import"
    assert [a["value"] for a in card["areas"]] == [
        "interests",
        "preferences",
        "work",
        "goals",
        "experiences",
        "personal",
    ]
    # Personal life is opt-in; sensitive areas are not offered at all.
    assert [a["value"] for a in card["areas"] if not a["selected"]] == ["personal"]
    assert "never imported" in card["always_excluded"]
    assert card["imported_count"] == 0 and card["max_items"] == 30
    # The model is told the order: list in chat first, send only what the user picked.
    assert "venn_propose_memories" in result["content"][0]["text"]
    assert alice.ok("venn_list_memories")["count"] == 0


def test_import_from_chatgpt_memory_is_reviewed_then_saved_with_its_source(alice):
    remembered = [
        {"category": "WORK", "title": "Runs a merch studio", "description": "Building a small merchandise company"},
        {"category": "INTEREST", "title": "Bouldering", "description": "Climbs twice a week", "tags": ["climbing"]},
        {"category": "SOCIAL_GOAL", "title": "Meet AI founders", "description": "Wants to meet people building AI"},
    ]
    card = alice.ok("venn_propose_memories", suggested=remembered, source="chatgpt_memory")
    assert card["view"] == "memory_review" and card["source"] == "chatgpt_memory"
    assert all(p["suggested_visibility"] == "PRIVATE" and not p["already_saved"] for p in card["proposals"])
    assert alice.ok("venn_list_memories")["count"] == 0  # proposing is not saving

    saved = alice.ok(
        "venn_save_memories",
        proposal_id=card["proposal_id"],
        approvals=[{"index": 0}, {"index": 2, "visibility": "SHARED_WITH_CONNECTIONS"}],
    )
    assert saved["count"] == 2
    assert {m["source"] for m in saved["saved"]} == {"chatgpt_memory"}
    memories = alice.ok("venn_list_memories")["memories"]
    # The one the user left unticked is not stored.
    assert sorted(m["title"] for m in memories) == ["Meet AI founders", "Runs a merch studio"]
    assert {m["category"] for m in memories} == {"WORK", "SOCIAL_GOAL"}
    assert alice.ok("venn_import_chatgpt_memory")["imported_count"] == 2
    dashboard = alice.ok("venn_show_dashboard")
    assert {m["source"] for m in dashboard["memories"]} == {"chatgpt_memory"}


def test_memories_from_the_conversation_have_no_source(alice):
    card = alice.ok("venn_propose_memories", suggested=_remembered(1))
    assert card["source"] == "conversation"
    saved = alice.ok("venn_save_memories", proposal_id=card["proposal_id"], approvals=[{"index": 0}])
    assert saved["saved"][0]["source"] is None
    assert alice.ok("venn_import_chatgpt_memory")["imported_count"] == 0


def test_import_allows_thirty_items_but_a_conversation_only_eight(alice):
    assert len(alice.ok("venn_propose_memories", suggested=_remembered(12))["proposals"]) == 8
    card = alice.ok("venn_propose_memories", suggested=_remembered(30), source="chatgpt_memory")
    assert len(card["proposals"]) == 30
    saved = alice.ok(
        "venn_save_memories",
        proposal_id=card["proposal_id"],
        approvals=[{"index": i} for i in range(30)],
    )
    assert saved["count"] == 30
    assert alice.call("venn_propose_memories", suggested=_remembered(31), source="chatgpt_memory")["isError"]


def test_repeated_import_marks_what_is_already_saved(alice):
    first = alice.ok("venn_propose_memories", suggested=_remembered(2), source="chatgpt_memory")
    alice.ok("venn_save_memories", proposal_id=first["proposal_id"], approvals=[{"index": 0}])
    again = alice.ok(
        "venn_propose_memories",
        suggested=[
            {"category": "INTEREST", "title": "  hobby 0 ", "description": "Same thing, different spacing and case"},
            {"category": "INTEREST", "title": "Hobby 1", "description": "Was not kept last time"},
        ],
        source="chatgpt_memory",
    )
    assert [p["already_saved"] for p in again["proposals"]] == [True, False]


def test_unknown_source_is_rejected(alice):
    assert alice.call("venn_propose_memories", suggested=_remembered(1), source="claude")["isError"]
