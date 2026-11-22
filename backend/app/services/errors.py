"""Domain errors. The MCP layer maps them to tool errors as "<CODE>: <message>"."""

from __future__ import annotations


class VennError(Exception):
    code = "ERROR"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message

    def __str__(self) -> str:
        return f"{self.code}: {self.message}"


class NotFound(VennError):
    """Also used for resources the caller may not see (avoids leaking existence)."""

    code = "NOT_FOUND"


class Forbidden(VennError):
    code = "FORBIDDEN"


class InvalidRequest(VennError):
    code = "INVALID_REQUEST"


class VersionConflict(VennError):
    code = "VERSION_CONFLICT"


class RateLimited(VennError):
    code = "RATE_LIMITED"


class ConsentRequired(VennError):
    code = "CONSENT_REQUIRED"


class PrivacyViolation(VennError):
    code = "PRIVACY_VIOLATION"


class ProviderError(VennError):
    """An outside service (calendar, messaging) failed or refused. Safe to show; no provider details."""

    code = "PROVIDER_ERROR"


class Unauthenticated(VennError):
    code = "UNAUTHENTICATED"


class UpstreamError(VennError):
    """A service Venn calls (LinkedIn, Apify) failed or refused."""

    code = "UPSTREAM_ERROR"
