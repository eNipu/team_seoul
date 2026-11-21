import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.ai.extraction import contains_sensitive, heuristic_extract, sanitize_candidates
from app.auth.context import auth_subject_for
from app.auth.jwt_verifier import JWTTokenVerifier, scopes_from_claims
from app.config import Settings
from app.schemas.memory import MemoryCandidate, MemoryCategory
from app.services.errors import NotFound
from app.services.social_service import normalize_code


# ---------------------------------------------------------------- extraction
def test_heuristic_extract_categories():
    out = heuristic_extract("I love bouldering. I hate loud bars. I want to meet people who like chess.")
    cats = [c.category for c in out]
    assert MemoryCategory.INTEREST in cats
    assert MemoryCategory.DISLIKE in cats
    assert MemoryCategory.SOCIAL_GOAL in cats


def test_heuristic_extract_empty():
    assert heuristic_extract("ok") == []


@pytest.mark.parametrize(
    "text",
    ["my password is hunter2", "card 4111 1111 1111 1111", "SSN 123-45-6789", "key sk-abcdefghijklmnopqrstuv"],
)
def test_sensitive_detection(text):
    assert contains_sensitive(text)


def test_sanitize_drops_sensitive_and_caps_count():
    items = [MemoryCandidate(category="INTEREST", title=f"Thing {i}", description="Nice") for i in range(12)]
    items.append(MemoryCandidate(category="INTEREST", title="pw", description="password: abc"))
    out = sanitize_candidates(items)
    assert len(out) <= 8
    assert all("password" not in c.description for c in out)


def test_tags_normalized():
    c = MemoryCandidate(category="INTEREST", title="x", description="y", tags=["  Rock Climbing ", "rock climbing", ""])
    assert c.tags == ["rock climbing"]


# ------------------------------------------------------------------ invites
def test_normalize_code():
    assert normalize_code(" abcd-efgh ") == normalize_code("ABCDEFGH")


# ------------------------------------------------------------------- errors
def test_error_format():
    assert str(NotFound("memory not found")) == "NOT_FOUND: memory not found"


# ------------------------------------------------------------------ settings
def test_production_requires_oauth_config():
    with pytest.raises(ValueError):
        Settings(_env_file=None, environment="production", auth_mode="jwt")
    s = Settings(
        _env_file=None,
        environment="production",
        auth_mode="jwt",
        oauth_issuer="https://auth.example.com/",
        oauth_audience="https://api.example.com/mcp",
        oauth_jwks_url="https://auth.example.com/.well-known/jwks.json",
        public_base_url="https://api.example.com",
    )
    assert s.is_production
    assert s.mcp_resource_url == "https://api.example.com/mcp"


# ---------------------------------------------------------------- jwt auth
def test_scopes_from_claims():
    assert scopes_from_claims({"scope": "a b"}) == ["a", "b"]
    assert scopes_from_claims({"scp": ["a", "b"]}) == ["a", "b"]
    assert scopes_from_claims({}) == []


def test_auth_subject_namespaced_by_issuer():
    token = SimpleNamespace(subject="123", claims={"iss": "https://auth.example.com/"})
    assert auth_subject_for(token) == "https://auth.example.com/|123"


class _FakeJWKS:
    def __init__(self, key):
        self.key = key

    def get_signing_key_from_jwt(self, _token):
        return SimpleNamespace(key=self.key)


@pytest.fixture
def rsa_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _verifier(rsa_key):
    v = JWTTokenVerifier("https://auth.example.com/", "https://api.example.com/mcp", "https://unused/jwks")
    v._jwks = _FakeJWKS(rsa_key.public_key())
    return v


def _claims(**overrides):
    now = int(time.time())
    base = {
        "iss": "https://auth.example.com/",
        "aud": "https://api.example.com/mcp",
        "sub": "user-1",
        "iat": now,
        "exp": now + 600,
        "scope": "heldly.profile.read",
    }
    base.update(overrides)
    return base


async def test_jwt_verifier_accepts_valid_token(rsa_key):
    token = jwt.encode(_claims(), rsa_key, algorithm="RS256")
    at = await _verifier(rsa_key).verify_token(token)
    assert at is not None
    assert at.subject == "user-1"
    assert at.scopes == ["heldly.profile.read"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "https://other.example.com/mcp"},
        {"iss": "https://evil.example.com/"},
        {"exp": int(time.time()) - 3600},
    ],
)
async def test_jwt_verifier_rejects_bad_claims(rsa_key, overrides):
    token = jwt.encode(_claims(**overrides), rsa_key, algorithm="RS256")
    assert await _verifier(rsa_key).verify_token(token) is None


async def test_jwt_verifier_rejects_wrong_key_and_hs256(rsa_key):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert await _verifier(rsa_key).verify_token(jwt.encode(_claims(), other, algorithm="RS256")) is None
    hs = jwt.encode(_claims(), "x" * 40, algorithm="HS256")
    assert await _verifier(rsa_key).verify_token(hs) is None
