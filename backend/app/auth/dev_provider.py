"""DEVELOPMENT-ONLY OAuth 2.1 authorization server (DCR + PKCE + simple login page).

Lets you connect ChatGPT (or MCP Inspector) to a local Venn server without an external
identity provider. The "login" lets the developer choose a username, so it provides NO real
authentication — it is refused when ENVIRONMENT=production (see app.config.Settings) and can be
gated with DEV_AUTH_PASSCODE when exposed through a tunnel.

Access/refresh tokens are short-lived HS256 JWTs signed with DEV_AUTH_SECRET and bound to the
MCP resource URL (audience). Production uses app.auth.jwt_verifier instead.
"""

from __future__ import annotations

import html
import secrets
import time
import uuid
from dataclasses import dataclass
from urllib.parse import urlencode

import anyio
import jwt
from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    RefreshToken,
    TokenError,
    construct_redirect_uri,
)
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from sqlalchemy import delete, select
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse, Response

from app.branding import page
from app.config import ALL_SCOPES, Settings
from app.auth.context import note_token_used
from app.db.database import session_scope
from app.models import DevOAuthClient, DevOAuthCode
from app.services import user_service
from app.web import session as web_session

CODE_TTL_SECONDS = 300
TXN_TTL_SECONDS = 600
DEV_ISSUER_PREFIX = web_session.DEV_ISSUER
_USERNAME_RE = web_session.USERNAME_RE

_AUTH_ERRORS = {
    "cancelled": "Google sign-in was cancelled. Try again whenever you're ready.",
    "email_unverified": "Your Google account needs a verified email address to sign in.",
    "invalid_state": "Your sign-in session expired. Please try again.",
    "google_not_configured": "Google sign-in is not configured on this server.",
}


@dataclass(frozen=True)
class _WebAccount:
    auth_issuer: str
    raw_subject: str
    full_subject: str
    label: str
    display_name: str
    email: str | None = None


def _split_auth_subject(value: str) -> tuple[str, str]:
    """Split a stored `<issuer>|<sub>` subject, defaulting legacy plain usernames to `dev`."""
    if "|" in value:
        issuer, sub = value.split("|", 1)
        if issuer in (DEV_ISSUER_PREFIX, web_session.GOOGLE_ISSUER) and sub:
            return issuer, sub
    return DEV_ISSUER_PREFIX, value


