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
from app.db.database import session_scope
from app.models import DevOAuthClient, DevOAuthCode
from app.services import user_service
from app.web import session as web_session

CODE_TTL_SECONDS = 300
TXN_TTL_SECONDS = 600
DEV_ISSUER_PREFIX = web_session.DEV_ISSUER
_USERNAME_RE = web_session.USERNAME_RE


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
        is offered that account, and a username that has no account yet has to be confirmed.
        """
        need_passcode = bool(self.settings.dev_auth_passcode)
        invalid = HTMLResponse(_page("This sign-in link is invalid or expired.", ""), status_code=400)

        if request.method == "GET":
            txn = request.query_params.get("txn", "")
            if not self._decode_txn(txn):
                return invalid
            signed_in = None
            if request.query_params.get("switch") != "1":
                signed_in = await anyio.to_thread.run_sync(self._web_account, request)
            if signed_in:
                return HTMLResponse(_continue_page(txn, *signed_in))
            return HTMLResponse(_page(None, txn, need_passcode=need_passcode))

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
                return HTMLResponse(_page("You are signed out. Sign in again.", txn, need_passcode), status_code=401)
            username, display = signed_in
        else:
            passcode = str(form.get("passcode", ""))
            if need_passcode and not secrets.compare_digest(passcode, self.settings.dev_auth_passcode or ""):
                return HTMLResponse(_page("Wrong passcode.", txn, need_passcode=True), status_code=401)
            username = str(form.get("username", "")).strip().lower()
            if not _USERNAME_RE.match(username):
                return HTMLResponse(
                    _page("Username: 2-32 chars, letters/digits/._-", txn, need_passcode), status_code=400
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
                return HTMLResponse(_create_page(txn, username, wanted, passcode if need_passcode else ""))

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
            subject=username,
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
        # Same account on the website: the browser that just signed in is signed in there too.
        web_session.set_cookie(response, request, self.settings, username)
        return response

    def _web_account(self, request: Request) -> tuple[str, str] | None:
        """(username, display name) of the account signed in on the website in this browser, if any."""
        username = web_session.username_from(request, self.settings)
        if not username:
            return None
        with session_scope() as db:
            user = web_session.find_user(db, web_session.dev_subject(username))
            return None if user is None else (username, user.display_name or username)

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
        return self._issue(client.client_id, authorization_code.subject, authorization_code.scopes, name)

    # ------------------------------------------------------------------ tokens
    def _issue(self, client_id: str, subject: str, scopes: list[str], name: str | None) -> OAuthToken:
        now = int(time.time())
        base = {"iss": self.issuer, "aud": self.audience, "sub": subject, "client_id": client_id, "iat": now}
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
        return self._issue(client.client_id, refresh_token.subject, new_scopes, claims.get("name"))

    async def load_access_token(self, token: str) -> AccessToken | None:
        claims = self._decode(token, "access")
        if not claims:
            return None
        return AccessToken(
            token=token,
            client_id=str(claims.get("client_id", "")),
            scopes=claims.get("scope", "").split(),
            expires_at=int(claims["exp"]),
            resource=self.audience,
            subject=str(claims["sub"]),
            claims={"iss": DEV_ISSUER_PREFIX, "name": claims.get("name")},
        )

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:
        # Stateless dev tokens expire quickly; revocation is a no-op in development.
        return None

    async def exchange_identity_assertion(self, client, params) -> OAuthToken:  # pragma: no cover
        raise TokenError(error="unsupported_grant_type", error_description="not supported")


_DEV_NOTE = '<div class="note">Development sign-in. Not for production use.</div>'


def _page(error: str | None, txn: str, need_passcode: bool = False) -> str:
    err = f'<p class="err" role="alert">{html.escape(error)}</p>' if error else ""
    passcode = (
        '<label>Dev passcode<input name="passcode" type="password" required autocomplete="off"></label>'
        if need_passcode
        else ""
    )
    form = (
        f"""<form method="post" action="/dev/login">
  <input type="hidden" name="txn" value="{html.escape(txn)}">
  <label>Username<input name="username" required pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{{1,31}}"
    placeholder="alex" autocomplete="username" autocapitalize="none" spellcheck="false" autofocus></label>
  {passcode}
  <button type="submit">Continue to ChatGPT</button>
</form>
<small>Use the username you use on the Venn website. It opens the same account: what you saved there is
here too.</small>"""
        if txn
        else ""
    )
    return page(
        "Sign in to Venn (development)",
        f"""<h1>Sign in to Venn</h1>
<p>Connect ChatGPT to your Venn account.</p>
{_DEV_NOTE}
{err}{form}""",
    )


def _continue_page(txn: str, username: str, display: str) -> str:
    """Shown when this browser is already signed in on the Venn website."""
    safe_txn = html.escape(txn)
    return page(
        "Connect ChatGPT to Venn (development)",
        f"""<h1>Connect ChatGPT to Venn</h1>
<p>You are signed in as <strong>{html.escape(display)}</strong> (@{html.escape(username)}). ChatGPT will use
this account, so everything you saved to Venn is there too.</p>
{_DEV_NOTE}
<form method="post" action="/dev/login">
  <input type="hidden" name="txn" value="{safe_txn}">
  <input type="hidden" name="session" value="1">
  <button type="submit">Continue as {html.escape(display)}</button>
</form>
<small><a class="quiet" href="/dev/login?txn={safe_txn}&amp;switch=1">Use a different account</a></small>
<small>Your ChatGPT chats and ChatGPT's own memory are not synced to Venn. Only what you approve is saved.</small>""",
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
    )
