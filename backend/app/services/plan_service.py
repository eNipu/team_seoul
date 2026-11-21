"""Plans: something the user intends to do with one or more friends.

A plan is the user's own record. Saving one contacts nobody and is never visible to the friends
in it. Marking a plan done logs a hangout with each friend in it.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Connection, Person, Plan, PlanMember, User
from app.models._base import as_aware, utcnow
from app.schemas.social import CompletePlanOut, DeletePlanOut, PlanListOut, PlanMemberOut, PlanOut
from app.services import analytics, people_service, user_service
from app.services import relationship_service as rel
from app.services.errors import InvalidRequest, NotFound

MAX_TITLE_LEN = 120
MAX_DETAILS_LEN = 500
MAX_MEMBERS = 6
MAX_OPEN_PLANS = 50
MAX_LISTED = 100


def _members(db: Session, user: User, plan: Plan) -> list[PlanMemberOut]:
    out: list[PlanMemberOut] = []
    for member in db.scalars(select(PlanMember).where(PlanMember.plan_id == plan.id).order_by(PlanMember.id)):
        if member.person_id is not None:
            person = db.get(Person, member.person_id)
            if person is not None:
                out.append(PlanMemberOut(kind="person", id=str(person.id), display_name=person.name))
        elif member.connection_id is not None:
            conn = db.get(Connection, member.connection_id)
            if conn is None:
                continue
            friend_id = conn.user_b_id if conn.user_a_id == user.id else conn.user_a_id
            friend = db.get(User, friend_id)
            if friend is not None:
                out.append(
                    PlanMemberOut(kind="connection", id=str(conn.id), display_name=user_service.display_name(friend))
                )
    return sorted(out, key=lambda m: m.display_name.lower())


def to_out(db: Session, user: User, plan: Plan) -> PlanOut:
    return PlanOut(
        plan_id=str(plan.id),
        title=plan.title,
        details=plan.details,
        planned_for=as_aware(plan.planned_for) if plan.planned_for else None,
        status="done" if plan.done_at else "planned",
        members=_members(db, user, plan),
        created_at=as_aware(plan.created_at),
    )


def _owned(db: Session, user: User, plan_id: str) -> Plan:
    try:
        pid = uuid.UUID(str(plan_id))
    except (ValueError, TypeError):
        raise NotFound("plan not found") from None
    plan = db.scalar(select(Plan).where(Plan.id == pid, Plan.owner_user_id == user.id))
    if plan is None:
        raise NotFound("plan not found")
    return plan


def save_plan(
    db: Session,
    user: User,
    title: str,
    details: str | None = None,
    planned_for: datetime | None = None,
    connection_ids: list[str] | None = None,
    person_ids: list[str] | None = None,
) -> PlanOut:
    title = people_service.clean_line(title, MAX_TITLE_LEN)
    details = people_service.clean_line(details, MAX_DETAILS_LEN)
    if not title:
        raise InvalidRequest("A plan needs a title.")
    people_service.reject_sensitive(title, details)
    connection_ids = list(dict.fromkeys(connection_ids or []))
    person_ids = list(dict.fromkeys(person_ids or []))
    if len(connection_ids) + len(person_ids) > MAX_MEMBERS:
        raise InvalidRequest(f"A plan can include up to {MAX_MEMBERS} friends.")
    open_plans = db.scalar(
        select(func.count()).select_from(Plan).where(Plan.owner_user_id == user.id, Plan.done_at.is_(None))
    )
    if (open_plans or 0) >= MAX_OPEN_PLANS:
        raise InvalidRequest(f"You have {MAX_OPEN_PLANS} open plans. Finish or delete one first.")
    # Resolving each friend enforces ownership (and blocks) exactly as everywhere else.
    friends = [rel.resolve(db, user, cid, None) for cid in connection_ids]
    friends += [rel.resolve(db, user, None, pid) for pid in person_ids]

    plan = Plan(owner_user_id=user.id, title=title, details=details, planned_for=planned_for)
    db.add(plan)
    db.flush()
    for friend in friends:
        if friend.kind == "person":
            db.add(PlanMember(plan_id=plan.id, person_id=friend.person.id))
        else:
            db.add(PlanMember(plan_id=plan.id, connection_id=friend.connection.id))
    db.flush()
    analytics.track(db, "plan_saved", user.id, count=len(friends))
    return to_out(db, user, plan)


def list_plans(db: Session, user: User, status: str = "planned") -> PlanListOut:
    if status not in {"planned", "done", "all"}:
        raise InvalidRequest("status must be planned, done or all.")
    query = select(Plan).where(Plan.owner_user_id == user.id)
    if status == "planned":
        query = query.where(Plan.done_at.is_(None))
    elif status == "done":
        query = query.where(Plan.done_at.is_not(None))
    rows = list(db.scalars(query.limit(MAX_LISTED * 2)))
    far = datetime.max.replace(tzinfo=utcnow().tzinfo)

    def order(plan: Plan):
        if plan.done_at is not None:
            # Finished plans after open ones, most recently finished first.
            return (1, -as_aware(plan.done_at).timestamp(), 0.0)
        # Open plans: soonest first, undated last, then oldest first.
        when = as_aware(plan.planned_for) if plan.planned_for else far
        return (0, when.timestamp() if plan.planned_for else float("inf"), as_aware(plan.created_at).timestamp())

    rows.sort(key=order)
    plans = [to_out(db, user, plan) for plan in rows[:MAX_LISTED]]
    return PlanListOut(plans=plans, count=len(plans))


def complete_plan(db: Session, user: User, plan_id: str) -> CompletePlanOut:
    """Mark a plan done and log a hangout with each friend in it. Idempotent."""
    plan = _owned(db, user, plan_id)
    if plan.done_at is not None:
        return CompletePlanOut(done=True, plan_id=str(plan.id), logged=0)
    plan.done_at = utcnow()
    db.flush()
    logged = 0
    for member in _members(db, user, plan):
        try:
            rel.log_interaction(
                db,
                user,
                connection_id=member.id if member.kind == "connection" else None,
                person_id=member.id if member.kind == "person" else None,
                activity=plan.title,
            )
            logged += 1
        except NotFound:
            continue  # e.g. the connection was blocked since the plan was made
    analytics.track(db, "plan_done", user.id, count=logged)
    return CompletePlanOut(done=True, plan_id=str(plan.id), logged=logged)


def delete_plan(db: Session, user: User, plan_id: str) -> DeletePlanOut:
    plan = _owned(db, user, plan_id)
    pid = str(plan.id)
    db.delete(plan)
    db.flush()
    return DeletePlanOut(deleted=True, plan_id=pid)
