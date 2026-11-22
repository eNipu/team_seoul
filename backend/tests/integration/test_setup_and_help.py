"""Set-up (onboarding) steps on the home card and the help card."""

from tests.integration.test_social_flow import connect, pending_request, save


def text(user, tool: str, **arguments) -> str:
    """The text the model reads for a tool result (the card data is in structuredContent)."""
    result = user.call(tool, **arguments)
    assert not result.get("isError"), result
    return result["content"][0]["text"]


def steps(view: dict) -> dict[str, bool]:
    return {step["key"]: step["done"] for step in view["setup"]}


def test_new_account_starts_with_all_three_steps_open(alice):
    view = alice.ok("venn_show_dashboard")
    assert view["view"] == "welcome"
    assert [s["key"] for s in view["setup"]] == ["about_you", "your_people", "connect"]
    assert steps(view) == {"about_you": False, "your_people": False, "connect": False}
    assert [s["title"] for s in view["setup"]] == ["Connect your AI memories", "Import contacts", "Invite someone"]
    assert all(s["title"] and s["description"] for s in view["setup"])
    assert all(len(s["description"].split()) <= 8 for s in view["setup"])


def test_model_opens_with_one_memory_import_step(alice):
    said = text(alice, "venn_show_dashboard")
    assert "Step 1 of 3: Connect" in said
    assert "Wait for the user's choice" in said
    assert alice.ok("venn_list_people")["count"] == 0
    # The first open step is the one-tap Connect: propose everything remembered, flagged quick_import.
    assert "venn_propose_memories" in said and "quick_import: true" in said
    assert "Do not list them in chat first" in said
    assert "venn_propose_people_import" not in said


def test_steps_are_ticked_off_by_what_the_user_has_done(alice):
    save(alice, "INTEREST", "Bouldering", "Climbs twice a week", "PRIVATE")
    view = alice.ok("venn_show_dashboard")
    assert view["view"] == "dashboard"
    assert steps(view) == {"about_you": True, "your_people": False, "connect": False}
    said = text(alice, "venn_show_dashboard")
    assert "Step 2 of 3" in said and "Instagram or LinkedIn" in said

    alice.ok("venn_add_person", name="Maya")
    assert steps(alice.ok("venn_show_dashboard")) == {"about_you": True, "your_people": True, "connect": False}
    said = text(alice, "venn_show_dashboard")
    assert "Step 2 of 3" in said and "venn_create_invite" in said  # invite someone is offered too

    alice.ok("venn_create_invite")
    view = alice.ok("venn_show_dashboard")
    assert steps(view) == {"about_you": True, "your_people": True, "connect": True}
    said = text(alice, "venn_show_dashboard")
    assert "Step 2 of 3" in said  # Legacy web checklist completion does not advance plugin setup.


def test_a_revoked_unused_invite_does_not_count_as_connecting(alice):
    code = alice.ok("venn_create_invite")["code"]
    assert steps(alice.ok("venn_show_dashboard"))["connect"] is True
    alice.ok("venn_revoke_invite", code=code)
    assert steps(alice.ok("venn_show_dashboard"))["connect"] is False


def test_a_connection_completes_people_and_connect_for_both_sides(alice, bob):
    connect(alice, bob)
    for user in (alice, bob):
        done = steps(user.ok("venn_show_dashboard"))
        assert done == {"about_you": False, "your_people": True, "connect": True}


def test_someone_asking_to_connect_counts_as_connect_but_not_as_people(alice, bob):
    pending_request(bob, "Bob", alice, "Alice")  # a request not from an invite (invites connect at once)
    done = steps(alice.ok("venn_show_dashboard"))
    assert done["connect"] is True
    assert done["your_people"] is False


def test_setup_state_is_per_user(alice, bob):
    save(alice, "INTEREST", "Bouldering", "Climbs twice a week", "PRIVATE")
    alice.ok("venn_add_person", name="Maya")
    assert steps(bob.ok("venn_show_dashboard")) == {"about_you": False, "your_people": False, "connect": False}


def test_help_card(alice):
    view = alice.ok("venn_help")
    assert view["view"] == "help"
    assert view["display_name"] == "Alice"
    keys = [t["key"] for t in view["topics"]]
    assert keys == ["setup", "memories", "people", "connect", "stay_close"]
    examples = [e for t in view["topics"] for e in t["examples"]]
    assert not any("quiz" in e.lower() or "ask a friend" in e.lower() for e in examples)
    for topic in view["topics"]:
        assert topic["title"] and topic["description"]
        assert 1 <= len(topic["examples"]) <= 4
    assert "Nothing is saved until you approve it." in view["privacy"]
    assert any(line.startswith("Venn never contacts anyone for you.") for line in view["privacy"])
    assert any("not synced" in line for line in view["privacy"])
    assert steps(view) == {"about_you": False, "your_people": False, "connect": False}


def test_help_offers_setup_but_does_not_start_it(alice):
    said = text(alice, "venn_help")
    assert "Showing the help card" in said
    assert "Step 1 of 3" in said
    assert "start the first open step in this same reply" not in said

    save(alice, "INTEREST", "Bouldering", "Climbs twice a week", "PRIVATE")
    alice.ok("venn_add_person", name="Maya")
    alice.ok("venn_create_invite")
    assert "Step 2 of 3" in text(alice, "venn_help")
    assert all(alice.ok("venn_help")["setup"][i]["done"] for i in range(3))


def test_help_changes_nothing(alice):
    alice.ok("venn_help")
    # Still a brand-new, empty account: asking for help must not move the user past the welcome card.
    assert alice.ok("venn_show_dashboard")["view"] == "welcome"


def test_help_examples_are_requests_the_server_instructions_route(alice):
    """Every area on the help card is something the model is told how to handle."""
    instructions = alice.rpc(
        "initialize",
        {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "t", "version": "0"}},
    ).json()["result"]["instructions"]
    assert "venn_help" in instructions
    assert "one-tap Connect" in instructions
    assert "venn_find_interest_matches" in instructions
    for tool in (
        "venn_import_chatgpt_memory",
        "venn_propose_people_import",
        "venn_preview_demo_people_import",
        "venn_create_invite",
        "venn_whats_new",
        "venn_find_people",
    ):
        assert tool in instructions
    # Invites connect at once: the model must not ask anyone to accept.
    assert "You and {name} are connected." in instructions
    assert "Never ask anyone to accept" in instructions
    assert "friends must accept" not in instructions


def test_instructions_start_with_a_question_and_state_the_boundary(client):
    instructions = client.app_state.mcp.instructions
    assert instructions.index("Start with the user's question") < instructions.index("For a generic greeting")
    for tool in ("venn_find_people", "venn_this_week", "venn_compare", "venn_save_plan", "venn_create_question_link"):
        assert tool in instructions, tool
    assert "never sends anything" in instructions
    assert "NOT synced" in instructions


def test_instructions_surface_matched_signals_in_plain_text(client):
    instructions = client.app_state.mcp.instructions
    assert "venn_whats_new" in instructions
    assert "Btw, Maya is in Berlin right now" in instructions
    # No schedule, no drafts, no proactive quiz/ask-link.
    for phrase in ("every morning", "scheduled task", "offer to draft", "Offer to draft"):
        assert phrase not in instructions
    flows = instructions.split("Only on an explicit user request")[0]
    for tool in ("venn_start_quiz", "venn_create_question_link", "venn_save_plan", "venn_add_follow_up"):
        assert tool not in flows, tool
