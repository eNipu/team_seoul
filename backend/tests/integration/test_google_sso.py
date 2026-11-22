"""Google Single Sign-On (/auth/google/start and /auth/google/callback) integration tests."""

from __future__ import annotations

import base64
import hashlib
import html
import re
import secrets
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.config import ALL_SCOPES, Settings
from app.db.database import session_scope
from app.main import create_app
from app.models import User
from app.web import google_auth
from tests.conftest import MCPUser


def _sso_client(tmp_path, *, passcode: str | None = "team-secret", configured: bool = True) -> TestClient:
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=f"sqlite:///{tmp_path / 'sso.db'}",
        public_base_url="http://localhost:8081",
        auth_mode="dev",
        dev_auth_secret="test-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
        dev_auth_passcode=passcode,
        google_client_id="google-client-123.apps.googleusercontent.com" if configured else None,
        google_client_secret="google-secret-xyz" if configured else None,
    )
    return TestClient(create_app(settings), base_url="http://localhost:8081")


def test_google_sso_sign_up_and_sign_in_bypass_server_passcode(tmp_path, monkeypatch):
    monkeypatch.setattr(
        google_auth,
        "exchange_code",
        lambda settings, code, verifier, redirect_uri: google_auth.GoogleProfile(
            sub="109876543210",
            email="maya@example.com",
            email_verified=True,
            display_name="Maya Chen",
        ),
    )

    with _sso_client(tmp_path, passcode="shared-secret") as client:
        # Session advertises Google SSO and optional dev passcode fallback.
        session = client.get("/api/v1/session").json()
        assert session["signed_in"] is False
        assert session["google_sso_available"] is True
        assert session["dev_sign_in_available"] is True
        assert session["passcode_required"] is True

        # Start Google SSO: redirects to Google with PKCE S256 and sets HttpOnly state cookie.
        start = client.get("/auth/google/start?next=/app/people", follow_redirects=False)
        assert start.status_code == 302
        loc = urlparse(start.headers["location"])
        assert loc.netloc == "accounts.google.com"
        params = parse_qs(loc.query)
        assert params["scope"] == ["openid email profile"]
        assert params["code_challenge_method"] == ["S256"]
        assert params["redirect_uri"] == ["http://localhost:8081/auth/google/callback"]
        state = params["state"][0]
        assert "httponly" in start.headers["set-cookie"].lower()

        # Callback creates the new user and sets venn_session without needing the server passcode.
        cb = client.get(f"/auth/google/callback?code=fake-code&state={state}", follow_redirects=False)
        assert cb.status_code == 302
        assert cb.headers["location"] == "/app/people"

        signed_in = client.get("/api/v1/session").json()
        assert signed_in["signed_in"] is True
        assert signed_in["display_name"] == "Maya Chen"
        assert signed_in["username"] == "maya@example.com"

        me = client.get("/api/v1/me").json()
        assert me["display_name"] == "Maya Chen"
        assert me["username"] == "maya@example.com"

        with session_scope() as db:
            users = db.query(User).all()
            assert len(users) == 1
            assert users[0].auth_subject == "google|109876543210"

        # Sign out, then sign back in with Google: resolves the exact same account.
        assert client.delete("/api/v1/session", headers={"X-Venn-Request": "1"}).status_code == 200
        assert client.get("/api/v1/session").json()["signed_in"] is False

        start2 = client.get("/auth/google/start", follow_redirects=False)
        state2 = parse_qs(urlparse(start2.headers["location"]).query)["state"][0]
        cb2 = client.get(f"/auth/google/callback?code=fake-code-2&state={state2}", follow_redirects=False)
        assert cb2.status_code == 302
        assert cb2.headers["location"] == "/app/"

        me2 = client.get("/api/v1/me").json()
        assert me2["user_id"] == me["user_id"]
        with session_scope() as db:
            assert db.query(User).count() == 1


