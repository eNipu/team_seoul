"""The website's API: the same account and the same rules as the ChatGPT plugin."""

import pytest

from app.db.database import session_scope
from app.models import User

from .test_solo_value import remember

NO_HEADER: dict = {}


def test_public_widget_preview_is_network_isolated_and_creates_no_account(client, settings, db):
    assert client.get("/widget-preview").status_code == 503
    settings.widget_path.write_text("<!doctype html><title>Widget fixture</title>")
    preview = client.get("/widget-preview?view=preview_review")
    assert preview.status_code == 200
    assert "Widget fixture" in preview.text
    csp = preview.headers["Content-Security-Policy"]
    assert "default-src 'none'" in csp
    assert "form-action 'none'" in csp
    assert "frame-ancestors https://joinvennai.com https://www.joinvennai.com" in csp
    assert "set-cookie" not in preview.headers
    assert db.query(User).count() == 0


# ------------------------------------------------------------------------------- sign-in
def test_session_reports_signed_out(web):
    anon = web()
    state = anon.ok("GET", "/session")
    assert state == {
        "signed_in": False,
        "auth_mode": "dev",
        "sign_in_available": True,
        "google_sso_available": False,
        "dev_sign_in_available": True,
        "passcode_required": False,
        "display_name": None,
        "username": None,
    }
    assert anon.err("GET", "/me") == (401, "UNAUTHENTICATED")
    assert anon.err("GET", "/home") == (401, "UNAUTHENTICATED")


def test_sign_in_never_creates_an_account_by_itself(web):
    anon = web()
    status, code = anon.err("POST", "/session", {"username": "dana"})
    assert (status, code) == (404, "NOT_FOUND")
    with session_scope() as db:
        assert db.query(User).count() == 0

    created = anon.ok("POST", "/session", {"username": "Dana", "display_name": "Dana Lee", "create": True})
    assert created["created"] is True and created["username"] == "dana" and created["display_name"] == "Dana Lee"
    cookie = anon.http.cookies.get("venn_session")
    assert cookie
    state = anon.ok("GET", "/session")
    assert state["signed_in"] is True and state["display_name"] == "Dana Lee" and state["username"] == "dana"

    again = web()
    back = again.ok("POST", "/session", {"username": "dana"})
    assert back["created"] is False and back["user_id"] == created["user_id"]

    assert anon.ok("DELETE", "/session") == {"signed_out": True}
    assert anon.err("GET", "/me") == (401, "UNAUTHENTICATED")


def test_session_cookie_is_http_only(web, client):
    anon = web()
    resp = anon.send("POST", "/session", {"username": "dana", "create": True})
    header = resp.headers["set-cookie"].lower()
    assert "httponly" in header and "samesite=lax" in header and "path=/" in header


@pytest.mark.parametrize("username", ["a", "has space", "UPPER!", "-lead", "x" * 40, ""])
def test_bad_usernames_are_refused(web, username):
    status, code = web().err("POST", "/session", {"username": username, "create": True})
    assert status == 400 and code == "INVALID_REQUEST"


def test_changes_need_the_site_header(web):
    dana = web("dana")
    # A form posted from another site cannot add this header, so it is refused.
    refused = dana.send("POST", "/people", {"name": "Maya"}, headers=NO_HEADER)
    assert refused.status_code == 403 and refused.json()["error"]["code"] == "FORBIDDEN"
    assert dana.send("DELETE", "/session", headers=NO_HEADER).status_code == 403
    assert dana.send("POST", "/session", {"username": "dana"}, headers=NO_HEADER).status_code == 403
    assert dana.ok("GET", "/people")["count"] == 0
    # Reading needs no header.
    assert dana.get("/home").status_code == 200


def test_forged_or_foreign_cookies_are_ignored(web, client):
    import jwt

    forged = jwt.encode({"sub": "dana", "typ": "web"}, "not-the-secret-not-the-secret-12345", algorithm="HS256")
    anon = web()
    anon.http.cookies.set("venn_session", forged)
    assert anon.err("GET", "/me") == (401, "UNAUTHENTICATED")
    # An MCP access token is not a website session.
    from tests.conftest import mint_token

    anon.http.cookies.set("venn_session", mint_token(client, "dana"))
    assert anon.err("GET", "/me") == (401, "UNAUTHENTICATED")


