from datetime import timedelta

from app.db.database import session_scope
from app.models import Connection
from app.models._base import utcnow


def connect(inviter, invitee) -> str:
    code = inviter.ok("heldly_create_invite")["code"]
    redeemed = invitee.ok("heldly_redeem_invite", code=code)
    assert redeemed["status"] == "PENDING"
    pending = inviter.ok("heldly_list_connections")["pending_requests"]
    request_id = pending[0]["request_id"]
    accepted = inviter.ok("heldly_respond_to_connection", request_id=request_id, accept=True)
    assert accepted["status"] == "ACCEPTED"
    return accepted["connection_id"]


def save(user, category, title, description, visibility, tags=()):
    proposal = user.ok(
        "heldly_propose_memories",
        suggested=[{"category": category, "title": title, "description": description, "tags": list(tags)}],
    )
    return user.ok(
        "heldly_save_memories",
        proposal_id=proposal["proposal_id"],
        approvals=[{"index": 0, "visibility": visibility}],
    )["saved"][0]


def test_invite_redeem_accept_creates_mutual_connection(alice, bob):
    invite = alice.ok("heldly_create_invite", max_uses=2)
    assert len(invite["code"]) >= 8
    assert invite["code"] in invite["share_text"]

    redeemed = bob.ok("heldly_redeem_invite", code=invite["code"].lower())
    assert redeemed["inviter_display_name"] == "Alice"
    # Not connected until Alice accepts.
    assert bob.ok("heldly_list_connections")["connections"] == []

    pending = alice.ok("heldly_list_connections")["pending_requests"]
    assert [p["sender_display_name"] for p in pending] == ["Bob"]
    out = alice.ok("heldly_respond_to_connection", request_id=pending[0]["request_id"], accept=True)

    alice_conns = alice.ok("heldly_list_connections")["connections"]
    bob_conns = bob.ok("heldly_list_connections")["connections"]
    assert [c["display_name"] for c in alice_conns] == ["Bob"]
    assert [c["display_name"] for c in bob_conns] == ["Alice"]
    assert alice_conns[0]["connection_id"] == bob_conns[0]["connection_id"] == out["connection_id"]


def test_decline_request(alice, bob):
    code = alice.ok("heldly_create_invite")["code"]
    bob.ok("heldly_redeem_invite", code=code)
    request_id = alice.ok("heldly_list_connections")["pending_requests"][0]["request_id"]
    out = alice.ok("heldly_respond_to_connection", request_id=request_id, accept=False)
    assert out["status"] == "REJECTED"
    assert alice.ok("heldly_list_connections")["connections"] == []


def test_duplicate_requests_are_not_created(alice, bob):
    code = alice.ok("heldly_create_invite", max_uses=5)["code"]
    assert bob.ok("heldly_redeem_invite", code=code)["status"] == "PENDING"
    assert bob.ok("heldly_redeem_invite", code=code)["status"] == "ALREADY_PENDING"
    assert len(alice.ok("heldly_list_connections")["pending_requests"]) == 1
    request_id = alice.ok("heldly_list_connections")["pending_requests"][0]["request_id"]
    alice.ok("heldly_respond_to_connection", request_id=request_id, accept=True)
    assert bob.ok("heldly_redeem_invite", code=code)["status"] == "ALREADY_CONNECTED"
    # Responding twice fails.
    assert alice.err("heldly_respond_to_connection", request_id=request_id, accept=True).startswith("INVALID_REQUEST")


def test_own_invite_cannot_be_redeemed(alice):
    code = alice.ok("heldly_create_invite")["code"]
    assert alice.err("heldly_redeem_invite", code=code).startswith("INVALID_REQUEST")


def test_suggest_activity_uses_only_shared_memories(alice, bob):
    connection_id = connect(alice, bob)
    save(alice, "INTEREST", "Bouldering", "Climbs weekly", "SHARED_WITH_CONNECTIONS", ["climbing"])
    save(bob, "INTEREST", "Climbing", "Loves the climbing gym", "SHARED_WITH_CONNECTIONS", ["climbing"])
    save(bob, "INTEREST", "Secret hobby", "Private thing", "PRIVATE", ["knitting"])

    out = alice.ok("heldly_suggest_activity", connection_id=connection_id)
    assert out["view"] == "activity_ideas"
    assert (out["kind"], out["id"], out["display_name"]) == ("connection", connection_id, "Bob")
    assert out["suggestions"][0]["title"] == "Go climbing"
    assert "climbing" in [s.lower() for s in out["shared_interests"]]
    blob = str(out).lower()
    assert "knitting" not in blob
    assert "secret hobby" not in blob


def test_log_interaction_and_reconnection(alice, bob, carol):
    bob_conn = connect(alice, bob)
    connect(alice, carol)
    with session_scope() as db:  # pretend both friendships started 30 days ago
        for conn in db.query(Connection).all():
            conn.created_at = utcnow() - timedelta(days=30)
    assert {c["display_name"] for c in alice.ok("heldly_reconnection_suggestions")["candidates"]} == {"Bob", "Carol"}
    alice.ok("heldly_log_interaction", connection_id=bob_conn, activity="coffee")
    out = alice.ok("heldly_reconnection_suggestions")
    names = [c["display_name"] for c in out["candidates"]]
    assert "Carol" in names
    assert "Bob" not in names


def test_remove_connection(alice, bob):
    connection_id = connect(alice, bob)
    alice.ok("heldly_remove_connection", connection_id=connection_id)
    assert bob.ok("heldly_list_connections")["connections"] == []


def test_block_removes_connection_and_prevents_requests(alice, bob):
    connection_id = connect(alice, bob)
    alice.ok("heldly_block_user", connection_id=connection_id)
    assert alice.ok("heldly_list_connections")["connections"] == []
    code = alice.ok("heldly_create_invite")["code"]
    # Blocked users get the same generic error as an invalid code.
    assert bob.err("heldly_redeem_invite", code=code).startswith("NOT_FOUND")


def test_report_user(alice, bob):
    connection_id = connect(alice, bob)
    out = alice.ok("heldly_report_user", connection_id=connection_id, reason="Spamming me")
    assert out == {"reported": True}


def test_delete_account_requires_confirmation(alice, bob):
    connect(alice, bob)
    assert alice.err("heldly_delete_account", confirmation="yes").startswith("INVALID_REQUEST")
    alice.ok("heldly_delete_account", confirmation="DELETE MY HELDLY ACCOUNT")
    assert bob.ok("heldly_list_connections")["connections"] == []
    # Signing in again creates a fresh, empty profile.
    profile = alice.ok("heldly_get_profile")
    assert profile["is_new"] is True
    assert profile["memory_count"] == 0
