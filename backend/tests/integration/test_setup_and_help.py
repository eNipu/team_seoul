"""Set-up (onboarding) steps on the home card and the help card."""

from tests.integration.test_social_flow import connect, save


def text(user, tool: str, **arguments) -> str:
    """The text the model reads for a tool result (the card data is in structuredContent)."""
    result = user.call(tool, **arguments)
    assert not result.get("isError"), result
    return result["content"][0]["text"]


def steps(view: dict) -> dict[str, bool]:
    return {step["key"]: step["done"] for step in view["setup"]}


def test_new_account_starts_with_all_three_steps_open(alice):
    view = alice.ok("heldly_show_dashboard")
    assert view["view"] == "welcome"
    assert [s["key"] for s in view["setup"]] == ["about_you", "your_people", "connect"]
    assert steps(view) == {"about_you": False, "your_people": False, "connect": False}
    assert view["setup"][0]["title"] == "Tell Heldly about you"
    assert all(s["title"] and s["description"] for s in view["setup"])


def test_model_is_told_to_start_the_first_open_step(alice):
    said = text(alice, "heldly_show_dashboard")
    assert "Set-up is not finished (open: about you, your people, connect)" in said
    assert "start the first open step in this same reply" in said
    # The first open step names the tools that do it.
    assert "heldly_import_chatgpt_memory" in said and "heldly_propose_memories" in said
    assert "heldly_propose_people_import" not in said


def test_steps_are_ticked_off_by_what_the_user_has_done(alice):
    save(alice, "INTEREST", "Bouldering", "Climbs twice a week", "PRIVATE")
    view = alice.ok("heldly_show_dashboard")
    assert view["view"] == "dashboard"
    assert steps(view) == {"about_you": True, "your_people": False, "connect": False}
    said = text(alice, "heldly_show_dashboard")
    assert "(open: your people, connect)" in said
    assert "heldly_propose_people_import" in said

    alice.ok("heldly_add_person", name="Maya")
    assert steps(alice.ok("heldly_show_dashboard")) == {"about_you": True, "your_people": True, "connect": False}
    said = text(alice, "heldly_show_dashboard")
    assert "(open: connect)" in said and "heldly_create_invite" in said

    alice.ok("heldly_create_invite")
    view = alice.ok("heldly_show_dashboard")
    assert steps(view) == {"about_you": True, "your_people": True, "connect": True}
    said = text(alice, "heldly_show_dashboard")
    assert "Set-up is complete." in said
    assert "not finished" not in said


def test_a_revoked_unused_invite_does_not_count_as_connecting(alice):
    code = alice.ok("heldly_create_invite")["code"]
    assert steps(alice.ok("heldly_show_dashboard"))["connect"] is True
    alice.ok("heldly_revoke_invite", code=code)
    assert steps(alice.ok("heldly_show_dashboard"))["connect"] is False


def test_a_connection_completes_people_and_connect_for_both_sides(alice, bob):
    connect(alice, bob)
    for user in (alice, bob):
        done = steps(user.ok("heldly_show_dashboard"))
        assert done == {"about_you": False, "your_people": True, "connect": True}


def test_someone_asking_to_connect_counts_as_connect_but_not_as_people(alice, bob):
    code = alice.ok("heldly_create_invite")["code"]
    bob.ok("heldly_redeem_invite", code=code)
    # Revoking afterwards changes nothing: the code was used and the request is waiting.
    alice.ok("heldly_revoke_invite", code=code)
    done = steps(alice.ok("heldly_show_dashboard"))
    assert done["connect"] is True
    assert done["your_people"] is False


def test_setup_state_is_per_user(alice, bob):
    save(alice, "INTEREST", "Bouldering", "Climbs twice a week", "PRIVATE")
    alice.ok("heldly_add_person", name="Maya")
    assert steps(bob.ok("heldly_show_dashboard")) == {"about_you": False, "your_people": False, "connect": False}


def test_help_card(alice):
    view = alice.ok("heldly_help")
    assert view["view"] == "help"
    assert view["display_name"] == "Alice"
    keys = [t["key"] for t in view["topics"]]
    assert keys == ["setup", "memories", "people", "connect", "stay_close", "quiz"]
    for topic in view["topics"]:
        assert topic["title"] and topic["description"]
        assert 1 <= len(topic["examples"]) <= 4
    assert "Nothing is saved until you approve it." in view["privacy"]
    assert "Heldly never contacts anyone for you." in view["privacy"]
    assert steps(view) == {"about_you": False, "your_people": False, "connect": False}


def test_help_offers_setup_but_does_not_start_it(alice):
    said = text(alice, "heldly_help")
    assert "Showing the help card" in said
    assert "Offer, in one line, to continue with the first open step" in said
    assert "start the first open step in this same reply" not in said

    save(alice, "INTEREST", "Bouldering", "Climbs twice a week", "PRIVATE")
    alice.ok("heldly_add_person", name="Maya")
    alice.ok("heldly_create_invite")
    assert "Set-up is complete." in text(alice, "heldly_help")
    assert all(alice.ok("heldly_help")["setup"][i]["done"] for i in range(3))


def test_help_changes_nothing(alice):
    alice.ok("heldly_help")
    # Still a brand-new, empty account: asking for help must not move the user past the welcome card.
    assert alice.ok("heldly_show_dashboard")["view"] == "welcome"


def test_help_examples_are_requests_the_server_instructions_route(alice):
    """Every area on the help card is something the model is told how to handle."""
    instructions = alice.rpc(
        "initialize",
        {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "t", "version": "0"}},
    ).json()["result"]["instructions"]
    assert "heldly_help" in instructions
    assert "Start with set-up" in instructions
    for tool in (
        "heldly_import_chatgpt_memory",
        "heldly_propose_people_import",
        "heldly_create_invite",
        "heldly_redeem_invite",
        "heldly_start_quiz",
        "heldly_find_people",
    ):
        assert tool in instructions
