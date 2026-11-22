"""Google Single Sign-On (/auth/google/start and /auth/google/callback) integration tests."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.config import Settings
from app.db.database import session_scope
from app.main import create_app
from app.models import User
from app.web import google_auth


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