class DevOAuthProvider:
    """Implements mcp.server.auth.provider.OAuthAuthorizationServerProvider."""

    def __init__(self, settings: Settings):
        if settings.is_production:
            raise RuntimeError("Dev OAuth provider must never run in production")
        self.settings = settings
        self.secret = settings.dev_auth_secret
        self.issuer = settings.public_base_url.rstrip("/")
        self.audience = settings.mcp_resource_url

    # ------------------------------------------------------------------ clients
    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        def _get():
            with session_scope() as db:
                row = db.get(DevOAuthClient, client_id)
                return OAuthClientInformationFull.model_validate(row.client_info) if row else None

        return await anyio.to_thread.run_sync(_get)

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        def _save():
            with session_scope() as db:
                db.merge(
                    DevOAuthClient(client_id=client_info.client_id, client_info=client_info.model_dump(mode="json"))
                )

        await anyio.to_thread.run_sync(_save)

    # ---------------------------------------------------------------- authorize
    async def authorize(self, client: OAuthClientInformationFull, params: AuthorizationParams) -> str:
        txn = jwt.encode(
            {
                "typ": "dev_txn",
                "client_id": client.client_id,
                "params": params.model_dump(mode="json"),
                "exp": int(time.time()) + TXN_TTL_SECONDS,
            },
            self.secret,
            algorithm="HS256",
        )
        return construct_redirect_uri(f"{self.issuer}/dev/login", txn=txn)

    def _decode_txn(self, txn: str) -> tuple[str, AuthorizationParams] | None:
        try:
            data = jwt.decode(txn, self.secret, algorithms=["HS256"])
        except jwt.PyJWTError:
            return None
        if data.get("typ") != "dev_txn":
            return None
        return data["client_id"], AuthorizationParams.model_validate(data["params"])

    async def login_page(self, request: Request) -> Response:
        """The page ChatGPT sends the user to when they connect Venn.

        ChatGPT and the website are two ways into one account, so this page links to an existing
        account rather than quietly making a second one: someone already signed in on the website
        (via Google SSO or dev sign-in) is offered that account, Google Single Sign-On is offered
        first when configured, and a dev username that has no account yet has to be confirmed.
        """
        need_passcode = bool(self.settings.dev_auth_passcode)
        google_sso = self.settings.google_sso_enabled
        no_store = {"Cache-Control": "no-store"}
        invalid = HTMLResponse(_page("This sign-in link is invalid or expired.", ""), status_code=400, headers=no_store)

        if request.method == "GET":
            txn = request.query_params.get("txn", "")
            if not self._decode_txn(txn):
                return invalid
            auth_error = request.query_params.get("auth_error", "").strip()
            error_msg = (
                _AUTH_ERRORS.get(auth_error, "Could not finish Google sign-in. Please try again.")
                if auth_error
                else None
            )
            signed_in = None
            if not error_msg and request.query_params.get("switch") != "1":
                signed_in = await anyio.to_thread.run_sync(self._web_account, request)
            if signed_in:
                return HTMLResponse(
                    _continue_page(txn, signed_in.display_name, signed_in.label, google_sso=google_sso),
                    headers=no_store,
                )
            return HTMLResponse(
                _page(error_msg, txn, need_passcode=need_passcode, google_sso=google_sso),
                headers=no_store,
            )

        form = await request.form()
        txn = str(form.get("txn", ""))
        decoded = self._decode_txn(txn)
        if not decoded:
            return invalid
        client_id, params = decoded

        if str(form.get("session", "")) == "1":
            # "Continue as …": the account comes from the website session, never from the form.
            signed_in = await anyio.to_thread.run_sync(self._web_account, request)
            if not signed_in:
                return HTMLResponse(
                    _page(
                        "You are signed out. Sign in again.",
                        txn,
                        need_passcode=need_passcode,
                        google_sso=google_sso,
                    ),
                    status_code=401,
                    headers=no_store,
                )
            auth_issuer = signed_in.auth_issuer
            raw_subject = signed_in.raw_subject
            auth_subject = signed_in.full_subject
            display = signed_in.display_name
            google_email = signed_in.email
        else:
            passcode = str(form.get("passcode", ""))
            if need_passcode and not secrets.compare_digest(passcode, self.settings.dev_auth_passcode or ""):
                return HTMLResponse(
                    _page("Wrong passcode.", txn, need_passcode=True, google_sso=google_sso, open_fallback=True),
                    status_code=401,
                    headers=no_store,
                )
            username = str(form.get("username", "")).strip().lower()
            if not _USERNAME_RE.match(username):
                return HTMLResponse(
                    _page(
                        "Username: 2-32 chars, letters/digits/._-",
                        txn,
                        need_passcode=need_passcode,
                        google_sso=google_sso,
                        open_fallback=True,
                    ),
                    status_code=400,
                    headers=no_store,
                )
            wanted = str(form.get("display_name", "")).strip()[:60]
            create = str(form.get("create", "")) == "1"

            def _account() -> str | None:
                with session_scope() as db:
                    subject = web_session.dev_subject(username)
                    user = web_session.find_user(db, subject)
                    if user is None and create:
                        user, _ = user_service.get_or_create_user(db, subject, wanted or username)
                    return None if user is None else (user.display_name or username)

            display = await anyio.to_thread.run_sync(_account)
            if display is None:
                # No account under this name: ask before making one.
                return HTMLResponse(
                    _create_page(txn, username, wanted, passcode if need_passcode else ""),
                    headers=no_store,
                )
            auth_issuer = DEV_ISSUER_PREFIX
            raw_subject = username
            auth_subject = web_session.dev_subject(username)
            google_email = None

        code = secrets.token_urlsafe(32)
        auth_code = AuthorizationCode(
            code=code,
            scopes=params.scopes or list(ALL_SCOPES),
            expires_at=time.time() + CODE_TTL_SECONDS,
            client_id=client_id,
            code_challenge=params.code_challenge,
            redirect_uri=params.redirect_uri,
            redirect_uri_provided_explicitly=params.redirect_uri_provided_explicitly,
            resource=params.resource,
            subject=auth_subject,
        )

        def _store():
            with session_scope() as db:
                db.add(
                    DevOAuthCode(code=code, client_id=client_id, data=auth_code.model_dump(mode="json"), note=display)
                )

        await anyio.to_thread.run_sync(_store)
        response = RedirectResponse(
            construct_redirect_uri(str(params.redirect_uri), code=code, state=params.state), status_code=302
        )
        response.headers["Cache-Control"] = "no-store"
        # Same account on the website: preserve Google SSO or dev session cookie.
        if auth_issuer == web_session.GOOGLE_ISSUER:
            web_session.set_google_cookie(response, request, self.settings, auth_subject, google_email)
        else:
            web_session.set_cookie(response, request, self.settings, raw_subject)
        return response

    def _web_account(self, request: Request) -> _WebAccount | None:
        """Account signed in on the website in this browser (Google SSO or dev sign-in), if any."""
        identity = web_session.identity_from(request, self.settings)
        if identity is None:
            return None
        with session_scope() as db:
            user = web_session.find_user(db, identity.subject)
            if user is None:
                return None
            auth_issuer, raw_sub = _split_auth_subject(identity.subject)
            if auth_issuer == web_session.GOOGLE_ISSUER:
                email = identity.username
                return _WebAccount(
                    auth_issuer=auth_issuer,
                    raw_subject=raw_sub,
                    full_subject=identity.subject,
                    label=email or "Google account",
                    display_name=user.display_name or email or "Venn member",
                    email=email,
                )
            return _WebAccount(
                auth_issuer=auth_issuer,
                raw_subject=raw_sub,
                full_subject=identity.subject,
                label=f"@{raw_sub}",
                display_name=user.display_name or raw_sub,
            )

    # ------------------------------------------------------------------- codes
    async def load_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: str
    ) -> AuthorizationCode | None:
        def _load():
            with session_scope() as db:
                row = db.get(DevOAuthCode, authorization_code)
                if row is None or row.client_id != client.client_id:
                    return None
                code = AuthorizationCode.model_validate(row.data)
                if code.expires_at < time.time():
                    db.delete(row)
                    return None
                return code

        return await anyio.to_thread.run_sync(_load)

    async def exchange_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: AuthorizationCode
    ) -> OAuthToken:
        def _consume() -> str | None:
            with session_scope() as db:
                row = db.scalar(select(DevOAuthCode).where(DevOAuthCode.code == authorization_code.code))
                if row is None:
                    return None
                name = row.note
                db.execute(delete(DevOAuthCode).where(DevOAuthCode.code == authorization_code.code))
                return name or ""

        name = await anyio.to_thread.run_sync(_consume)
        if name is None:  # single use
            raise TokenError(error="invalid_grant", error_description="authorization code already used")
        assert authorization_code.subject
        auth_iss, raw_sub = _split_auth_subject(authorization_code.subject)
        return self._issue(client.client_id, raw_sub, authorization_code.scopes, name, auth_iss=auth_iss)

    # ------------------------------------------------------------------ tokens
    def _issue(
        self,
        client_id: str,
        subject: str,
        scopes: list[str],
        name: str | None,
        *,
        auth_iss: str = DEV_ISSUER_PREFIX,
    ) -> OAuthToken:
        now = int(time.time())
        base = {
            "iss": self.issuer,
            "aud": self.audience,
            "sub": subject,
            "auth_iss": auth_iss,
            "client_id": client_id,
            "iat": now,
        }
        scope = " ".join(scopes)
        access = jwt.encode(
            {
                **base,
                "typ": "access",
                "scope": scope,
                "name": name,
                "exp": now + self.settings.access_token_ttl_seconds,
                "jti": uuid.uuid4().hex,
            },
            self.secret,
            algorithm="HS256",
        )
        refresh = jwt.encode(
            {
                **base,
                "typ": "refresh",
                "scope": scope,
                "name": name,
                "exp": now + self.settings.refresh_token_ttl_seconds,
                "jti": uuid.uuid4().hex,
            },
            self.secret,
            algorithm="HS256",
        )
        return OAuthToken(
            access_token=access,
            expires_in=self.settings.access_token_ttl_seconds,
            scope=scope,
            refresh_token=refresh,
        )

    def _decode(self, token: str, typ: str) -> dict | None:
        try:
            claims = jwt.decode(
                token,
                self.secret,
                algorithms=["HS256"],
                audience=self.audience,
                issuer=self.issuer,
                options={"require": ["exp", "sub", "iss", "aud"]},
            )
        except jwt.PyJWTError:
            return None
        return claims if claims.get("typ") == typ else None

    async def load_refresh_token(self, client: OAuthClientInformationFull, refresh_token: str) -> RefreshToken | None:
        claims = self._decode(refresh_token, "refresh")
        if not claims or claims.get("client_id") != client.client_id:
            return None
        return RefreshToken(
            token=refresh_token,
            client_id=client.client_id,
            scopes=claims.get("scope", "").split(),
            expires_at=int(claims["exp"]),
            subject=claims["sub"],
        )

    async def exchange_refresh_token(
        self, client: OAuthClientInformationFull, refresh_token: RefreshToken, scopes: list[str]
    ) -> OAuthToken:
        claims = self._decode(refresh_token.token, "refresh") or {}
        granted = set(refresh_token.scopes)
        new_scopes = [s for s in scopes if s in granted] if scopes else refresh_token.scopes
        assert refresh_token.subject
        auth_iss = str(claims.get("auth_iss") or DEV_ISSUER_PREFIX)
        return self._issue(client.client_id, refresh_token.subject, new_scopes, claims.get("name"), auth_iss=auth_iss)

    async def load_access_token(self, token: str) -> AccessToken | None:
        claims = self._decode(token, "access")
        if not claims:
            return None
        auth_iss = str(claims.get("auth_iss") or DEV_ISSUER_PREFIX)
        verified = AccessToken(
            token=token,
            client_id=str(claims.get("client_id", "")),
            scopes=claims.get("scope", "").split(),
            expires_at=int(claims["exp"]),
            resource=self.audience,
            subject=str(claims["sub"]),
            claims={"iss": auth_iss, "name": claims.get("name")},
        )
        await note_token_used(verified)
        return verified

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:
        # Stateless dev tokens expire quickly; revocation is a no-op in development.
        return None

    async def exchange_identity_assertion(self, client, params) -> OAuthToken:  # pragma: no cover
        raise TokenError(error="unsupported_grant_type", error_description="not supported")