def test_google_sso_rejects_csrf_state_mismatch_and_open_redirect(tmp_path):
    with _sso_client(tmp_path) as client:
        # Open redirect attempt is clamped back to /app/.
        start = client.get("/auth/google/start?next=https://evil.example/steal", follow_redirects=False)
        assert start.status_code == 302
        # Tampered state is rejected and sets no session cookie.
        bad = client.get("/auth/google/callback?code=fake&state=wrong-state", follow_redirects=False)
        assert bad.status_code == 302
        assert bad.headers["location"] == "/app/?auth_error=invalid_state"
        assert client.get("/api/v1/session").json()["signed_in"] is False


def test_google_sso_rejects_unverified_email_and_handles_unconfigured(tmp_path, monkeypatch):
    monkeypatch.setattr(
        google_auth,
        "exchange_code",
        lambda settings, code, verifier, redirect_uri: (_ for _ in ()).throw(
            google_auth.GoogleAuthError("email_unverified")
        ),
    )
    with _sso_client(tmp_path) as client:
        start = client.get("/auth/google/start", follow_redirects=False)
        state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
        cb = client.get(f"/auth/google/callback?code=fake&state={state}", follow_redirects=False)
        assert cb.status_code == 302
        assert cb.headers["location"] == "/app/?auth_error=email_unverified"
        assert client.get("/api/v1/session").json()["signed_in"] is False

    with _sso_client(tmp_path, configured=False) as unconfigured:
        assert unconfigured.get("/api/v1/session").json()["google_sso_available"] is False
        resp = unconfigured.get("/auth/google/start", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "/app/?auth_error=google_not_configured"


def test_optional_server_passcode_fallback_still_works_alongside_google_sso(tmp_path):
    with _sso_client(tmp_path, passcode="team-pass") as client:
        # Wrong passcode refused
        bad = client.post(
            "/api/v1/session",
            json={"username": "dana", "passcode": "nope", "create": True},
            headers={"X-Venn-Request": "1"},
        )
        assert bad.status_code == 403

        # Valid passcode still works as optional fallback
        ok = client.post(
            "/api/v1/session",
            json={"username": "dana", "display_name": "Dana", "passcode": "team-pass", "create": True},
            headers={"X-Venn-Request": "1"},
        )
        assert ok.status_code == 200
        assert ok.json()["username"] == "dana"


def _start_mcp_oauth(client: TestClient) -> tuple[str, str, str]:
    redirect_uri = "https://chatgpt.com/connector_platform_oauth_redirect"
    reg = client.post(
        "/register",
        json={
            "client_name": "ChatGPT",
            "redirect_uris": [redirect_uri],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        },
    )
    assert reg.status_code == 201, reg.text
    client_id = reg.json()["client_id"]
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    auth = client.get(
        "/authorize",
        params={
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "state": "mcp-state",
            "scope": " ".join(ALL_SCOPES),
            "resource": "http://localhost:8081/mcp",
        },
        follow_redirects=False,
    )
    assert auth.status_code in (302, 307), auth.text
    login_url = urlparse(auth.headers["location"])
    assert login_url.path == "/dev/login"
    txn = parse_qs(login_url.query)["txn"][0]
    return client_id, verifier, txn


def test_mcp_plugin_login_uses_google_sso_and_shares_account_with_website(tmp_path, monkeypatch):
    monkeypatch.setattr(
        google_auth,
        "exchange_code",
        lambda settings, code, verifier, redirect_uri: google_auth.GoogleProfile(
            sub="109876543210",
            email="maya@example.com",
            email_verified=True,
            display_name="Maya Chen",
        ),
    )

    with _sso_client(tmp_path, passcode="shared-secret") as client:
        client_id, verifier, txn = _start_mcp_oauth(client)

        # /dev/login shows Continue with Google first and tucks server sign-in inside <details>.
        login_page = client.get("/dev/login", params={"txn": txn})
        assert login_page.status_code == 200
        assert "Continue with Google" in login_page.text
        assert "Use server sign-in instead" in login_page.text
        match = re.search(r'href="(/auth/google/start\?[^"]+)"', login_page.text)
        assert match is not None
        google_href = html.unescape(match.group(1))

        # Click "Continue with Google" -> Google -> /auth/google/callback -> back to /dev/login?txn=...
        start = client.get(google_href, follow_redirects=False)
        assert start.status_code == 302
        google_loc = urlparse(start.headers["location"])
        assert google_loc.netloc == "accounts.google.com"
        state = parse_qs(google_loc.query)["state"][0]

        cb = client.get(f"/auth/google/callback?code=fake-code&state={state}", follow_redirects=False)
        assert cb.status_code == 302
        returned = urlparse(cb.headers["location"])
        assert returned.path == "/dev/login"
        assert parse_qs(returned.query)["txn"] == [txn]

        # Back on /dev/login, the user's Google session is recognized and offered in one click.
        confirm_page = client.get(cb.headers["location"])
        assert confirm_page.status_code == 200
        assert "Continue as Maya Chen" in confirm_page.text
        assert "maya@example.com" in confirm_page.text

        # Confirming issues the MCP authorization code and keeps the Google website session intact.
        finish = client.post("/dev/login", data={"txn": txn, "session": "1"}, follow_redirects=False)
        assert finish.status_code == 302
        redirect = urlparse(finish.headers["location"])
        q = parse_qs(redirect.query)
        assert q["state"] == ["mcp-state"]

        # Exchange code for MCP access + refresh tokens.
        tok = client.post(
            "/token",
            data={
                "grant_type": "authorization_code",
                "code": q["code"][0],
                "redirect_uri": "https://chatgpt.com/connector_platform_oauth_redirect",
                "client_id": client_id,
                "code_verifier": verifier,
                "resource": "http://localhost:8081/mcp",
            },
        )
        assert tok.status_code == 200, tok.text
        tokens = tok.json()

        # Website and MCP plugin see the exact same Google account and data.
        added = client.post(
            "/api/v1/people",
            json={"name": "Daniel Park", "interests": ["bouldering"]},
            headers={"X-Venn-Request": "1"},
        )
        assert added.status_code == 200, added.text

        mcp_user = MCPUser(client, tokens["access_token"])
        assert mcp_user.ok("venn_get_profile")["display_name"] == "Maya Chen"
        assert mcp_user.ok("venn_find_people", query="bouldering")["results"][0]["display_name"] == "Daniel Park"

        # Refreshing the MCP token preserves the Google auth_subject (does not create a second dev user).
        refreshed = client.post(
            "/token",
            data={"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"], "client_id": client_id},
        )
        assert refreshed.status_code == 200, refreshed.text
        refreshed_mcp = MCPUser(client, refreshed.json()["access_token"])
        assert refreshed_mcp.ok("venn_find_people", query="bouldering")["results"][0]["display_name"] == "Daniel Park"

        with session_scope() as db:
            assert [u.auth_subject for u in db.query(User)] == ["google|109876543210"]


