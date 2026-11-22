"""Google Single Sign-On (OAuth 2.0 / OIDC with PKCE) for the Venn website (/app).

Routes:
- GET /auth/google/start     — starts Google OAuth with PKCE S256 and a signed HttpOnly state cookie
- GET /auth/google/callback  — verifies state, exchanges the code, resolves/creates the Venn user,
                               sets the signed `venn_session` cookie, and redirects back to /app
"""

from __future__ import annotations

import base64
import hashlib
import secrets
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import anyio
import httpx
import jwt
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, Response

from app.config import Settings
from app.db.database import session_scope
from app.services import analytics, user_service
from app.web import session as web_session

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"  # noqa: S105 - endpoint URL, not a secret
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SCOPES = ("openid", "email", "profile")
STATE_COOKIE = "venn_oauth_state"
STATE_TTL_SECONDS = 600
TIMEOUT_SECONDS = 10.0
_STATE_AUDIENCE = "venn-google-sso"
_ALGORITHM = "HS256"


@dataclass(frozen=True)
class GoogleProfile:
    sub: str
    email: str
    email_verified: bool
    display_name: str


class GoogleAuthError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _safe_next(raw: str | None) -> str:
    """Only allow same-origin paths inside /app to prevent open redirects."""
    if not raw:
        return "/app/"
    target = raw.strip()
    if not target.startswith("/app") or target.startswith("//") or "\\" in target or "\r" in target or "\n" in target:
        return "/app/"
    return target


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def _encode_state(settings: Settings, state: str, verifier: str, next_url: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "iss": settings.public_base_url.rstrip("/"),
            "aud": _STATE_AUDIENCE,
            "typ": "google_oauth_state",
            "state": state,
            "verifier": verifier,
            "next": next_url,
            "iat": now,
            "exp": now + STATE_TTL_SECONDS,
        },
        settings.web_session_secret,
        algorithm=_ALGORITHM,
    )


def _decode_state(settings: Settings, token: str | None) -> dict | None:
    if not token:
        return None
    try:
        data = jwt.decode(
            token,
            settings.web_session_secret,
            algorithms=[_ALGORITHM],
            audience=_STATE_AUDIENCE,
            issuer=settings.public_base_url.rstrip("/"),
            options={"require": ["exp", "iss", "aud", "state", "verifier"]},
        )
    except jwt.PyJWTError:
        return None
    if data.get("typ") != "google_oauth_state":
        return None
    return data


def exchange_code(settings: Settings, code: str, verifier: str, redirect_uri: str) -> GoogleProfile:
    """Exchange the authorization code with Google and fetch the verified OIDC profile."""
    try:
        token_resp = httpx.post(
            GOOGLE_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": redirect_uri,
                "client_id": settings.google_client_id or "",
                "client_secret": settings.google_client_secret or "",
            },
            timeout=TIMEOUT_SECONDS,
        )
    except httpx.HTTPError:
        raise GoogleAuthError("google_failed") from None

    token_body = token_resp.json() if token_resp.status_code == 200 else {}
    access_token = token_body.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise GoogleAuthError("google_failed")

    try:
        info_resp = httpx.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=TIMEOUT_SECONDS,
        )
    except httpx.HTTPError:
        raise GoogleAuthError("google_failed") from None

    info = info_resp.json() if info_resp.status_code == 200 else {}
    sub = str(info.get("sub") or "").strip()
    email = str(info.get("email") or "").strip().lower()
    email_verified = bool(info.get("email_verified"))
    if not sub or not email:
        raise GoogleAuthError("google_failed")
    if not email_verified:
        raise GoogleAuthError("email_unverified")

    raw_name = str(info.get("name") or info.get("given_name") or email.split("@", 1)[0]).strip()
    display_name = (raw_name or email.split("@", 1)[0])[:60]
    return GoogleProfile(sub=sub, email=email, email_verified=True, display_name=display_name)


def _error_redirect(code: str, next_url: str = "/app/") -> RedirectResponse:
    sep = "&" if "?" in next_url else "?"
    resp = RedirectResponse(f"{next_url}{sep}{urlencode({'auth_error': code})}", status_code=302)
    resp.headers["Cache-Control"] = "no-store"
    resp.delete_cookie(STATE_COOKIE, path="/auth/google")
    return resp


def install_google_auth(app: FastAPI, settings: Settings) -> None:
    @app.get("/auth/google/start", include_in_schema=False)
    def google_start(request: Request) -> Response:
        next_url = _safe_next(request.query_params.get("next"))
        if not settings.google_sso_enabled:
            return _error_redirect("google_not_configured", next_url)

        state = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(48)
        params = {
            "client_id": settings.google_client_id or "",
            "redirect_uri": settings.google_sso_redirect_uri,
            "response_type": "code",
            "scope": " ".join(GOOGLE_SCOPES),
            "state": state,
            "code_challenge": _pkce_challenge(verifier),
            "code_challenge_method": "S256",
            "prompt": "select_account",
        }
        response = RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}", status_code=302)
        response.headers["Cache-Control"] = "no-store"
        response.set_cookie(
            STATE_COOKIE,
            _encode_state(settings, state, verifier, next_url),
            max_age=STATE_TTL_SECONDS,
            httponly=True,
            samesite="lax",
            secure=web_session.is_secure_request(request),
            path="/auth/google",
        )
        return response

    @app.get("/auth/google/callback", include_in_schema=False)
    async def google_callback(request: Request) -> Response:
        saved = _decode_state(settings, request.cookies.get(STATE_COOKIE))
        next_url = _safe_next(saved.get("next") if saved else None)

        if not settings.google_sso_enabled:
            return _error_redirect("google_not_configured", next_url)

        if request.query_params.get("error"):
            return _error_redirect("cancelled", next_url)

        code = (request.query_params.get("code") or "").strip()
        returned_state = (request.query_params.get("state") or "").strip()
        if not saved or not code or not returned_state:
            return _error_redirect("invalid_state", next_url)
        if not secrets.compare_digest(str(saved.get("state", "")), returned_state):
            return _error_redirect("invalid_state", next_url)

        verifier = str(saved.get("verifier", ""))
        try:
            profile = await anyio.to_thread.run_sync(
                exchange_code, settings, code, verifier, settings.google_sso_redirect_uri
            )
        except GoogleAuthError as exc:
            return _error_redirect(exc.code, next_url)

        def _provision() -> str:
            with session_scope() as db:
                subject = web_session.google_subject(profile.sub)
                user, _ = user_service.get_or_create_user(db, subject, profile.display_name)
                analytics.track(db, "web_signed_in", user.id)
                return subject

        subject = await anyio.to_thread.run_sync(_provision)

        response = RedirectResponse(next_url, status_code=302)
        response.headers["Cache-Control"] = "no-store"
        response.delete_cookie(STATE_COOKIE, path="/auth/google")
        web_session.set_google_cookie(response, request, settings, subject, profile.email)
        return response
