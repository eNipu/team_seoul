"""Application configuration loaded from environment variables (see ../.env.example)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

ALL_SCOPES = [
    "heldly.profile.read",
    "heldly.profile.write",
    "heldly.memories.read",
    "heldly.memories.write",
    "heldly.connections.manage",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    database_url: str = f"sqlite:///{BACKEND_DIR / 'heldly.db'}"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    openai_api_key: str | None = None
    openai_model: str = "gpt-5-mini"
    openai_timeout_seconds: float = 25.0

    # Public URL of this server (scheme://host[:port]) — used as OAuth issuer in dev
    # mode and to build the MCP resource URL.
    public_base_url: str = "http://localhost:8000"
    # Full URL of the MCP endpoint (the OAuth protected resource). Defaults to
    # {public_base_url}/mcp.
    mcp_base_url: str | None = None

    # Production OAuth (external identity provider, JWT access tokens).
    oauth_issuer: str | None = None
    oauth_audience: str | None = None
    oauth_jwks_url: str | None = None

    # Development-only built-in OAuth authorization server. NEVER enable in production.
    auth_mode: Literal["dev", "jwt"] = "dev"
    dev_auth_secret: str = "dev-only-insecure-secret-change-me-0123456789"  # noqa: S105
    dev_auth_passcode: str | None = None
    access_token_ttl_seconds: int = 3600
    refresh_token_ttl_seconds: int = 60 * 60 * 24 * 30

    # Extra Host headers accepted by the MCP transport (e.g. your tunnel hostname).
    allowed_hosts: list[str] = Field(default_factory=list)

    widget_path: Path = REPO_DIR / "widget" / "dist" / "index.html"

    # Abuse protection
    max_connection_requests_per_day: int = 20
    max_invites_per_day: int = 30
    invite_ttl_hours: int = 72

    @property
    def mcp_resource_url(self) -> str:
        return (self.mcp_base_url or f"{self.public_base_url.rstrip('/')}/mcp").rstrip("/")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @model_validator(mode="after")
    def _check_production_safety(self) -> Settings:
        if self.environment == "production":
            if self.auth_mode != "jwt":
                raise ValueError("AUTH_MODE=dev is forbidden when ENVIRONMENT=production")
            missing = [k for k in ("oauth_issuer", "oauth_audience", "oauth_jwks_url") if not getattr(self, k)]
            if missing:
                raise ValueError(f"Production requires {', '.join(m.upper() for m in missing)}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