def test_mcp_login_handles_google_cancel_and_blocks_next_traversal(tmp_path):
    with _sso_client(tmp_path) as client:
        _, _, txn = _start_mcp_oauth(client)

        # Path traversal under /dev/login is rejected back to /app/.
        bad_next = client.get("/auth/google/start?next=/dev/login/../evil", follow_redirects=False)
        assert bad_next.status_code == 302
        bad_state = parse_qs(urlparse(bad_next.headers["location"]).query)["state"][0]
        bad_cb = client.get(f"/auth/google/callback?error=access_denied&state={bad_state}", follow_redirects=False)
        assert bad_cb.headers["location"] == "/app/?auth_error=cancelled"

        # Cancelling Google SSO from /dev/login returns to /dev/login with the txn preserved and an alert.
        start = client.get(f"/auth/google/start?next=/dev/login?txn={txn}", follow_redirects=False)
        state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
        cb = client.get(f"/auth/google/callback?error=access_denied&state={state}", follow_redirects=False)
        assert cb.status_code == 302
        returned = urlparse(cb.headers["location"])
        assert returned.path == "/dev/login"
        assert parse_qs(returned.query)["txn"] == [txn]
        assert parse_qs(returned.query)["auth_error"] == ["cancelled"]

        retry_page = client.get(cb.headers["location"])
        assert retry_page.status_code == 200
        assert "Google sign-in was cancelled" in retry_page.text
        assert "Continue with Google" in retry_page.text