_DEV_NOTE = '<div class="note">Development sign-in. Not for production use.</div>'

_GOOGLE_G_SVG = (
    '<svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    '<path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88'
    'c2.27-2.09 3.54-5.17 3.54-8.89Z"/>'
    '<path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.02c-1.08.72-2.45 1.15-4.06 1.15-3.12 '
    '0-5.77-2.11-6.72-4.96H1.28v3.11A12 12 0 0 0 12 24Z"/>'
    '<path fill="#FBBC05" d="M5.28 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.28a12 12 0 0 0 0 10.76l4-3.11Z"/>'
    '<path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 '
    '1.28 6.62l4 3.11C6.23 6.88 8.88 4.77 12 4.77Z"/>'
    "</svg>"
)


def _google_start_href(txn: str) -> str:
    next_target = f"/dev/login?{urlencode({'txn': txn})}"
    return f"/auth/google/start?{urlencode({'next': next_target})}"


def _page(
    error: str | None,
    txn: str,
    need_passcode: bool = False,
    *,
    google_sso: bool = False,
    open_fallback: bool = False,
) -> str:
    err = f'<p class="err" role="alert">{html.escape(error)}</p>' if error else ""
    passcode = (
        '<label>Server passcode<input name="passcode" type="password" required autocomplete="off"></label>'
        if need_passcode
        else ""
    )
    autofocus = "" if google_sso else " autofocus"
    dev_form = (
        f"""<form method="post" action="/dev/login">
  <input type="hidden" name="txn" value="{html.escape(txn)}">
  <label>Username<input name="username" required pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{{1,31}}"
    placeholder="alex" autocomplete="username" autocapitalize="none" spellcheck="false"{autofocus}></label>
  {passcode}
  <button type="submit">Continue to ChatGPT</button>
</form>"""
        if txn
        else ""
    )
    if txn and google_sso:
        open_attr = " open" if open_fallback else ""
        google_href = html.escape(_google_start_href(txn), quote=True)
        body_main = f"""{err}
<a class="button button--google" href="{google_href}">{_GOOGLE_G_SVG}Continue with Google</a>
<div class="divider"><span>or</span></div>
<details class="alt"{open_attr}>
  <summary>Use server sign-in instead</summary>
  <div class="alt-body">
    {_DEV_NOTE}
    {dev_form}
  </div>
</details>
<small>Your ChatGPT chats and ChatGPT's own memory are not synced to Venn. Only what you approve is saved.</small>"""
    else:
        note = _DEV_NOTE if txn else ""
        hint = (
            "<small>Use the username you use on the Venn website. It opens the same account: what you saved there is "
            "here too.</small>"
            if txn
            else ""
        )
        body_main = f"{note}\n{err}{dev_form}{hint}"

    title = "Sign in to Venn" if google_sso else "Sign in to Venn (development)"
    return page(
        title,
        f"""<h1>Sign in to Venn</h1>
<p>Connect ChatGPT to your Venn account.</p>
{body_main}""",
        theme="light",
    )