# ------------------------------------------------------------- one account, two ways in
def test_saved_in_chatgpt_shows_up_on_the_website(make_user, web):
    """The demo: save a memory in ChatGPT, then search for it on the website."""
    chat = make_user("gene", name="Gene")
    remember(chat, "Photo walks with Maya", "Maya and I used to take photo walks.", ["Maya"])

    site = web()
    signed_in = site.ok("POST", "/session", {"username": "gene"})  # no `create`: the account already exists
    assert signed_in["created"] is False and signed_in["display_name"] == "Gene"

    found = site.ok("GET", "/search", q="photography")
    assert found["view"] == "people_search"
    assert [r["display_name"] for r in found["results"]] == ["Maya"]
    assert found["results"][0]["why"] == "From your memory “Photo walks with Maya”."
    assert [m["title"] for m in found["memories"]] == ["Photo walks with Maya"]

    me = site.ok("GET", "/me")
    assert me["username"] == "gene" and me["mcp_url"].endswith("/mcp") and me["auth_mode"] == "dev"
    with session_scope() as db:
        assert db.query(User).filter(User.auth_subject == "dev|gene").count() == 1
        assert db.query(User).count() == 1


def test_saved_on_the_website_shows_up_in_chatgpt(make_user, web):
    site = web("gene", name="Gene")
    added = site.ok("POST", "/people", {"name": "Maya Chen", "relationship": "college roommate"})
    made = site.ok(
        "POST",
        "/memories",
        {
            "category": "EXPERIENCE",
            "title": "Photo walks with Maya",
            "description": "We used to take photo walks.",
            "people": ["Maya", "Tom"],
        },
    )
    assert made["memory"]["visibility"] == "PRIVATE" and made["memory"]["people"] == ["Maya", "Tom"]
    assert [p["name"] for p in made["people_added"]] == ["Tom"]  # Maya was already there
    site.ok("POST", f"/friends/person/{added['person_id']}/follow-ups", {"text": "Ask about her exhibition"})
    site.ok("POST", "/plans", {"title": "Photo walk", "person_ids": [added["person_id"]]})

    chat = make_user("gene", name="Gene")
    assert chat.ok("venn_find_people", query="photography")["results"][0]["display_name"] == "Maya Chen"
    home = chat.ok("venn_show_dashboard")
    assert home["view"] == "dashboard"
    assert sorted(p["name"] for p in home["people"]) == ["Maya Chen", "Tom"]
    assert [p["title"] for p in home["plans"]] == ["Photo walk"]
    friend = chat.ok("venn_view_friend", person_id=added["person_id"])
    assert [f["text"] for f in friend["follow_ups"]] == ["Ask about her exhibition"]


# ------------------------------------------------------------------------- every route
def test_home_help_and_profile(web):
    dana = web("dana", name="Dana")
    home = dana.ok("GET", "/home")
    assert home["view"] == "welcome" and len(home["setup"]) == 3
    assert dana.ok("GET", "/help")["view"] == "help"
    profile = dana.ok("PATCH", "/me", {"bio": "Hi", "social_goals": ["reconnect"]})
    assert profile["bio"] == "Hi" and profile["social_goals"] == ["reconnect"]
    assert dana.ok("GET", "/me")["profile"]["bio"] == "Hi"


def test_memories_routes(web):
    dana = web("dana")
    made = dana.ok("POST", "/memories", {"category": "INTEREST", "title": "Ramen", "description": "Love ramen."})
    memory_id = made["memory"]["memory_id"]
    assert made["people_added"] == []
    dana.ok("POST", "/memories", {"category": "WORK", "title": "Bakery", "description": "I run a bakery."})
    assert dana.ok("GET", "/memories")["count"] == 2
    assert [m["title"] for m in dana.ok("GET", "/memories", q="ramen")["memories"]] == ["Ramen"]
    assert [m["title"] for m in dana.ok("GET", "/memories", category="WORK")["memories"]] == ["Bakery"]
    edited = dana.ok("PATCH", f"/memories/{memory_id}", {"title": "Tonkotsu ramen"})
    assert edited["title"] == "Tonkotsu ramen"
    assert dana.ok("DELETE", f"/memories/{memory_id}") == {"deleted": True, "memory_id": memory_id}
    assert dana.ok("GET", "/memories")["count"] == 1
    # The same refusals as in ChatGPT.
    body = {"category": "INTEREST", "title": "Login", "description": "My password is hunter2"}
    assert dana.err("POST", "/memories", body) == (422, "PRIVACY_VIOLATION")
    assert dana.err("POST", "/memories", {"category": "NOPE", "title": "x", "description": "y"})[0] == 400
    assert dana.err("POST", "/memories", {"title": "x"}) == (400, "INVALID_REQUEST")


