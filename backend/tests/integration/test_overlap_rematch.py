"""Regression coverage for waitlist writes and the read-only eligibility snapshot."""

from datetime import datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import event, select

from app.db.database import session_scope
from app.models import Block, Connection, OverlapExclusion, OverlapPreference, User
from app.services import overlap_service

from .test_overlap import PREF, ROOT, match_path, prefs


@pytest.fixture
def pair(web):
    alice, bob = web("alice"), web("bob")
    alice.ok("POST", PREF, prefs())
    match = bob.ok("POST", PREF, prefs())["match"]["id"]
    return alice, bob, match


def connect(alice, bob):
    code = alice.ok("POST", "/invites", {"max_uses": 1})["code"]
    return bob.ok("POST", "/invites/redeem", {"code": code})["connection_id"]


@pytest.mark.parametrize("cause", ["delete", "connection", "social_block"])
def test_new_opt_in_reclaims_invalid_offer(web, make_user, pair, cause):
    alice, bob, old = pair
    carol = web("carol")
    if cause == "delete":
        make_user("alice").ok("venn_delete_account", confirmation="DELETE MY VENN ACCOUNT")
    else:
        cid = connect(alice, bob)
        if cause == "social_block":
            make_user("alice").ok("venn_block_user", connection_id=cid)
        # Either released participant is eligible. Exclude Alice from Carol so the
        # assertion does not depend on random UUID ordering.
        connect(alice, carol)
    fresh = carol.ok("POST", PREF, prefs())["match"]
    assert fresh["status"] == "offered" and fresh["id"] != old
    assert bob.ok("GET", ROOT)["match"] == fresh


@pytest.mark.parametrize("action", ["withdraw", "change", "pass", "block", "report"])
def test_released_peer_matches_waiter(web, pair, action):
    alice, bob, old = pair
    carol = web("carol")
    assert carol.ok("POST", PREF, prefs())["match"] is None
    if action == "withdraw":
        alice.ok("DELETE", PREF)
    elif action == "change":
        alice.ok("POST", PREF, prefs(area="hongdae"))
    elif action == "report":
        alice.ok("POST", match_path(old, "report"), {"reason": "safety"})
    else:
        alice.ok("POST", match_path(old), {"action": action})
    fresh = carol.ok("GET", ROOT)["match"]
    assert fresh["status"] == "offered" and fresh["id"] != old
    assert bob.ok("GET", ROOT)["match"] == fresh


def test_connection_replaced_by_block_during_poll(pair, db):
    alice, bob, match = pair
    for member in (alice, bob):
        member.ok("POST", match_path(match), {"action": "yes"})
    cid = UUID(connect(alice, bob))
    user = db.get(User, UUID(alice.ok("GET", "/me")["user_id"]))
    statements = []

    def transition(conn, cursor, sql, params, context, many):
        statements.append(sql)
        if "connections" in sql:
            with session_scope() as writer:
                connection = writer.get(Connection, cid)
                writer.add(Block(blocker_user_id=connection.user_a_id, blocked_user_id=connection.user_b_id))
                writer.delete(connection)

    conn = db.connection()
    event.listen(conn, "before_cursor_execute", transition)
    try:
        assert overlap_service.get_state(db, user).match is None
    finally:
        event.remove(conn, "before_cursor_execute", transition)
    assert len(statements) == 1 and "connections" in statements[0]


@pytest.mark.parametrize("action", ["yes", "report"])
def test_cutoff_while_waiting_for_lock(pair, db, monkeypatch, action):
    alice, _, match = pair
    cutoff = datetime.fromisoformat(f"{prefs()['date']}T18:00:00+09:00")
    clock = cutoff - timedelta(seconds=1)
    lock = overlap_service._lock

    def delayed_lock(session):
        nonlocal clock
        lock(session)
        clock = cutoff

    monkeypatch.setattr(overlap_service, "_lock", delayed_lock)
    monkeypatch.setattr(overlap_service, "utcnow", lambda: clock)
    path, body = (
        (match_path(match, "report"), {"reason": "spam"})
        if action == "report"
        else (match_path(match), {"action": "yes"})
    )
    assert alice.err("POST", path, body) == (404, "NOT_FOUND")
    seats = db.scalars(select(OverlapPreference)).all()
    assert len(seats) == 2 and all(p.match_id == UUID(match) and not p.accepted for p in seats)
    assert db.scalar(select(OverlapExclusion)) is None
