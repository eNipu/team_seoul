"""Signed-in website routes for opt-in Overlap introductions."""

from collections.abc import Callable
from typing import Any, Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.db.database import session_scope
from app.models import User
from app.schemas.overlap import OverlapLocation, OverlapPreferenceInput, OverlapState
from app.services import overlap_service
from app.services.errors import Unauthenticated
from app.web.session import Identity, find_user


class ResponseBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["yes", "pass", "block", "suggest_spot"]


class ReportBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: Literal["safety", "spam", "other"]


def build_overlap_api(identity: Callable, run: Callable[[Identity, Callable[[Session, User], BaseModel]], Any]):
    def private_response(response: Response) -> None:
        response.headers["Cache-Control"] = "private, no-store"

    router = APIRouter(prefix="/overlap", dependencies=[Depends(private_response)])
    who_required = Depends(identity)

    @router.get("")
    def state(who: Identity = who_required) -> OverlapState:
        # Home polls this route. A read must not provision an account or open a window.
        with session_scope() as db:
            user = find_user(db, who.subject)
            if user is None:
                if who.provision:
                    return OverlapState()
                raise Unauthenticated("Sign in to Venn.")
            return overlap_service.get_state(db, user)

    @router.get("/location")
    def location(who: Identity = who_required) -> OverlapLocation:
        with session_scope() as db:
            user = find_user(db, who.subject)
            if user is None and not who.provision:
                raise Unauthenticated("Sign in to Venn.")
            return OverlapLocation(area=user.overlap_area if user else None)

    @router.patch("/location")
    def update_location(body: OverlapLocation, who: Identity = who_required) -> OverlapLocation:
        def save(db: Session, user: User) -> OverlapLocation:
            user.overlap_area = body.area
            return body

        return run(who, save)

    @router.post("/preference")
    def opt_in(body: OverlapPreferenceInput, who: Identity = who_required) -> OverlapState:
        return run(who, lambda db, user: overlap_service.opt_in(db, user, body))

    @router.delete("/preference")
    def withdraw(who: Identity = who_required) -> OverlapState:
        return run(who, overlap_service.withdraw)

    @router.post("/matches/{id}/respond")
    def respond(id: str, body: ResponseBody, who: Identity = who_required) -> OverlapState:
        return run(who, lambda db, user: overlap_service.respond(db, user, id, body.action))

    @router.post("/matches/{id}/report")
    def report(id: str, body: ReportBody, who: Identity = who_required) -> OverlapState:
        return run(who, lambda db, user: overlap_service.report(db, user, id, body.reason))

    return router
