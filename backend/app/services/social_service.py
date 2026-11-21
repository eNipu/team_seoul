"""Invites, mutual connections, blocking/reporting, and relationship maintenance.

Rules:
- Connections are mutual: a request (created by redeeming an invite code) must be accepted by
  the invite creator.
- Heldly never contacts anyone automatically; suggestions are only shown to the requesting user.
- Only non-PRIVATE memories of a connected friend are ever used for suggestions.
- Blocks are enforced in both directions.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    AbuseReport,
    Block,
    Connection,
    ConnectionRequest,
    Invite,
    Memory,
    RelationshipEvent,
    User,
)
from app.models._base import as_aware, utcnow
from app.schemas.social import (
    ActivitySuggestion,
    ConnectionListOut,
    ConnectionOut,
    InviteOut,
    LogInteractionOut,
    PendingRequestListOut,
    PendingRequestOut,
    ReconnectionCandidate,
    ReconnectionOut,
    RedeemInviteOut,
    RespondConnectionOut,
    SuggestActivityOut,
)
from app.services import analytics, memory_service
from app.services.errors import InvalidRequest, NotFound, RateLimited
from app.services.user_service import display_name

# No ambiguous characters (0/O, 1/I/L).
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LEN = 8


def _parse_uuid(value: str, what: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        raise NotFound(f"{what} not found") from None


def _pair(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return (a, b) if str(a) < str(b) else (b, a)


def normalize_code(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())


def is_blocked(db: Session, a: uuid.UUID, b: uuid.UUID) -> bool:
    return (
        db.scalar(
            select(func.count())
            .select_from(Block)
            .where(
                or_(
                    (Block.blocker_user_id == a) & (Block.blocked_user_id == b),
                    (Block.blocker_user_id == b) & (Block.blocked_user_id == a),
                )
            )
        )
        or 0
    ) > 0


def get_connection_between(db: Session, a: uuid.UUID, b: uuid.UUID) -> Connection | None:
    ua, ub = _pair(a, b)
    return db.scalar(select(Connection).where(Connection.user_a_id == ua, Connection.user_b_id == ub))


def _own_connection(db: Session, user: User, connection_id: str) -> tuple[Connection, uuid.UUID]:
    cid = _parse_uuid(connection_id, "connection")
    conn = db.scalar(
        select(Connection).where(
            Connection.id == cid, or_(Connection.user_a_id == user.id, Connection.user_b_id == user.id)
        )
    )
    if conn is None:
        raise NotFound("connection not found")
    friend_id = conn.user_b_id if conn.user_a_id == user.id else conn.user_a_id
    return conn, friend_id


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------


def create_invite(db: Session, user: User, note: str | None = None, max_uses: int = 5) -> InviteOut:
    settings = get_settings()
    since = utcnow() - timedelta(days=1)
    recent = (
        db.scalar(
            select(func.count())
            .select_from(Invite)
            .where(Invite.created_by_user_id == user.id, Invite.created_at >= since)
        )
        or 0
    )
    if recent >= settings.max_invites_per_day:
        raise RateLimited("Too many invites created today. Try again tomorrow.")
    max_uses = min(max(max_uses, 1), 20)
    expires_at = utcnow() + timedelta(hours=settings.invite_ttl_hours)
    for _ in range(5):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LEN))
        if not db.scalar(select(Invite.id).where(Invite.code == code)):
            break
    else:  # pragma: no cover - astronomically unlikely
        raise InvalidRequest("Could not generate a unique code, please retry.")
    invite = Invite(
        created_by_user_id=user.id,
        code=code,
        note=(note or "").strip()[:200] or None,
        max_uses=max_uses,
        expires_at=expires_at,
    )
    db.add(invite)
    db.flush()
    analytics.track(db, "invite_created", user.id)
    pretty = f"{code[:4]}-{code[4:]}"
    return InviteOut(
        code=pretty,
        expires_at=expires_at,
        max_uses=max_uses,
        share_text=(
            f"Let's connect on Heldly! In ChatGPT, open the Heldly plugin and say: "
            f'"Redeem Heldly invite {pretty}". (Expires in {settings.invite_ttl_hours}h.)'
        ),
    )


def list_invites(db: Session, user: User) -> list[dict]:
    rows = db.scalars(
        select(Invite).where(Invite.created_by_user_id == user.id).order_by(Invite.created_at.desc()).limit(50)
    ).all()
    now = utcnow()
    return [
        {
            "code": f"{i.code[:4]}-{i.code[4:]}",
            "use_count": i.use_count,
            "max_uses": i.max_uses,
            "expires_at": as_aware(i.expires_at).isoformat(),
            "active": i.revoked_at is None and as_aware(i.expires_at) > now and i.use_count < i.max_uses,
        }
        for i in rows
    ]


def revoke_invite(db: Session, user: User, code: str) -> None:
    invite = db.scalar(select(Invite).where(Invite.code == normalize_code(code), Invite.created_by_user_id == user.id))
    if invite is None:
        raise NotFound("invite not found")
    if invite.revoked_at is None:
        invite.revoked_at = utcnow()
    db.flush()


def redeem_invite(db: Session, user: User, code: str) -> RedeemInviteOut:
    """Redeeming a valid code sends a connection request to the invite creator."""
    settings = get_settings()
    invite = db.scalar(select(Invite).where(Invite.code == normalize_code(code)).with_for_update())
    # Same error for unknown / revoked / expired / used-up codes: no oracle for code guessing.
    if (
        invite is None
        or invite.revoked_at is not None
        or as_aware(invite.expires_at) < utcnow()
        or invite.use_count >= invite.max_uses
    ):
        raise NotFound("invite code is invalid or expired")
    inviter = db.get(User, invite.created_by_user_id)
    if inviter is None:
        raise NotFound("invite code is invalid or expired")
    if inviter.id == user.id:
        raise InvalidRequest("This is your own invite code. Share it with a friend instead.")
    if is_blocked(db, user.id, inviter.id):
        raise NotFound("invite code is invalid or expired")

    name = display_name(inviter)
    if get_connection_between(db, user.id, inviter.id):
        return RedeemInviteOut(
            status="ALREADY_CONNECTED",
            request_id=None,
            inviter_display_name=name,
            message=f"You're already connected with {name}.",
        )
    pending = db.scalar(
        select(ConnectionRequest).where(
            ConnectionRequest.status == "PENDING",
            or_(
                (ConnectionRequest.sender_user_id == user.id) & (ConnectionRequest.recipient_user_id == inviter.id),
                (ConnectionRequest.sender_user_id == inviter.id) & (ConnectionRequest.recipient_user_id == user.id),
            ),
        )
    )
    if pending:
        return RedeemInviteOut(
            status="ALREADY_PENDING",
            request_id=str(pending.id),
            inviter_display_name=name,
            message=f"A connection request with {name} is already pending.",
        )

    since = utcnow() - timedelta(days=1)
    sent_today = (
        db.scalar(
            select(func.count())
            .select_from(ConnectionRequest)
            .where(ConnectionRequest.sender_user_id == user.id, ConnectionRequest.created_at >= since)
        )
        or 0
    )
    if sent_today >= settings.max_connection_requests_per_day:
        raise RateLimited("Too many connection requests today. Try again tomorrow.")

    req = ConnectionRequest(
        sender_user_id=user.id, recipient_user_id=inviter.id, status="PENDING", context_invite_id=invite.id
    )
    invite.use_count += 1
    db.add(req)
    db.flush()
    analytics.track(db, "invitation_redeemed", user.id)
    analytics.track(db, "connection_requested", user.id)
    return RedeemInviteOut(
        status="PENDING",
        request_id=str(req.id),
        inviter_display_name=name,
        message=f"Connection request sent to {name}. You'll be connected once they accept.",
    )


# ---------------------------------------------------------------------------
# Requests & connections
# ---------------------------------------------------------------------------


def pending_requests(db: Session, user: User) -> PendingRequestListOut:
    rows = db.scalars(
        select(ConnectionRequest)
        .where(ConnectionRequest.recipient_user_id == user.id, ConnectionRequest.status == "PENDING")
        .order_by(ConnectionRequest.created_at.desc())
    ).all()
    incoming = [
        PendingRequestOut(
            request_id=str(r.id),
            sender_display_name=display_name(db.get(User, r.sender_user_id)),
            created_at=as_aware(r.created_at),
        )
        for r in rows
        if not is_blocked(db, user.id, r.sender_user_id)
    ]
    outgoing = (
        db.scalar(
            select(func.count())
            .select_from(ConnectionRequest)
            .where(ConnectionRequest.sender_user_id == user.id, ConnectionRequest.status == "PENDING")
        )
        or 0
    )
    return PendingRequestListOut(incoming=incoming, outgoing_count=outgoing)


def respond_to_request(db: Session, user: User, request_id: str, accept: bool) -> RespondConnectionOut:
    rid = _parse_uuid(request_id, "request")
    req = db.scalar(
        select(ConnectionRequest)
        .where(ConnectionRequest.id == rid, ConnectionRequest.recipient_user_id == user.id)
        .with_for_update()
    )
    if req is None:
        raise NotFound("request not found")
    if req.status != "PENDING":
        raise InvalidRequest(f"Request already {req.status.lower()}.")
    req.responded_at = utcnow()
    if not accept or is_blocked(db, user.id, req.sender_user_id):
        req.status = "REJECTED"
        db.flush()
        return RespondConnectionOut(request_id=str(req.id), status="REJECTED", connection_id=None)

    req.status = "ACCEPTED"
    conn = get_connection_between(db, user.id, req.sender_user_id)
    if conn is None:
        ua, ub = _pair(user.id, req.sender_user_id)
        conn = Connection(user_a_id=ua, user_b_id=ub)
        try:
            with db.begin_nested():
                db.add(conn)
                db.flush()
        except IntegrityError:  # concurrent accept created it first
            conn = get_connection_between(db, user.id, req.sender_user_id)
            assert conn is not None
        db.add(RelationshipEvent(connection_id=conn.id, event_type="CONNECTED", event_data={}))
    db.flush()
    analytics.track(db, "connection_accepted", user.id)
    return RespondConnectionOut(request_id=str(req.id), status="ACCEPTED", connection_id=str(conn.id))


def _last_interaction(db: Session, connection_id: uuid.UUID):
    return as_aware(
        db.scalar(
            select(func.max(RelationshipEvent.created_at)).where(
                RelationshipEvent.connection_id == connection_id,
                RelationshipEvent.event_type == "INTERACTION",
            )
        )
    )


def list_connections(db: Session, user: User) -> ConnectionListOut:
    rows = db.scalars(
        select(Connection)
        .where(or_(Connection.user_a_id == user.id, Connection.user_b_id == user.id))
        .order_by(Connection.created_at.desc())
    ).all()
    out: list[ConnectionOut] = []
    for c in rows:
        friend_id = c.user_b_id if c.user_a_id == user.id else c.user_a_id
        if is_blocked(db, user.id, friend_id):
            continue
        out.append(
            ConnectionOut(
                connection_id=str(c.id),
                user_id=str(friend_id),
                display_name=display_name(db.get(User, friend_id)),
                since=as_aware(c.created_at),
                last_interaction_at=_last_interaction(db, c.id),
            )
        )
    return ConnectionListOut(connections=out)


def remove_connection(db: Session, user: User, connection_id: str) -> None:
    conn, _ = _own_connection(db, user, connection_id)
    db.delete(conn)
    db.flush()


def block_user(db: Session, user: User, connection_id: str | None = None, request_id: str | None = None) -> str:
    """Block a connected friend or the sender of a pending request. Removes the connection."""
    if connection_id:
        conn, target = _own_connection(db, user, connection_id)
        db.delete(conn)
    elif request_id:
        rid = _parse_uuid(request_id, "request")
        req = db.scalar(
            select(ConnectionRequest).where(ConnectionRequest.id == rid, ConnectionRequest.recipient_user_id == user.id)
        )
        if req is None:
            raise NotFound("request not found")
        target = req.sender_user_id
        if req.status == "PENDING":
            req.status = "REJECTED"
            req.responded_at = utcnow()
    else:
        raise InvalidRequest("Provide connection_id or request_id")
    if not db.get(Block, (user.id, target)):
        db.add(Block(blocker_user_id=user.id, blocked_user_id=target))
    db.flush()
    return display_name(db.get(User, target))


def report_user(
    db: Session, user: User, reason: str, connection_id: str | None = None, request_id: str | None = None
) -> None:
    reason = (reason or "").strip()
    if len(reason) < 3:
        raise InvalidRequest("Please describe the problem.")
    if connection_id:
        _, target = _own_connection(db, user, connection_id)
    elif request_id:
        rid = _parse_uuid(request_id, "request")
        req = db.scalar(
            select(ConnectionRequest).where(ConnectionRequest.id == rid, ConnectionRequest.recipient_user_id == user.id)
        )
        if req is None:
            raise NotFound("request not found")
        target = req.sender_user_id
    else:
        raise InvalidRequest("Provide connection_id or request_id")
    db.add(AbuseReport(reporter_user_id=user.id, reported_user_id=target, reason=reason[:1000]))
    db.flush()


# ---------------------------------------------------------------------------
# Relationship maintenance
# ---------------------------------------------------------------------------

_ACTIVITY_IDEAS: dict[str, tuple[str, str]] = {
    "hik": ("Weekend hike", "Pick a trail you've both wanted to try and pack snacks."),
    "coffee": ("Coffee catch-up", "Try a new café and swap recent highlights."),
    "food": ("Cook-off night", "Each make one dish and rate them together."),
    "cook": ("Cook-off night", "Each make one dish and rate them together."),
    "movie": ("Movie night", "Take turns picking a film and talk about it after."),
    "film": ("Movie night", "Take turns picking a film and talk about it after."),
    "music": ("Live music", "Find a small local show or share a playlist of new finds."),
    "game": ("Game night", "Board games or a co-op video game session."),
    "book": ("Two-person book club", "Read the same short book and meet to discuss."),
    "read": ("Two-person book club", "Read the same short book and meet to discuss."),
    "run": ("Run together", "A short easy run followed by breakfast."),
    "climb": ("Climbing session", "Try a bouldering gym together."),
    "art": ("Museum or gallery visit", "Pick an exhibit and grab a drink afterwards."),
    "travel": ("Plan a day trip", "Choose a nearby town neither of you has explored."),
    "photo": ("Photo walk", "Walk a neighborhood and each shoot ten photos."),
    "yoga": ("Yoga class", "Drop into a beginner-friendly class together."),
}
_DEFAULT_IDEAS = [
    ("Quick call", "A 15-minute call to catch up on what's new."),
    ("Walk and talk", "A relaxed walk somewhere green."),
]


def _interest_terms(memories: list[Memory]) -> dict[str, str]:
    """term -> human label, from INTEREST/PREFERENCE/EXPERIENCE memories."""
    terms: dict[str, str] = {}
    for m in memories:
        if m.category not in ("INTEREST", "PREFERENCE", "EXPERIENCE"):
            continue
        for tag in m.tags or []:
            terms.setdefault(tag.lower(), tag)
        for word in m.title.lower().replace("enjoys", "").split():
            w = word.strip(".,!?'\"")
            if len(w) > 3:
                terms.setdefault(w, w)
    return terms


def suggest_activity(db: Session, user: User, connection_id: str) -> SuggestActivityOut:
    conn, friend_id = _own_connection(db, user, connection_id)
    if is_blocked(db, user.id, friend_id):
        raise NotFound("connection not found")
    friend = db.get(User, friend_id)
    mine = list(db.scalars(select(Memory).where(Memory.user_id == user.id)).all())
    # Only memories the friend chose to share — never their PRIVATE ones.
    theirs = memory_service.visible_memories_of(db, friend_id, connected=True)
    my_terms, their_terms = _interest_terms(mine), _interest_terms(theirs)
    shared = sorted(set(my_terms) & set(their_terms))

    score = 0.2
    explanation = ["You're connected on Heldly (+0.2)."]
    if shared:
        bonus = min(0.6, 0.15 * len(shared))
        score += bonus
        explanation.append(f"{len(shared)} shared interest term(s) (+{bonus:.2f}).")
    last = _last_interaction(db, conn.id)
    if last is None or (utcnow() - last).days > 21:
        score += 0.2
        explanation.append("It's been a while since you last hung out (+0.2).")

    suggestions: list[ActivitySuggestion] = []
    used: set[str] = set()
    for term in shared:
        for key, (title, desc) in _ACTIVITY_IDEAS.items():
            if key in term and title not in used:
                used.add(title)
                suggestions.append(
                    ActivitySuggestion(
                        title=title,
                        description=desc,
                        grounded_in=[f"shared interest: {their_terms[term]}"],
                        suggested_action="Propose a time yourself — Heldly won't contact them for you.",
                    )
                )
    for title, desc in _DEFAULT_IDEAS:
        if len(suggestions) >= 3:
            break
        if title not in used:
            suggestions.append(
                ActivitySuggestion(
                    title=title,
                    description=desc,
                    grounded_in=["general relationship maintenance"],
                    suggested_action="Send a quick message to check in.",
                )
            )
    analytics.track(db, "activity_suggested", user.id)
    return SuggestActivityOut(
        connection_id=str(conn.id),
        friend_display_name=display_name(friend),
        shared_interests=[their_terms[t] for t in shared][:10],
        match_score=round(min(score, 1.0), 2),
        score_explanation=explanation,
        suggestions=suggestions[:3],
    )


def log_interaction(db: Session, user: User, connection_id: str, activity: str | None = None) -> LogInteractionOut:
    conn, _ = _own_connection(db, user, connection_id)
    now = utcnow()
    db.add(
        RelationshipEvent(
            connection_id=conn.id,
            event_type="INTERACTION",
            event_data={"by": str(user.id), "activity": (activity or "").strip()[:120] or None},
            created_at=now,
        )
    )
    db.flush()
    return LogInteractionOut(connection_id=str(conn.id), recorded=True, last_interaction_at=now)


def reconnection_suggestions(db: Session, user: User, min_days: int = 21, limit: int = 5) -> ReconnectionOut:
    now = utcnow()
    candidates: list[ReconnectionCandidate] = []
    for c in list_connections(db, user).connections:
        last = c.last_interaction_at or c.since
        days = (now - last).days
        if days < min_days:
            continue
        last_activity = None
        ev = db.scalar(
            select(RelationshipEvent)
            .where(
                RelationshipEvent.connection_id == uuid.UUID(c.connection_id),
                RelationshipEvent.event_type == "INTERACTION",
            )
            .order_by(RelationshipEvent.created_at.desc())
        )
        if ev is not None:
            last_activity = (ev.event_data or {}).get("activity")
        candidates.append(
            ReconnectionCandidate(
                connection_id=c.connection_id,
                display_name=c.display_name,
                days_since_last_interaction=days,
                last_activity=last_activity,
                reason=f"No logged hangout in {days} days.",
                suggested_activity=f"Repeat '{last_activity}'" if last_activity else "A quick call or coffee",
            )
        )
    candidates.sort(key=lambda x: -x.days_since_last_interaction)
    if candidates:
        analytics.track(db, "reconnection_suggested", user.id, count=len(candidates[:limit]))
    return ReconnectionOut(candidates=candidates[: min(max(limit, 1), 20)])
