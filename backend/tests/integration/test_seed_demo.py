"""`make seed`: the demo data must give every card something to show, and must be removable."""

from __future__ import annotations

from sqlalchemy import select

from app.db.database import session_scope
from app.models import Person, User
from scripts import seed_demo


def _seed(username: str) -> dict[str, int]:
    with session_scope() as db:
        return seed_demo.seed(db, seed_demo._me(db, username))


def _by_name(items: list[dict], name: str) -> dict:
    return next(i for i in items if i["display_name" if "display_name" in i else "name"] == name)


def test_seed_fills_every_card(alice):
    assert alice.ok("venn_show_dashboard")["view"] == "welcome"

    counts = _seed("alice")
    assert counts == {"connections": 3, "pending_requests": 1, "people": 5, "my_memories": 6}

    home = alice.ok("venn_show_dashboard")
    assert home["view"] == "dashboard"
    assert {c["display_name"] for c in home["connections"]} == {"Jun Park", "Hana Kim", "Diego Alvarez"}
    assert len(home["people"]) == 5
    assert [r["sender_display_name"] for r in home["pending_requests"]] == ["Sofia Rossi"]
    jun = _by_name(home["connections"], "Jun Park")["connection_id"]
    hana = _by_name(home["connections"], "Hana Kim")["connection_id"]
    diego = _by_name(home["connections"], "Diego Alvarez")["connection_id"]
    maya = _by_name(home["people"], "Maya Chen")["person_id"]

    friend = alice.ok("venn_view_friend", connection_id=jun)
    assert friend["bio"] and friend["shared_memories"] and friend["recent_interactions"]
    assert [f["text"] for f in friend["follow_ups"]] == ["Ask how the new job is going"]
    # Jun's private memory never reaches a connection.
    assert "moving abroad" not in str(friend).lower()

    ideas = alice.ok("venn_suggest_activity", connection_id=diego)
    assert "hiking" in ideas["shared_interests"] and ideas["suggestions"]

    reconnect = alice.ok("venn_reconnection_suggestions")
    assert reconnect["candidates"][0]["display_name"] == "Aunt Yuna"

    found = alice.ok("venn_find_people", query="who do I know who climbs")
    assert {r["display_name"] for r in found["results"]} >= {"Jun Park", "Priya Nair"}

    group = alice.ok("venn_plan_group", connection_ids=[hana, diego])
    assert group["common_to_all"] == ["board games"]

    brief = alice.ok("venn_meetup_brief", person_id=maya)
    assert brief["things_to_ask"] and brief["conversation_starters"]

    assert len(alice.ok("venn_start_quiz", connection_id=jun)["questions"]) >= 3
    assert len(alice.ok("venn_start_quiz")["questions"]) >= 3


def test_seed_is_repeatable_and_leaves_own_data_alone(alice):
    alice.ok("venn_add_person", name="Maya Chen", relationship="my sister")
    proposal = alice.ok("venn_propose_memories", text="I love sailing.")
    alice.ok(
        "venn_save_memories",
        proposal_id=proposal["proposal_id"],
        approvals=[{"index": 0, "visibility": "PRIVATE"}],
    )

    first = _seed("alice")
    second = _seed("alice")
    assert first == second
    # She already had a memory, so none were added for her.
    assert second["my_memories"] == 0
    assert alice.ok("venn_list_memories")["count"] == 1

    home = alice.ok("venn_show_dashboard")
    assert len(home["connections"]) == 3
    assert len(home["pending_requests"]) == 1
    # Five seeded notes plus her own "Maya Chen" (different relationship).
    assert len(home["people"]) == 6

    with session_scope() as db:
        me = db.scalar(select(User).where(User.auth_subject == "dev|alice"))
        removed = seed_demo.remove(db, me)
    assert removed == {"demo_users": 4, "people": 5}

    home = alice.ok("venn_show_dashboard")
    assert home["connections"] == [] and home["pending_requests"] == []
    assert [(p["name"], p["relationship"]) for p in home["people"]] == [("Maya Chen", "my sister")]
    with session_scope() as db:
        assert db.scalars(select(User).where(User.auth_subject.like("dev|demo-%"))).all() == []
        assert len(db.scalars(select(Person)).all()) == 1


def test_seed_cli_refuses_bad_usernames_and_real_sign_in(client, monkeypatch, capsys):
    assert seed_demo.main(["--me", "demo-jun"]) == 2
    assert seed_demo.main(["--me", "Not A Name!"]) == 2

    class Prod:
        is_production = False
        auth_mode = "jwt"

    monkeypatch.setattr(seed_demo, "get_settings", lambda: Prod())
    assert seed_demo.main(["--me", "alice"]) == 2
    assert "Refusing to seed" in capsys.readouterr().err
