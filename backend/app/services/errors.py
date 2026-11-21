"""Domain errors. The MCP layer maps them to tool errors as "<CODE>: <message>"."""

from __future__ import annotations


class HeldlyError(Exception):
    code = "ERROR"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message

    def __str__(self) -> str:
        return f"{self.code}: {self.message}"


class NotFound(HeldlyError):
    """Also used for resources the caller may not see (avoids leaking existence)."""

    code = "NOT_FOUND"


class Forbidden(HeldlyError):
    code = "FORBIDDEN"


class InvalidRequest(HeldlyError):
    code = "INVALID_REQUEST"


class VersionConflict(HeldlyError):
    code = "VERSION_CONFLICT"


class RateLimited(HeldlyError):
    code = "RATE_LIMITED"


class ConsentRequired(HeldlyError):
    code = "CONSENT_REQUIRED"


class PrivacyViolation(HeldlyError):
    code = "PRIVACY_VIOLATION"


class Unauthenticated(HeldlyError):
    code = "UNAUTHENTICATED"
