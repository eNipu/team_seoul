from datetime import timedelta

import pytest

from app.db.database import session_scope
from app.models import Connection, ConnectionRequest, Invite, User
from app.models._base import utcnow
from app.services.social_service import normalize_code


def connect(inviter, invitee) -> str:
    code = inviter.ok("venn_create_invite")["code"]
    redeemed = invitee.ok("venn_redeem_invite", code=code)
    assert redeemed["status"] == "CONNECTED"
    return redeemed["connection_id"]


def pending_request(sender, sender_name: str, recipient, recipient_name: str) -> str:
    """A request that did not come from an invite (e.g. sample data); only these need an accept."""
    for client in (sender, recipient):
        client.ok("venn_list_connections")  # make sure both accounts exist
    with session_scope() as db:
        sender_id = db.query(User).filter(User.display_name == sender_name).one().id
        recipient_id = db.query(User).filter(User.display_name == recipient_name).one().id
        req = ConnectionRequest(sender_user_id=sender_id, recipient_user_id=recipient_id, status="PENDING")
        db.add(req)
        db.flush()
        return str(req.id)


def save(user, category, title, description, visibility, tags=()):
    proposal = user.ok(
        "venn_propose_memories",
        suggested=[{"category": category, "title": title, "description": description, "tags": list(tags)}],
    )
    return user.ok(
        "venn_save_memories",
        proposal_id=proposal["proposal_id"],
        approvals=[{"index": 0, "visibility": visibility}],
    )["saved"][0]


def test_redeem_connects_both_at_once(alice, bob):
    invite = alice.ok("venn_create_invite", max_uses=2)
    assert len(invite["code"]) >= 8
    assert invite["code"] in invite["share_text"]

    redeemed = bob.ok("venn_redeem_invite", code=invite["code"].lower())
    assert redeemed["status"] == "CONNECTED"
    assert redeemed["inviter_display_name"] == "Alice"
    assert redeemed["message"] == "You and Alice are connected."
    # No pending request and no accept step: both see each other right away.
    assert alice.ok("venn_list_connections")["pending_requests"] == []
    alice_conns = alice.ok("venn_list_connections")["connections"]
    bob_conns = bob.ok("venn_list_connections")["connections"]
    assert [c["display_name"] for c in alice_conns] == ["Bob"]
    assert [c["display_name"] for c in bob_conns] == ["Alice"]
    assert alice_conns[0]["connection_id"] == bob_conns[0]["connection_id"] == redeemed["connection_id"]


def test_re_redeem_is_idempotent(alice, bob):
    code = alice.ok("venn_create_invite", max_uses=5)["code"]
    first = bob.ok("venn_redeem_invite", code=code)
    again = bob.ok("venn_redeem_invite", code=code)
    assert again["status"] == "ALREADY_CONNECTED"
    assert again["connection_id"] == first["connection_id"]
    assert again["message"] == "You and Alice are connected."
    assert len(alice.ok("venn_list_connections")["connections"]) == 1
    # A re-redeem does not use up the code.
    assert [i["use_count"] for i in alice.ok("venn_list_invites")["invites"]] == [1]


def test_redeem_settles_an_older_pending_request(alice, bob):
    request_id = pending_request(bob, "Bob", alice, "Alice")
    connect(alice, bob)
    assert alice.ok("venn_list_connections")["pending_requests"] == []
    assert alice.err("venn_respond_to_connection", request_id=request_id, accept=True).startswith("INVALID_REQUEST")


@pytest.mark.parametrize("how", ["expired", "revoked", "used_up"])
def test_dead_codes_still_fail(alice, bob, carol, how):
    code = alice.ok("venn_create_invite", max_uses=1)["code"]
    if how == "expired":
        with session_scope() as db:
            invite = db.query(Invite).filter(Invite.code == normalize_code(code)).one()
            invite.expires_at = utcnow() - timedelta(minutes=1)
    elif how == "revoked":
        alice.ok("venn_revoke_invite", code=code)
    else:
        carol.ok("venn_redeem_invite", code=code)
    assert bob.err("venn_redeem_invite", code=code).startswith("NOT_FOUND")
    assert bob.ok("venn_list_connections")["connections"] == []


