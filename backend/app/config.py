"""Application configuration loaded from environment variables (see ../.env.example)."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

# All are advertised and required at the transport level, so adding one means existing users
# reconnect once (docs/tasks/SCHEDULING.md › Scopes).
ALL_SCOPES = [
    "venn.profile.read",
    "venn.profile.write",
    "venn.memories.read",
    "venn.memories.write",
    "venn.connections.manage",
    "venn.calendar",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    database_url: str = f"sqlite:///{BACKEND_DIR / 'venn.db'}"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    openai_api_key: str | None = None
    openai_model: str = "gpt-5-mini"
    openai_timeout_seconds: float = 25.0

    # LinkedIn import (website). The Apify token is optional: without it people are
    # imported with the name and headline from the connections list only.
    apify_token: str | None = None
    apify_profile_actor: str = "LpVuK3Zozwuipa5bp"  # harvestapi/linkedin-profile-scraper
    apify_timeout_seconds: float = 240.0
    linkedin_max_connections: int = 200
    linkedin_max_enriched: int = 25
    linkedin_fetches_per_hour: int = 6

    # Public URL of this server (scheme://host[:port]) — used as OAuth issuer in dev
    # mode and to build the MCP resource URL.
    public_base_url: str = "http://localhost:8081"
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
    # Build of the website (web/); served at /app.
    web_dist_path: Path = REPO_DIR / "web" / "dist"

    # Abuse protection
    max_connection_requests_per_day: int = 20
    max_invites_per_day: int = 30
    invite_ttl_hours: int = 72

    # Calendar (docs/tasks/SCHEDULING.md › Providers). "fake" keeps everything in memory.
    calendar_provider: Literal["fake", "google"] = "fake"
    google_client_id: str | None = None
    google_client_secret: str | None = None
    # Fernet key for refresh tokens; also keys the connect-link signature. Dev falls back to
    # a key derived from DEV_AUTH_SECRET.
    calendar_token_key: str | None = None

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
        if self.calendar_provider == "google":
            missing = [k for k in ("google_client_id", "google_client_secret") if not getattr(self, k)]
            if self.environment == "production" and not self.calendar_token_key:
                missing.append("calendar_token_key")
            if missing:
                raise ValueError(f"CALENDAR_PROVIDER=google requires {', '.join(m.upper() for m in missing)}")
        return self


_current: Settings | None = None


def get_settings() -> Settings:
    """The settings of the running app (loaded from the environment the first time)."""
    global _current
    if _current is None:
        _current = Settings()
    return _current


def use_settings(settings: Settings) -> None:
    """Make `settings` the ones services see. Called once by create_app, so an app that was
    given its settings (tests, scripts) and its services never disagree about, say, the base URL."""
    global _current
    _current = settings
