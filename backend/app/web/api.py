"""The website's JSON API (`/api/v1`). See docs/WEB_API.md.

Every route resolves the signed-in Venn user and calls the same service functions as the MCP
tools, so ownership, approval and visibility rules are enforced in one place. Nothing here takes
a user id from the request.
"""

from __future__ import annotations

import secrets
import time
from collections.abc import Callable
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.auth.jwt_verifier import JWTTokenVerifier
from app.config import Settings
from app.db.database import session_scope
from app.models import User
from app.schemas.memory import MemoryCategory, MemoryVisibility
from app.schemas.profile import ProfileUpdate
from app.schemas.social import PersonCandidate
from app.services import (
    analytics,
    circle_idea_service,
    dashboard_service,
    linkedin_service,
    memory_service,
    people_service,
    plan_service,
    question_service,
    quiz_service,
    sample_service,
    social_service,
    user_service,
)
from app.services import relationship_service as rel
from app.services.errors import (
    Forbidden,
    InvalidRequest,
    NotFound,
    RateLimited,
    Unauthenticated,
    UpstreamError,
    VennError,
)
from app.web import session as web_session
from app.web.overlap import build_overlap_api
from app.web.session import Identity

STATUS = {
    "UNAUTHENTICATED": 401,
    "FORBIDDEN": 403,
    "CONSENT_REQUIRED": 403,
    "NOT_FOUND": 404,
    "VERSION_CONFLICT": 409,
    "PRIVACY_VIOLATION": 422,
    "RATE_LIMITED": 429,
    "UPSTREAM_ERROR": 502,
}
_MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
_MAX_FAILED_SIGN_INS = 10
_FAILED_WINDOW_SECONDS = 300


# ------------------------------------------------------------------ request bodies
class SignInBody(BaseModel):
    username: str = Field(max_length=64)
    display_name: str | None = Field(default=None, max_length=60)
    passcode: str | None = Field(default=None, max_length=200)
    create: bool = False


class DeleteAccountBody(BaseModel):
    confirmation: str = Field(max_length=100)


class MemoryBody(BaseModel):
    category: MemoryCategory
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=8)
    visibility: MemoryVisibility = MemoryVisibility.PRIVATE
    people: list[str] = Field(default_factory=list, max_length=5)


class MemoryUpdateBody(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, min_length=1, max_length=500)
    visibility: MemoryVisibility | None = None


class PersonUpdateBody(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    relationship: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=1000)
    interests: list[str] | None = Field(default=None, max_length=12)


class ImportPreviewBody(BaseModel):
    people: list[PersonCandidate] = Field(min_length=1, max_length=people_service.MAX_IMPORT_CANDIDATES)
    source: str | None = Field(default=None, max_length=60)


class ImportBody(BaseModel):
    import_id: str = Field(max_length=64)
    indexes: list[int] = Field(min_length=1, max_length=people_service.MAX_DEMO_IMPORT_CANDIDATES)


class LinkedInConnectionsBody(BaseModel):
    cookies: str = Field(min_length=1, max_length=linkedin_service.MAX_COOKIE_INPUT)


class LinkedInExportBody(BaseModel):
    """LinkedIn's own Connections.csv (Settings → Get a copy of your data), as text."""

    csv: str = Field(min_length=1, max_length=4_000_000)


class LinkedInPick(BaseModel):
    public_identifier: str | None = Field(default=None, max_length=200)
    name: str = Field(min_length=1, max_length=120)
    headline: str | None = Field(default=None, max_length=300)


class LinkedInPreviewBody(BaseModel):
    people: list[LinkedInPick] = Field(min_length=1, max_length=people_service.MAX_IMPORT_CANDIDATES)


class InteractionBody(BaseModel):
    activity: str | None = Field(default=None, max_length=120)


class FollowUpBody(BaseModel):
    text: str = Field(min_length=1, max_length=rel.MAX_FOLLOW_UP_LEN)


class PlanBody(BaseModel):
    title: str = Field(min_length=1, max_length=plan_service.MAX_TITLE_LEN)
    details: str | None = Field(default=None, max_length=plan_service.MAX_DETAILS_LEN)
    planned_for: datetime | None = None
    connection_ids: list[str] = Field(default_factory=list, max_length=plan_service.MAX_MEMBERS)
    person_ids: list[str] = Field(default_factory=list, max_length=plan_service.MAX_MEMBERS)


