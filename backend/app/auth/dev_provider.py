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
import re
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

from app.config import ALL_SCOPES, Settings
from app.db.database import session_scope
from app.models import DevOAuthClient, DevOAuthCode

CODE_TTL_SECONDS = 300
TXN_TTL_SECONDS = 600
DEV_ISSUER_PREFIX = "dev"
_USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{1,31}$")


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
        """GET shows the form; POST issues an authorization code and redirects to the client."""
        if request.method == "GET":
            txn = request.query_params.get("txn", "")
            if not self._decode_txn(txn):
                return HTMLResponse(_page("This sign-in link is invalid or expired.", ""), status_code=400)
            return HTMLResponse(_page(None, txn, need_passcode=bool(self.settings.dev_auth_passcode)))

        form = await request.form()
        txn = str(form.get("txn", ""))
        decoded = self._decode_txn(txn)
        if not decoded:
            return HTMLResponse(_page("This sign-in link is invalid or expired.", ""), status_code=400)
        client_id, params = decoded
        if self.settings.dev_auth_passcode and not secrets.compare_digest(
            str(form.get("passcode", "")), self.settings.dev_auth_passcode
        ):
            return HTMLResponse(_page("Wrong passcode.", txn, need_passcode=True), status_code=401)
        username = str(form.get("username", "")).strip().lower()
        if not _USERNAME_RE.match(username):
            return HTMLResponse(
                _page("Username: 2-32 chars, letters/digits/._-", txn, bool(self.settings.dev_auth_passcode)),
                status_code=400,
            )
        display = str(form.get("display_name", "")).strip()[:60] or username

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
        return RedirectResponse(
            construct_redirect_uri(str(params.redirect_uri), code=code, state=params.state), status_code=302
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


def _page(error: str | None, txn: str, need_passcode: bool = False) -> str:
    err = f'<p class="err">{html.escape(error)}</p>' if error else ""
    passcode = '<label>Dev passcode<input name="passcode" type="password" required></label>' if need_passcode else ""
    form = (
        f"""<form method="post" action="/dev/login">
  <input type="hidden" name="txn" value="{html.escape(txn)}">
  <label>Username<input name="username" required pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{{1,31}}"
    placeholder="alex"></label>
  <label>Display name<input name="display_name" maxlength="60" placeholder="Alex"></label>
  {passcode}
  <button type="submit">Continue to ChatGPT</button>
</form>"""
        if txn
        else ""
    )
    return f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Venn dev sign-in</title>
<style>body{{font-family:system-ui;max-width:420px;margin:48px auto;padding:0 16px;color:#222}}
label{{display:block;margin:12px 0}}input{{display:block;width:100%;padding:8px;margin-top:4px;box-sizing:border-box}}
button{{padding:10px 16px;background:#000;color:#fff;border:0;border-radius:999px;font-size:16px}}
.err{{color:#b00020}}.warn{{background:#fff4e5;padding:8px;border-radius:6px;font-size:14px}}</style></head>
<body><h1>Venn</h1><p class="warn">Development sign-in. Not for production use.</p>{err}{form}</body></html>"""
