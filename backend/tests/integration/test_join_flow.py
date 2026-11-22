"""Two people connect end to end: invite link / QR -> /app/join -> redeem on the web -> signals in ChatGPT."""

import segno

from app.services.social_service import qr_rows
from tests.integration.test_social_flow import save


def test_two_people_connect_from_an_invite_link(client, web, make_user):
    alice_web, bob_web = web("alice", "Alice"), web("bob", "Bob")
    alice, bob = make_user("alice", name="Alice"), make_user("bob", name="Bob")

    invite = alice_web.ok("POST", "/invites", {"max_uses": 1})
    code = invite["code"]
    # The QR encodes exactly the invite link, and the link's page sends the friend to the web join flow.
    assert invite["link"] == f"http://localhost:8081/i/{code}"
    assert invite["qr"] == qr_rows(invite["link"])
    assert invite["qr"] == ["".join("1" if c else "0" for c in row) for row in segno.make(invite["link"], error="m", micro=False).matrix]
    page = client.get(f"/i/{code}")
    assert f'href="http://localhost:8081/app/join?code={code}"' in page.text

    redeemed = bob_web.ok("POST", "/invites/redeem", {"code": code})
    assert redeemed["status"] == "CONNECTED"
    assert redeemed["inviter_display_name"] == "Alice"
    # Both see each other right away, on the web and in ChatGPT.
    assert [c["display_name"] for c in alice.ok("venn_list_connections")["connections"]] == ["Bob"]
    assert [c["display_name"] for c in bob.ok("venn_list_connections")["connections"]] == ["Alice"]

    save(bob, "INTEREST", "Marketing", "Brand marketing", "PRIVATE", tags=["marketing"])
    save(alice, "WORK", "Marketing launch", "Looking for help with a marketing launch", "SHARED_WITH_CONNECTIONS", tags=["marketing"])
    signals = bob.ok("venn_whats_new")["signals"]
    assert signals and "Alice" in str(signals[0])