def test_people_and_friend_routes(web):
    dana = web("dana")
    dana.ok("POST", "/memories", {"category": "INTEREST", "title": "Bouldering", "description": "I boulder."})
    maya = dana.ok(
        "POST",
        "/people",
        {
            "name": "Maya Chen",
            "relationship": "roommate",
            "interests": ["bouldering", "pottery"],
            "last_met_days_ago": 40,
        },
    )
    pid = maya["person_id"]
    assert dana.ok("PATCH", f"/people/{pid}", {"notes": "Moved to Busan."})["notes"] == "Moved to Busan."
    assert dana.ok("GET", "/people")["count"] == 1

    friends = dana.ok("GET", "/friends")
    assert friends["count"] == 1
    summary = friends["friends"][0]
    assert summary["kind"] == "person" and summary["id"] == pid and summary["on_venn"] is False
    assert summary["open_follow_ups"] == 0 and summary["is_sample"] is False

    assert dana.ok("GET", f"/friends/person/{pid}")["view"] == "friend"
    venn = dana.ok("GET", f"/friends/person/{pid}/venn")
    assert venn["view"] == "venn" and "bouldering" in [s.lower() for s in venn["shared"]]
    assert dana.ok("GET", f"/friends/person/{pid}/ideas")["view"] == "activity_ideas"
    assert dana.ok("GET", f"/friends/person/{pid}/brief")["view"] == "brief"

    logged = dana.ok("POST", f"/friends/person/{pid}/interactions", {"activity": "Climbing"})
    assert logged["recorded"] is True and logged["kind"] == "person"
    follow = dana.ok("POST", f"/friends/person/{pid}/follow-ups", {"text": "Ask about Busan"})
    listed = dana.ok("GET", "/follow-ups")
    assert listed["count"] == 1
    assert listed["follow_ups"][0] == {**follow, "kind": "person", "id": pid, "display_name": "Maya Chen"}
    assert dana.ok("GET", "/friends")["friends"][0]["open_follow_ups"] == 1
    assert dana.ok("POST", f"/follow-ups/{follow['follow_up_id']}/done")["done"] is True
    assert dana.ok("GET", "/follow-ups")["count"] == 0

    assert dana.err("GET", "/friends/alien/123")[0] == 404
    assert dana.err("GET", "/friends/person/not-a-uuid") == (404, "NOT_FOUND")
    assert dana.ok("DELETE", f"/people/{pid}") == {"deleted": True, "person_id": pid}


def test_import_preview_then_import(web):
    dana = web("dana")
    preview = dana.ok(
        "POST",
        "/people/import-preview",
        {"people": [{"name": "Jun Park"}, {"name": "Hana Kim", "interests": ["jazz"]}], "source": "pasted list"},
    )
    assert preview["view"] == "people_import" and len(preview["candidates"]) == 2
    assert dana.ok("GET", "/people")["count"] == 0  # a preview saves nothing
    done = dana.ok("POST", "/people/import", {"import_id": preview["import_id"], "indexes": [1]})
    assert done["count"] == 1 and done["imported"][0]["name"] == "Hana Kim"
    assert dana.err("POST", "/people/import-preview", {"people": []})[0] == 400


def test_this_week_reconnect_quiz_and_search(web):
    dana = web("dana")
    assert dana.ok("GET", "/this-week")["actions"] == []
    for name, rel, interest in (("Maya", "roommate", "pottery"), ("Tom", "coworker", "chess"), ("Priya", "gym", "tea")):
        dana.ok(
            "POST", "/people", {"name": name, "relationship": rel, "interests": [interest], "last_met_days_ago": 50}
        )
    assert dana.ok("GET", "/this-week")["actions"][0]["type"] == "reach_out"
    assert len(dana.ok("GET", "/reconnect")["candidates"]) == 3
    assert dana.ok("GET", "/quiz")["title"] == "How well do you remember your people?"
    assert dana.ok("GET", "/search", q="chess")["results"][0]["display_name"] == "Tom"
    assert dana.err("GET", "/search", q="c")[0] == 400
    assert dana.err("GET", "/search")[0] == 400


