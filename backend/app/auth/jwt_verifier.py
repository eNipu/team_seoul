"""Production token verification: JWT access tokens from an external OAuth provider.

Validates signature (JWKS), issuer, audience, expiry and extracts scopes. The Venn user is
derived only from (iss, sub) of a verified token — never from tool arguments.
"""

from __future__ import annotations

import logging

import anyio
import jwt
from jwt import PyJWKClient
from mcp.server.auth.provider import AccessToken, TokenVerifier

from app.auth.context import note_token_used

log = logging.getLogger("venn.auth")

ALLOWED_ALGORITHMS = ["RS256", "RS384", "RS512", "ES256", "ES384", "PS256"]


def scopes_from_claims(claims: dict) -> list[str]:
    raw = claims.get("scope") or claims.get("scp") or []
    if isinstance(raw, str):
        return [s for s in raw.split() if s]
    if isinstance(raw, list):
        return [str(s) for s in raw]
    return []


class JWTTokenVerifier(TokenVerifier):
    def __init__(self, issuer: str, audience: str, jwks_url: str, leeway_seconds: int = 30):
        self.issuer = issuer
        self.audience = audience
        self.leeway = leeway_seconds
        self._jwks = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)

    def _verify_sync(self, token: str) -> AccessToken | None:
        try:
            signing_key = self._jwks.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=ALLOWED_ALGORITHMS,
                audience=self.audience,
                issuer=self.issuer,
                leeway=self.leeway,
                options={"require": ["exp", "iat", "sub", "iss", "aud"]},
            )
        except jwt.PyJWTError as exc:
            log.info("rejected access token: %s", type(exc).__name__)
            return None
        return AccessToken(
            token=token,
            client_id=str(claims.get("azp") or claims.get("client_id") or "unknown"),
            scopes=scopes_from_claims(claims),
            expires_at=int(claims["exp"]),
            resource=self.audience,
            subject=str(claims["sub"]),
            claims={"iss": claims["iss"], "name": claims.get("name")},
        )

    async def verify_token(self, token: str) -> AccessToken | None:
        # JWKS fetch is blocking; keep it off the event loop.
        verified = await anyio.to_thread.run_sync(self._verify_sync, token)
        if verified is not None:
            await note_token_used(verified)
        return verified
