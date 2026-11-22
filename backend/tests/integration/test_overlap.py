"""Exercise Overlap through separate signed-in browser sessions, not just service calls."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import event

from app.db.database import get_engine
from app.services import overlap_service

ROOT = "/overlap"
PREF = ROOT + "/preference"
LOCATION = ROOT + "/location"
EMPTY = {"preference": None, "match": None}


def day(offset):
    return (datetime.now(ZoneInfo("Asia/Seoul")).date() + timedelta(days=offset)).isoformat()


def prefs(**changes):
    return {
        "area": "seongsu",
        "slot": "afternoon",
        "date": day(1),
        "interests": ["photography"],
        "adults_confirmed": True,
        **changes,
    }


def assert_anonymous(state):
    assert state["match"]["other_name"] is None
    assert "Alice" not in str(state) and "Bob" not in str(state)


def match_path(match, endpoint="respond"):
    return f"{ROOT}/matches/{match}/{endpoint}"


@pytest.fixture
def offered(web):
    alice = web("alice", name="Alice Park")
    bob = web("bob", name="Bob Kim")
    preference = prefs()
    assert alice.ok("POST", PREF, preference) == {
        "preference": {key: value for key, value in preference.items() if key != "adults_confirmed"},
        "match": None,
    }
    state = bob.ok("POST", PREF, preference)
    match_id = state["match"]["id"]
    for state in (state, alice.ok("GET", ROOT)):
        assert set(state) == {"preference", "match"}
        match = state["match"]
        assert set(match) == {"id", "status", "title", "reason", "challenge", "other_name", "meeting_point"}
        assert match["meeting_point"] is None
        assert match["id"] == match_id and match["status"] == "offered"
        assert_anonymous(state)
    return alice, bob, match_id


def test_auth_and_csrf(web):
    anon, alice = web(), web("alice")
    assert anon.err("GET", ROOT) == (401, "UNAUTHENTICATED")
    target = str(uuid4())
    for method, path, body in (
        ("POST", PREF, prefs()),
        ("DELETE", PREF, None),
        ("POST", match_path(target), {"action": "yes"}),
        ("POST", match_path(target, "report"), {"reason": "spam"}),
    ):
        assert anon.err(method, path, body) == (401, "UNAUTHENTICATED")
        assert alice.send(method, path, body, headers={}).status_code == 403
    assert alice.ok("GET", ROOT) == EMPTY


def test_private_account_location_is_independent_of_overlap_opt_in(web):
    anon, alice, bob = web(), web("alice"), web("bob")
    area = {"area": "hongdae"}
    assert anon.err("GET", LOCATION) == (401, "UNAUTHENTICATED")
    assert anon.err("PATCH", LOCATION, area) == (401, "UNAUTHENTICATED")
    assert alice.send("PATCH", LOCATION, area, headers={}).status_code == 403
    assert alice.ok("GET", LOCATION) == {"area": None}
    assert alice.ok("PATCH", LOCATION, area) == area
    for invalid in ({}, {"area": "Seoul"}, {**area, "user_id": bob.ok("GET", "/me")["user_id"]}):
        assert alice.err("PATCH", LOCATION, invalid) == (400, "INVALID_REQUEST")
    assert alice.ok("GET", LOCATION) == area
    assert bob.ok("GET", LOCATION, user_id=alice.ok("GET", "/me")["user_id"]) == {"area": None}
    assert "overlap_area" not in alice.ok("GET", "/me")
    assert alice.ok("GET", ROOT) == EMPTY

    alice.ok("POST", PREF, prefs())
    state = bob.ok("POST", PREF, prefs())
    assert state["match"] is not None
    assert alice.ok("GET", LOCATION) == area
    assert alice.ok("PATCH", LOCATION, {"area": None}) == {"area": None}
    assert alice.ok("GET", LOCATION) == {"area": None}
    assert alice.ok("GET", ROOT) == state


@pytest.mark.parametrize(
    "changes",
    [
        {"area": "Seoul"},
        {"slot": "any"},
        {"interests": ["sailing"]},
        {"interests": []},
        {"interests": ["art", "books", "walking", "coffee"]},
        {"adults_confirmed": False},
        {"adults_confirmed": "true"},
        {"interests": ["walking", "walking"]},
        {"user_id": "someone-else"},
    ],
)
def test_invalid_preference(web, changes):
    alice = web("alice")
    assert alice.err("POST", PREF, prefs(**changes)) == (400, "INVALID_REQUEST")
    assert alice.ok("GET", ROOT) == EMPTY


def test_consent_and_date_window(web):
    alice = web("alice")
    missing = prefs()
    del missing["adults_confirmed"]
    for body in (missing, prefs(date=day(-1)), prefs(date=day(7))):
        assert alice.err("POST", PREF, body) == (400, "INVALID_REQUEST")
    assert alice.ok("GET", ROOT) == EMPTY


@pytest.mark.parametrize("field", ["area", "slot", "date", "interests"])
def test_requires_same_area_day_slot_and_common_topic(web, field):
    alice, bob = web("alice"), web("bob")
    changes = {"area": "hongdae", "slot": "morning", "date": day(2), "interests": ["books"]}
    alice.ok("POST", PREF, prefs())
    assert bob.ok("POST", PREF, prefs(**{field: changes[field]}))["match"] is None
    assert alice.ok("GET", ROOT)["match"] is None


def test_shared_interest_and_complement_explained_from_each_perspective(web):
    alice, bob = web("alice"), web("bob")
    alice.ok("POST", PREF, prefs())
    b = bob.ok("POST", PREF, prefs(interests=["architecture", "photography"]))["match"]
    a = alice.ok("GET", ROOT)["match"]
    assert a["title"] == b["title"] == "One roll, one neighborhood"
    for match, who in ((a, "They"), (b, "You")):
        assert "45-minute architectural photo walk in Seongsu" in match["reason"]
        assert f"You both picked photography. {who} also picked architecture." in match["reason"]
        assert match["other_name"] is None


def test_nonmember_cannot_inspect_or_change_a_match(web, offered):
    alice, _, match = offered
    eve = web("eve")
    assert eve.ok("GET", ROOT, user_id=alice.ok("GET", "/me")["user_id"]) == EMPTY
    for endpoint, body in (("respond", {"action": "yes"}), ("report", {"reason": "safety"})):
        for target in (match, str(uuid4()), "not-a-uuid"):
            assert eve.err("POST", match_path(target, endpoint), body) == (404, "NOT_FOUND")
    assert alice.ok("GET", ROOT)["match"]["status"] == "offered"


@pytest.mark.parametrize("ending", ["withdraw", "change", "report", "expiry"])
def test_optional_public_meeting_point(web, offered, monkeypatch, ending):
    alice, bob, match = offered
    path = match_path(match)
    suggest = {"action": "suggest_spot"}
    assert web("outsider").err("POST", path, suggest) == (404, "NOT_FOUND")
    assert alice.err("POST", path, suggest) == (400, "INVALID_REQUEST")
    alice.ok("POST", path, {"action": "yes"})
    assert bob.err("POST", path, suggest) == (400, "INVALID_REQUEST")
    point = bob.ok("POST", path, {"action": "yes"})["match"]["meeting_point"]
    assert point == {"label": f"Seongsu Station Exit 3 · {day(1)} 15:00 KST", "status": "available"}
    for _ in range(2):
        assert alice.ok("POST", path, suggest)["match"]["meeting_point"]["status"] == "suggested_by_you"
    assert bob.ok("GET", ROOT)["match"]["meeting_point"]["status"] == "suggested_to_you"
    assert bob.ok("POST", path, suggest)["match"]["meeting_point"]["status"] == "agreed"
    assert alice.ok("GET", ROOT)["match"]["meeting_point"]["status"] == "agreed"
    if ending == "expiry":
        at_spot = datetime.fromisoformat(f"{day(1)}T15:00:00+09:00")
        monkeypatch.setattr(overlap_service, "utcnow", lambda: at_spot)
        assert alice.ok("GET", ROOT)["match"]["meeting_point"] is None
        assert bob.err("POST", path, suggest) == (400, "INVALID_REQUEST")
        monkeypatch.setattr(overlap_service, "utcnow", lambda: at_spot + timedelta(days=1))
    elif ending == "report":
        alice.ok("POST", match_path(match, "report"), {"reason": "safety"})
    elif ending == "change":
        alice.ok("POST", PREF, prefs(area="hongdae"))
    else:
        alice.ok("DELETE", PREF)
    assert bob.ok("GET", ROOT)["match"] is None
    assert alice.err("POST", path, suggest) == (404, "NOT_FOUND")
    if ending in {"change", "withdraw"}:
        fresh = match_path(alice.ok("POST", PREF, prefs())["match"]["id"])
        alice.ok("POST", fresh, {"action": "yes"})
        assert bob.ok("POST", fresh, {"action": "yes"})["match"]["meeting_point"]["status"] == "available"


def test_match_inputs_are_enums(offered):
    alice, _, match = offered
    assert alice.err("POST", match_path(match), {"action": "accept"}) == (400, "INVALID_REQUEST")
    assert alice.err("POST", match_path(match, "report"), {"reason": "free text"}) == (400, "INVALID_REQUEST")
    assert alice.ok("GET", ROOT)["match"]["status"] == "offered"


def test_introduction_requires_both_votes_and_is_not_friend_access(offered):
    alice, bob, match = offered
    secret = "Friends-only ceramics class"
    alice.ok(
        "POST",
        "/memories",
        {
            "category": "EXPERIENCE",
            "title": secret,
            "description": "Private plans for class.",
            "visibility": "SHARED_WITH_CONNECTIONS",
        },
    )
    waiting = alice.ok("POST", match_path(match), {"action": "yes"})
    assert waiting["match"]["status"] == "waiting" and waiting["match"]["other_name"] is None
    for state in (waiting, bob.ok("GET", ROOT)):
        assert_anonymous(state)
    introduced = bob.ok("POST", match_path(match), {"action": "yes"})
    for state, name in ((introduced, "Alice"), (alice.ok("GET", ROOT), "Bob")):
        assert state["match"]["status"] == "introduced" and state["match"]["other_name"] == name
        assert secret not in str(state)
    assert bob.ok("GET", "/friends")["friends"] == []
    assert secret not in str(bob.ok("GET", "/search", q="ceramics"))
    assert bob.err("GET", f"/friends/connection/{match}") == (404, "NOT_FOUND")


def test_expired_preferences_are_invisible_and_cannot_introduce(offered, monkeypatch):
    alice, bob, match = offered
    alice.ok("POST", match_path(match), {"action": "yes"})
    after_window = datetime.now(UTC) + timedelta(days=2)
    monkeypatch.setattr(overlap_service, "utcnow", lambda: after_window)
    assert alice.ok("GET", ROOT) == bob.ok("GET", ROOT) == EMPTY
    assert bob.send("POST", match_path(match), {"action": "yes"}).status_code in (400, 404, 409)
    assert bob.ok("GET", ROOT) == EMPTY


@pytest.mark.parametrize("blocked", [False, True])
def test_existing_connections_and_social_blocks_excluded(web, make_user, blocked):
    alice, bob = web("alice"), web("bob")
    code = alice.ok("POST", "/invites", {"max_uses": 1})["code"]
    connection = bob.ok("POST", "/invites/redeem", {"code": code})
    if blocked:
        make_user("alice").ok("venn_block_user", connection_id=connection["connection_id"])
    for person in (alice, bob):
        assert person.ok("POST", PREF, prefs())["match"] is None
    assert alice.ok("GET", ROOT)["match"] is None


def test_simultaneous_opt_ins_leave_only_one_reciprocal_pair(web):
    alice, bob, carol = web("alice"), web("bob"), web("carol")
    alice.ok("POST", PREF, prefs())
    gate = Barrier(2)

    def opt_in(person):
        gate.wait(timeout=5)
        person.ok("POST", PREF, prefs())

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(opt_in, (bob, carol)))
    matches = [person.ok("GET", ROOT)["match"] for person in (alice, bob, carol)]
    assert matches.count(None) == 1
    assert len({match["id"] for match in matches if match}) == 1


def test_reads_issue_no_writes(web, offered):
    alice, _, _ = offered
    outsider = web("outsider")
    statements = []

    def capture(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement.strip().split()[0].upper())

    engine = get_engine()
    event.listen(engine, "before_cursor_execute", capture)
    try:
        assert outsider.ok("GET", ROOT) == EMPTY
        assert alice.ok("GET", ROOT)["match"]["status"] == "offered"
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert statements and not {"INSERT", "UPDATE", "DELETE"}.intersection(statements)
    assert "no-store" in alice.get(ROOT).headers["cache-control"]


@pytest.mark.parametrize("disposition", ["withdraw", "pass", "block", "report"])
def test_close_match_for_both_participants(offered, disposition):
    alice, bob, match = offered
    bob.ok("POST", match_path(match), {"action": "yes"})
    if disposition == "withdraw":
        assert alice.ok("DELETE", PREF) == EMPTY
    elif disposition == "report":
        assert alice.ok("POST", match_path(match, "report"), {"reason": "safety"})["match"] is None
    else:
        assert alice.ok("POST", match_path(match), {"action": disposition})["match"] is None
    assert bob.send("POST", match_path(match), {"action": "yes"}).status_code in (400, 404, 409)
    for person in (alice, bob):
        assert person.ok("GET", ROOT)["match"] is None
    if disposition in {"pass", "block", "report"}:
        for person in (alice, bob):
            person.ok("DELETE", PREF)
        for person in (bob, alice):
            assert person.ok("POST", PREF, prefs())["match"] is None
        assert bob.ok("GET", ROOT)["match"] is None