def test_decline_request(alice, bob):
    request_id = pending_request(bob, "Bob", alice, "Alice")
    out = alice.ok("venn_respond_to_connection", request_id=request_id, accept=False)
    assert out["status"] == "REJECTED"
    assert alice.ok("venn_list_connections")["connections"] == []


def test_accepting_a_non_invite_request_still_works(alice, bob):
    request_id = pending_request(bob, "Bob", alice, "Alice")
    out = alice.ok("venn_respond_to_connection", request_id=request_id, accept=True)
    assert out["status"] == "ACCEPTED"
    assert alice.err("venn_respond_to_connection", request_id=request_id, accept=True).startswith("INVALID_REQUEST")


def test_own_invite_cannot_be_redeemed(alice):
    code = alice.ok("venn_create_invite")["code"]
    assert alice.err("venn_redeem_invite", code=code).startswith("INVALID_REQUEST")


def test_suggest_activity_uses_only_shared_memories(alice, bob):
    connection_id = connect(alice, bob)
    save(alice, "INTEREST", "Bouldering", "Climbs weekly", "SHARED_WITH_CONNECTIONS", ["climbing"])
    save(bob, "INTEREST", "Climbing", "Loves the climbing gym", "SHARED_WITH_CONNECTIONS", ["climbing"])
    save(bob, "INTEREST", "Secret hobby", "Private thing", "PRIVATE", ["knitting"])

    out = alice.ok("venn_suggest_activity", connection_id=connection_id)
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
    assert {c["display_name"] for c in alice.ok("venn_reconnection_suggestions")["candidates"]} == {"Bob", "Carol"}
    alice.ok("venn_log_interaction", connection_id=bob_conn, activity="coffee")
    out = alice.ok("venn_reconnection_suggestions")
    names = [c["display_name"] for c in out["candidates"]]
    assert "Carol" in names
    assert "Bob" not in names


def test_remove_connection(alice, bob):
    connection_id = connect(alice, bob)
    alice.ok("venn_remove_connection", connection_id=connection_id)
    assert bob.ok("venn_list_connections")["connections"] == []


def test_block_removes_connection_and_prevents_requests(alice, bob):
    connection_id = connect(alice, bob)
    alice.ok("venn_block_user", connection_id=connection_id)
    assert alice.ok("venn_list_connections")["connections"] == []
    code = alice.ok("venn_create_invite")["code"]
    # Blocked users get the same generic error as an invalid code.
    assert bob.err("venn_redeem_invite", code=code).startswith("NOT_FOUND")


def test_report_user(alice, bob):
    connection_id = connect(alice, bob)
    out = alice.ok("venn_report_user", connection_id=connection_id, reason="Spamming me")
    assert out == {"reported": True}


def test_delete_account_requires_confirmation(alice, bob):
    connect(alice, bob)
    assert alice.err("venn_delete_account", confirmation="yes").startswith("INVALID_REQUEST")
    alice.ok("venn_delete_account", confirmation="DELETE MY VENN ACCOUNT")
    assert bob.ok("venn_list_connections")["connections"] == []
    # Signing in again creates a fresh, empty profile.
    profile = alice.ok("venn_get_profile")
    assert profile["is_new"] is True
    assert profile["memory_count"] == 0


def test_scanning_a_used_code_again_when_already_connected_says_connected(alice, bob):
    code = alice.ok("venn_create_invite")["code"]
    first = bob.ok("venn_redeem_invite", code=code)
    assert first["status"] in ("CONNECTED", "ALREADY_CONNECTED")
    again = bob.ok("venn_redeem_invite", code=code)
    assert again["status"] == "ALREADY_CONNECTED"
    assert "are connected" in again["message"]


def test_personal_qr_is_permanent_and_works_for_many_friends(alice, bob, carol):
    first = alice.ok("venn_create_invite")
    again = alice.ok("venn_create_invite")
    assert first["code"] == again["code"]  # same QR every time
    assert first["max_uses"] > 1000
    for friend in (bob, carol):
        assert friend.ok("venn_redeem_invite", code=first["code"])["status"] in ("CONNECTED", "ALREADY_CONNECTED")