def _continue_page(txn: str, display: str, label: str, *, google_sso: bool = False) -> str:
    """Shown when this browser is already signed in on the Venn website."""
    safe_txn = html.escape(txn)
    note = "" if google_sso else f"\n{_DEV_NOTE}"
    title = "Connect ChatGPT to Venn" if google_sso else "Connect ChatGPT to Venn (development)"
    return page(
        title,
        f"""<h1>Connect ChatGPT to Venn</h1>
<p>You are signed in as <strong>{html.escape(display)}</strong> ({html.escape(label)}). ChatGPT will use
this account, so everything you saved to Venn is there too.</p>{note}
<form method="post" action="/dev/login">
  <input type="hidden" name="txn" value="{safe_txn}">
  <input type="hidden" name="session" value="1">
  <button type="submit">Continue as {html.escape(display)}</button>
</form>
<small><a class="quiet" href="/dev/login?txn={safe_txn}&amp;switch=1">Use a different account</a></small>
<small>Your ChatGPT chats and ChatGPT's own memory are not synced to Venn. Only what you approve is saved.</small>""",
        theme="light",
    )


def _create_page(txn: str, username: str, display: str, passcode: str) -> str:
    """Shown when the username has no Venn account yet: nothing is created without a second step."""
    safe_txn = html.escape(txn)
    return page(
        "Create a Venn account (development)",
        f"""<h1>No Venn account called “{html.escape(username)}” yet</h1>
<p>If you already use Venn on the website, go back and enter that username so ChatGPT opens the same account.
Otherwise you can create a new one.</p>
{_DEV_NOTE}
<form method="post" action="/dev/login">
  <input type="hidden" name="txn" value="{safe_txn}">
  <input type="hidden" name="username" value="{html.escape(username)}">
  <input type="hidden" name="passcode" value="{html.escape(passcode)}">
  <input type="hidden" name="create" value="1">
  <label>Your name<input name="display_name" maxlength="60" value="{html.escape(display)}" placeholder="Alex"
    autocomplete="name" autofocus></label>
  <button type="submit">Create account and continue</button>
</form>
<small><a class="quiet" href="/dev/login?txn={safe_txn}&amp;switch=1">Back</a></small>""",
        theme="light",
    )