def test_plans_routes(web):
    dana = web("dana")
    maya = dana.ok("POST", "/people", {"name": "Maya"})
    plan = dana.ok("POST", "/plans", {"title": "Photo walk", "details": "River", "person_ids": [maya["person_id"]]})
    assert plan["status"] == "planned" and plan["members"][0]["display_name"] == "Maya"
    assert dana.ok("GET", "/plans")["count"] == 1
    assert dana.ok("POST", f"/plans/{plan['plan_id']}/done") == {"done": True, "plan_id": plan["plan_id"], "logged": 1}
    assert dana.ok("GET", "/plans")["count"] == 0
    assert dana.ok("GET", "/plans", status="done")["count"] == 1
    assert dana.ok("GET", "/plans", status="all")["count"] == 1
    assert dana.err("GET", "/plans", status="later")[0] == 400
    assert dana.ok("DELETE", f"/plans/{plan['plan_id']}")["deleted"] is True


def test_connecting_between_website_and_chatgpt(web, make_user):
    dana = web("dana", name="Dana")
    invite = dana.ok("POST", "/invites", {"max_uses": 1})
    assert invite["view"] == "invite" and invite["link"].endswith(f"/i/{invite['code']}")
    bob = make_user("bob", name="Bob")
    assert bob.ok("venn_redeem_invite", code=invite["code"])["status"] == "PENDING"
    request = dana.ok("GET", "/home")["pending_requests"][0]
    accepted = dana.ok("POST", f"/requests/{request['request_id']}", {"accept": True})
    assert accepted["status"] == "ACCEPTED"
    friends = dana.ok("GET", "/friends")["friends"]
    assert friends[0]["kind"] == "connection" and friends[0]["display_name"] == "Bob" and friends[0]["on_venn"] is True
    assert dana.ok("GET", f"/friends/connection/{accepted['connection_id']}")["view"] == "friend"

    code = bob.ok("venn_create_invite")["code"]
    carol = web("carol")
    assert carol.ok("POST", "/invites/redeem", {"code": code})["status"] == "PENDING"
    assert carol.err("POST", "/invites/redeem", {"code": "ZZZZ-ZZZZ"}) == (404, "NOT_FOUND")


def test_answers_routes(web, client):
    dana = web("dana", name="Dana")
    link = dana.ok("POST", "/question-links", {"name": "Hana"})
    assert link["view"] == "ask_link"
    token = link["link"].rsplit("/q/", 1)[1]
    client.post(f"/q/{token}", data={"name": "Hana", "into": "jazz", "ask": "the new flat", "consent": "yes"})
    answers = dana.ok("GET", "/answers")
    assert answers["view"] == "answers" and len(answers["responses"]) == 1
    assert dana.ok("GET", "/home")["pending_answers"] == 1
    rid = answers["responses"][0]["response_id"]
    saved = dana.ok("POST", f"/answers/{rid}/save", {"keys": ["into"], "name": "Hana Kim"})
    assert saved["person"]["name"] == "Hana Kim" and saved["added_interests"] == ["jazz"]
    assert dana.err("POST", f"/answers/{rid}/save", {"keys": ["into"]}) == (404, "NOT_FOUND")

    open_link = dana.ok("POST", "/question-links", {})
    assert dana.ok("DELETE", f"/question-links/{open_link['link_id']}")["revoked"] is True
    token = open_link["link"].rsplit("/q/", 1)[1]
    assert client.get(f"/q/{token}").status_code == 404


def test_sample_routes(web):
    dana = web("dana")
    loaded = dana.ok("POST", "/sample")
    assert loaded["loaded"] is True and loaded["people"] == 5
    home = dana.ok("GET", "/home")
    assert home["view"] == "dashboard" and home["sample_loaded"] is True
    assert dana.ok("GET", "/friends")["count"] == 8
    assert dana.ok("DELETE", "/sample")["removed"] is True
    assert dana.ok("GET", "/home")["view"] == "welcome"


def test_delete_account_from_the_website(web, make_user):
    dana = web("dana")
    dana.ok("POST", "/people", {"name": "Maya"})
    assert dana.err("DELETE", "/me", {"confirmation": "yes"})[0] == 400
    assert dana.ok("DELETE", "/me", {"confirmation": "DELETE MY VENN ACCOUNT"}) == {"deleted": True}
    assert dana.err("GET", "/me") == (401, "UNAUTHENTICATED")
    with session_scope() as db:
        assert db.query(User).count() == 0
    # The old cookie does not bring the account back.
    assert web().err("POST", "/session", {"username": "dana"}) == (404, "NOT_FOUND")


def test_unknown_api_route_is_json_404(web):
    resp = web("dana").get("/nope")
    assert resp.status_code == 404