class InviteBody(BaseModel):
    max_uses: int = Field(default=5, ge=1, le=20)


class RedeemBody(BaseModel):
    code: str = Field(min_length=1, max_length=32)


class RespondBody(BaseModel):
    accept: bool


class QuestionLinkBody(BaseModel):
    person_id: str | None = Field(default=None, max_length=64)
    name: str | None = Field(default=None, max_length=80)


class SaveAnswersBody(BaseModel):
    keys: list[Literal["into", "together", "treat", "ask"]] = Field(min_length=1, max_length=4)
    name: str | None = Field(default=None, max_length=80)


# ------------------------------------------------------------------------ helpers
def _json(result: Any) -> Any:
    return result.model_dump(mode="json") if isinstance(result, BaseModel) else result


def _error(code: str, message: str, status: int | None = None) -> JSONResponse:
    response = JSONResponse(
        {"error": {"code": code, "message": message}},
        status_code=status or STATUS.get(code, 400),
        headers={"Cache-Control": "no-store"},
    )
    if code == "UNAUTHENTICATED":
        web_session.clear_cookie(response)
    return response


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(VennError)
    async def _venn_error(_: Request, exc: VennError) -> JSONResponse:
        return _error(exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def _bad_request(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(part) for part in first.get("loc", ())[1:])
        return _error("INVALID_REQUEST", f"{where}: {first.get('msg', 'invalid')}" if where else "Invalid request.")

    @app.exception_handler(ValidationError)
    async def _bad_value(_: Request, exc: ValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        return _error("INVALID_REQUEST", str(first.get("msg", "Invalid request.")))


class _FailedSignIns:
    """Wrong passcodes per client in the last few minutes (in memory; development sign-in only)."""

    def __init__(self) -> None:
        self._seen: dict[str, list[float]] = {}

    def _recent(self, key: str) -> list[float]:
        cutoff = time.monotonic() - _FAILED_WINDOW_SECONDS
        recent = [t for t in self._seen.get(key, []) if t > cutoff]
        self._seen[key] = recent
        return recent

    def blocked(self, key: str) -> bool:
        return len(self._recent(key)) >= _MAX_FAILED_SIGN_INS

    def record(self, key: str) -> None:
        self._recent(key).append(time.monotonic())
        if len(self._seen) > 10_000:  # never grow without bound
            self._seen.clear()


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def _friend_ids(kind: str, friend_id: str) -> tuple[str | None, str | None]:
    if kind == "connection":
        return friend_id, None
    if kind == "person":
        return None, friend_id
    raise NotFound("friend not found")


# ------------------------------------------------------------------------- router
def build_api(settings: Settings) -> APIRouter:  # noqa: C901 - flat list of routes
    verifier = (
        JWTTokenVerifier(settings.oauth_issuer, settings.oauth_audience, settings.oauth_jwks_url)
        if settings.auth_mode == "jwt"
        else None
    )
    failed = _FailedSignIns()
    linkedin_fetches = linkedin_service.FetchLimiter(settings.linkedin_fetches_per_hour)
    dev = settings.auth_mode == "dev"

    def same_site_only(request: Request) -> None:
        # A page on another site cannot add a custom header to a cookie-carrying request.
        if request.method in _MUTATING and request.headers.get("x-venn-request") != "1":
            raise Forbidden("This request must come from the Venn website.")

    async def maybe_identity(request: Request) -> Identity | None:
        if verifier is not None:
            scheme, _, token = request.headers.get("authorization", "").partition(" ")
            if scheme.lower() != "bearer" or not token:
                return None
            access = await verifier.verify_token(token.strip())
            if access is None or not access.subject:
                return None
            claims = access.claims or {}
            name = claims.get("name")
            return Identity(
                subject=f"{claims.get('iss') or 'unknown'}|{access.subject}",
                name=name if isinstance(name, str) else None,
                provision=True,
            )
        username = web_session.username_from(request, settings)
        return Identity(subject=web_session.dev_subject(username), username=username) if username else None

    async def identity(found: Identity | None = Depends(maybe_identity)) -> Identity:
        if found is None:
            raise Unauthenticated("Sign in to Venn.")
        return found

    def account(db: Session, who: Identity) -> User:
        if who.provision:
            return user_service.get_or_create_user(db, who.subject, who.name)[0]
        user = web_session.find_user(db, who.subject)
        if user is None:
            raise Unauthenticated("Sign in to Venn.")
        return user

    def run(who: Identity, fn: Callable[[Session, User], Any]) -> Any:
        with session_scope() as db:
            return _json(fn(db, account(db, who)))

    api = APIRouter(prefix="/api/v1", dependencies=[Depends(same_site_only)])
    api.include_router(build_overlap_api(identity, run))
    Who = Depends(identity)  # noqa: N806 - reads like a type in the signatures below

    # ---------------------------------------------------------------- sign-in
    @api.get("/session")
    def session_state(who: Identity | None = Depends(maybe_identity)) -> dict:
        state: dict[str, Any] = {
            "signed_in": False,
            "auth_mode": settings.auth_mode,
            "sign_in_available": dev,
            "passcode_required": dev and bool(settings.dev_auth_passcode),
            "display_name": None,
            "username": None,
        }
        if who is not None:
            with session_scope() as db:
                user = web_session.find_user(db, who.subject)
                if user is None and who.provision:
                    user = account(db, who)
                if user is not None:
                    state.update(signed_in=True, display_name=user_service.display_name(user), username=who.username)
        return state

    @api.post("/session")
    def sign_in(body: SignInBody, request: Request) -> JSONResponse:
        if not dev:
            raise Forbidden("Sign-in on this site isn't set up for this server.")
        client = _client_key(request)
        if settings.dev_auth_passcode:
            if failed.blocked(client):
                raise RateLimited("Too many wrong passcodes. Wait a few minutes and try again.")
            if not secrets.compare_digest((body.passcode or "").encode(), settings.dev_auth_passcode.encode()):
                failed.record(client)
                raise Forbidden("Wrong passcode.")
        username = body.username.strip().lower()
        if not web_session.USERNAME_RE.fullmatch(username):
            raise InvalidRequest("Usernames are 2–32 characters: letters, digits, dot, dash or underscore.")
        with session_scope() as db:
            subject = web_session.dev_subject(username)
            user = web_session.find_user(db, subject)
            created = False
            if user is None:
                if not body.create:
                    # Never create an account as a side effect of signing in.
                    raise NotFound(f"No Venn account called “{username}” yet.")
                user, created = user_service.get_or_create_user(db, subject, body.display_name or username)
            analytics.track(db, "web_signed_in", user.id)
            payload = {
                "signed_in": True,
                "user_id": str(user.id),
                "display_name": user_service.display_name(user),
                "username": username,
                "created": created,
            }
        response = JSONResponse(payload, headers={"Cache-Control": "no-store"})
        web_session.set_cookie(response, request, settings, username)
        return response

    @api.delete("/session")
    def sign_out() -> JSONResponse:
        response = JSONResponse({"signed_out": True})
        web_session.clear_cookie(response)
        return response

    # ---------------------------------------------------------------- account
    @api.get("/me")
    def me(who: Identity = Who) -> Any:
        def view(db: Session, user: User) -> dict:
            return {
                "user_id": str(user.id),
                "display_name": user_service.display_name(user),
                "username": who.username,
                "auth_mode": settings.auth_mode,
                "mcp_url": settings.mcp_resource_url,
                "profile": _json(user_service.get_profile(db, user)),
            }

        return run(who, view)

    @api.patch("/me")
    def update_me(body: ProfileUpdate, who: Identity = Who) -> Any:
        return run(who, lambda db, user: user_service.update_profile(db, user, body))

    @api.delete("/me")
    def delete_me(body: DeleteAccountBody, who: Identity = Who) -> JSONResponse:
        if body.confirmation.strip() != user_service.DELETE_ACCOUNT_CONFIRMATION:
            raise InvalidRequest(f"Type '{user_service.DELETE_ACCOUNT_CONFIRMATION}' to confirm.")
        run(who, lambda db, user: user_service.delete_account(db, user))
        response = JSONResponse({"deleted": True})
        web_session.clear_cookie(response)
        return response

    @api.get("/home")
    def home(who: Identity = Who) -> Any:
        return run(who, dashboard_service.build_home)

    @api.get("/help")
    def help_(who: Identity = Who) -> Any:
        return run(who, dashboard_service.build_help)

    # --------------------------------------------------------------- memories
    @api.get("/memories")
    def memories(q: str | None = None, category: MemoryCategory | None = None, who: Identity = Who) -> Any:
        def view(db: Session, user: User):
            if q and q.strip():
                found = memory_service.search_memories(db, user, q, limit=50)
                if category is not None:
                    found.memories = [m for m in found.memories if m.category == category]
                    found.count = len(found.memories)
                return found
            return memory_service.list_memories(db, user, category, limit=500)

        return run(who, view)

    @api.post("/memories")
    def add_memory(body: MemoryBody, who: Identity = Who) -> Any:
        def save(db: Session, user: User) -> dict:
            out = memory_service.create_memory(
                db, user, body.category, body.title, body.description, body.tags, body.visibility, body.people
            )
            return {"memory": _json(out.saved[0]), "people_added": out.people_added}

        return run(who, save)

    @api.patch("/memories/{memory_id}")
    def update_memory(memory_id: str, body: MemoryUpdateBody, who: Identity = Who) -> Any:
        return run(
            who,
            lambda db, user: memory_service.update_memory(
                db, user, memory_id, body.title, body.description, body.visibility
            ),
        )

    @api.delete("/memories/{memory_id}")
    def delete_memory(memory_id: str, who: Identity = Who) -> Any:
        return run(who, lambda db, user: memory_service.delete_memory(db, user, memory_id))

    # ----------------------------------------------------------------- people
    @api.get("/people")
    def people(who: Identity = Who) -> Any:
        return run(who, people_service.list_people)

    @api.post("/people")
    def add_person(body: PersonCandidate, who: Identity = Who) -> Any:
        return run(
            who,
            lambda db, user: people_service.add_person(
                db, user, body.name, body.relationship, body.notes, body.interests, body.last_met_days_ago
            ),
        )

    @api.post("/people/import-preview")
    def import_preview(body: ImportPreviewBody, who: Identity = Who) -> Any:
        return run(who, lambda db, user: people_service.propose_import(db, user, body.people, body.source))

    @api.post("/people/import")
    def import_people(body: ImportBody, who: Identity = Who) -> Any:
        return run(
            who, lambda db, user: people_service.import_people(db, user, body.import_id, body.indexes, channel="web")
        )

    @api.post("/instagram/demo-preview")
    def instagram_demo_preview(who: Identity = Who) -> Any:
        """Preview fictional profiles without contacting Instagram."""
        return run(who, lambda db, user: people_service.propose_demo_import(db, user, "instagram", channel="web"))

    # --------------------------------------------------------------- linkedin
    @api.post("/linkedin/demo-preview")
    def linkedin_demo_preview(who: Identity = Who) -> Any:
        """Preview 100 fictional connections without contacting LinkedIn or an enrichment service."""
        return run(who, lambda db, user: people_service.propose_demo_import(db, user, "linkedin", channel="web"))

    @api.post("/linkedin/connections")
    def linkedin_connections(body: LinkedInConnectionsBody, who: Identity = Who) -> Any:
        """The user's own LinkedIn connections, read with the cookies they pasted. Saves nothing."""
        with session_scope() as db:
            user_id = str(account(db, who).id)
        linkedin_service.parse_cookies(body.cookies)  # a typo should not count against the limit
        linkedin_fetches.check(user_id)
        # No database session is held while LinkedIn is being read.
        page = linkedin_service.fetch_connections(body.cookies, settings.linkedin_max_connections)

        def result(db: Session, user: User) -> dict:
            known = people_service.existing_names(db, user)
            return {
                "connections": [
                    {
                        "public_identifier": c.public_identifier,
                        "name": c.name,
                        "headline": c.headline,
                        "profile_url": c.profile_url,
                        "connected_on": c.connected_on,
                        "already_added": c.name.lower() in known,
                    }
                    for c in page.connections
                ],
                "count": len(page.connections),
                "total": page.total,
                "truncated": page.truncated,
                "stopped": page.stopped,
                "details_available": bool(settings.apify_token),
                "max_details": settings.linkedin_max_enriched,
                "max_import": people_service.MAX_IMPORT_CANDIDATES,
            }

        return run(who, result)

    @api.post("/linkedin/export")
    def linkedin_export(body: LinkedInExportBody, who: Identity = Who) -> Any:
        """Read LinkedIn's own connections export file (no cookies needed). Saves nothing."""
        rows = linkedin_service.parse_export(body.csv, settings.linkedin_max_connections)

        def result(db: Session, user: User) -> dict:
            known = people_service.existing_names(db, user)
            return {
                "connections": [
                    {
                        **row,
                        "profile_url": (
                            f"https://www.linkedin.com/in/{row['public_identifier']}"
                            if row["public_identifier"]
                            else ""
                        ),
                        "connected_on": None,
                        "already_added": row["name"].lower() in known,
                    }
                    for row in rows
                ],
                "count": len(rows),
                "total": len(rows),
                "truncated": False,
                "stopped": None,
                "details_available": bool(settings.apify_token),
                "max_details": settings.linkedin_max_enriched,
                "max_import": people_service.MAX_IMPORT_CANDIDATES,
            }

        return run(who, result)

    @api.post("/linkedin/import-preview")
    def linkedin_import_preview(body: LinkedInPreviewBody, who: Identity = Who) -> Any:
        """Turn the connections the user ticked into a people import to review. Adds nobody yet."""
        with session_scope() as db:
            account(db, who)
        picks = list({(p.public_identifier or p.name.lower()): p for p in body.people}.values())
        profiles: dict[str, dict] = {}
        details_error: str | None = None
        if settings.apify_token:
            try:
                profiles = linkedin_service.fetch_profiles(
                    [p.public_identifier for p in picks[: settings.linkedin_max_enriched] if p.public_identifier],
                    token=settings.apify_token,
                    actor=settings.apify_profile_actor,
                    timeout=settings.apify_timeout_seconds,
                )
            except UpstreamError as exc:
                details_error = exc.message  # still import with what the list gave us
        candidates = [
            linkedin_service.candidate(p.name, p.headline, profiles.get(p.public_identifier or "")) for p in picks
        ]

        def result(db: Session, user: User) -> dict:
            view = people_service.propose_import(db, user, candidates, linkedin_service.SOURCE)
            return {
                **view.model_dump(mode="json"),
                "details_for": len(profiles),
                "details_error": details_error,
            }

        return run(who, result)

    @api.patch("/people/{person_id}")
    def update_person(person_id: str, body: PersonUpdateBody, who: Identity = Who) -> Any:
        return run(
            who,
            lambda db, user: people_service.update_person(
                db, user, person_id, body.name, body.relationship, body.notes, body.interests
            ),
        )

    @api.delete("/people/{person_id}")
    def delete_person(person_id: str, who: Identity = Who) -> Any:
        return run(who, lambda db, user: people_service.delete_person(db, user, person_id))

    # ---------------------------------------------------------------- friends
    @api.get("/friends")
    def friends(who: Identity = Who) -> Any:
        return run(who, rel.list_friends)

    @api.get("/friends/{kind}/{friend_id}")
    def friend(kind: str, friend_id: str, who: Identity = Who) -> Any:
        cid, pid = _friend_ids(kind, friend_id)
        return run(who, lambda db, user: rel.view_friend(db, user, cid, pid))

    @api.get("/friends/{kind}/{friend_id}/venn")
    def friend_venn(kind: str, friend_id: str, who: Identity = Who) -> Any:
        cid, pid = _friend_ids(kind, friend_id)
        return run(who, lambda db, user: rel.compare(db, user, cid, pid))

    @api.get("/friends/{kind}/{friend_id}/ideas")
    def friend_ideas(kind: str, friend_id: str, who: Identity = Who) -> Any:
        cid, pid = _friend_ids(kind, friend_id)
        return run(who, lambda db, user: rel.suggest_activity(db, user, cid, pid))

    @api.get("/friends/{kind}/{friend_id}/brief")
    def friend_brief(kind: str, friend_id: str, who: Identity = Who) -> Any:
        cid, pid = _friend_ids(kind, friend_id)
        return run(who, lambda db, user: rel.meetup_brief(db, user, cid, pid))

    @api.post("/friends/{kind}/{friend_id}/interactions")
    def log_interaction(kind: str, friend_id: str, body: InteractionBody, who: Identity = Who) -> Any:
        cid, pid = _friend_ids(kind, friend_id)
        return run(who, lambda db, user: rel.log_interaction(db, user, cid, pid, body.activity))

    @api.post("/friends/{kind}/{friend_id}/follow-ups")
    def add_follow_up(kind: str, friend_id: str, body: FollowUpBody, who: Identity = Who) -> Any:
        cid, pid = _friend_ids(kind, friend_id)
        return run(who, lambda db, user: rel.add_follow_up(db, user, cid, pid, body.text))

    # ------------------------------------------- search, this week, reconnect
    @api.get("/search")
    def search(q: str = "", who: Identity = Who) -> Any:
        if len(q.strip()) < 2:
            raise InvalidRequest("Type at least two letters to search.")
        return run(who, lambda db, user: rel.find_people(db, user, q[:120], limit=12))

    @api.get("/circle-idea")
    def circle_idea(who: Identity = Who) -> dict:
        # A proactive read must not provision an account as a side effect.
        with session_scope() as db:
            user = web_session.find_user(db, who.subject)
            if user is None:
                if who.provision:
                    return {"idea": None}
                raise Unauthenticated("Sign in to Venn.")
            return circle_idea_service.circle_idea(db, user)

    @api.get("/this-week")
    def this_week(who: Identity = Who) -> Any:
        return run(who, rel.this_week)

    @api.get("/reconnect")
    def reconnect(who: Identity = Who) -> Any:
        return run(who, rel.reconnection_suggestions)

    @api.get("/quiz")
    def quiz(connection_id: str | None = None, who: Identity = Who) -> Any:
        return run(who, lambda db, user: quiz_service.start_quiz(db, user, connection_id))

    # ------------------------------------------------------------- follow-ups
    @api.get("/follow-ups")
    def follow_ups(who: Identity = Who) -> Any:
        return run(who, rel.list_open_follow_ups)

    @api.post("/follow-ups/{follow_up_id}/done")
    def follow_up_done(follow_up_id: str, who: Identity = Who) -> Any:
        return run(who, lambda db, user: rel.complete_follow_up(db, user, follow_up_id))

    # ------------------------------------------------------------------ plans
    @api.get("/plans")
    def plans(status: str = "planned", who: Identity = Who) -> Any:
        return run(who, lambda db, user: plan_service.list_plans(db, user, status))

    @api.post("/plans")
    def save_plan(body: PlanBody, who: Identity = Who) -> Any:
        return run(
            who,
            lambda db, user: plan_service.save_plan(
                db, user, body.title, body.details, body.planned_for, body.connection_ids, body.person_ids
            ),
        )

    @api.post("/plans/{plan_id}/done")
    def plan_done(plan_id: str, who: Identity = Who) -> Any:
        return run(who, lambda db, user: plan_service.complete_plan(db, user, plan_id))

    @api.delete("/plans/{plan_id}")
    def delete_plan(plan_id: str, who: Identity = Who) -> Any:
        return run(who, lambda db, user: plan_service.delete_plan(db, user, plan_id))

    # ------------------------------------------------------------- connecting
    @api.post("/invites")
    def create_invite(body: InviteBody, who: Identity = Who) -> Any:
        return run(who, lambda db, user: social_service.create_invite(db, user, max_uses=body.max_uses))

    @api.post("/invites/redeem")
    def redeem_invite(body: RedeemBody, who: Identity = Who) -> Any:
        return run(who, lambda db, user: social_service.redeem_invite(db, user, body.code))

    @api.post("/requests/{request_id}")
    def respond(request_id: str, body: RespondBody, who: Identity = Who) -> Any:
        return run(who, lambda db, user: social_service.respond_to_request(db, user, request_id, body.accept))

    # ---------------------------------------------------- answers from friends
    @api.post("/question-links")
    def create_question_link(body: QuestionLinkBody, who: Identity = Who) -> Any:
        return run(who, lambda db, user: question_service.create_link(db, user, body.person_id, body.name))

    @api.delete("/question-links/{link_id}")
    def revoke_question_link(link_id: str, who: Identity = Who) -> Any:
        return run(who, lambda db, user: question_service.revoke_link(db, user, link_id))

    @api.get("/answers")
    def answers(who: Identity = Who) -> Any:
        return run(who, question_service.review)

    @api.post("/answers/{response_id}/save")
    def save_answers(response_id: str, body: SaveAnswersBody, who: Identity = Who) -> Any:
        return run(
            who, lambda db, user: question_service.save_answers(db, user, response_id, list(body.keys), body.name)
        )

    @api.delete("/answers/{response_id}")
    def discard_answers(response_id: str, who: Identity = Who) -> Any:
        return run(who, lambda db, user: question_service.discard_answers(db, user, response_id))

    # ----------------------------------------------------------- sample circle
    @api.post("/sample")
    def load_sample(who: Identity = Who) -> Any:
        return run(who, sample_service.load)

    @api.delete("/sample")
    def remove_sample(who: Identity = Who) -> Any:
        return run(who, sample_service.remove)

    return api
