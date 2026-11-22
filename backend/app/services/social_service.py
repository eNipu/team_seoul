"""Invites, mutual connections, and blocking/reporting.

Relationship maintenance (friend view, activity ideas, reconnection) lives in
`relationship_service`.

Rules:
- Connections are mutual: redeeming an invite code connects the redeemer and the invite creator
  at once (the creator consented by sharing the code). Requests from other sources must still be
  accepted by the recipient.
- Venn never contacts anyone automatically.
- Blocks are enforced in both directions.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import timedelta

import segno
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
    RelationshipEvent,
    User,
)
from app.models._base import as_aware, utcnow
from app.schemas.social import (
    ConnectionListOut,
    ConnectionOut,
    InviteOut,
    PendingRequestListOut,
    PendingRequestOut,
    RedeemInviteOut,
    RespondConnectionOut,
)
from app.services import analytics
from app.services.errors import InvalidRequest, NotFound, RateLimited
from app.services.user_service import display_name, is_sample_user

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


def own_connection(db: Session, user: User, connection_id: str) -> tuple[Connection, uuid.UUID]:
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
    link = invite_link(settings.public_base_url, pretty)
    return InviteOut(
        code=pretty,
        expires_at=expires_at,
        max_uses=max_uses,
        share_text=f"I want us closer. Join me on Venn — our ChatGPTs keep the little things for us. {link}",
        link=link,
        qr=qr_rows(link),
    )


def invite_link(base_url: str, pretty_code: str) -> str:
    """Page a friend can open (or scan) to see the code and how to redeem it."""
    return f"{base_url.rstrip('/')}/i/{pretty_code}"


def qr_rows(text: str) -> list[str]:
    """QR code for `text`: one string of '0'/'1' per row ('1' = dark), without a quiet zone."""
    return ["".join("1" if cell else "0" for cell in row) for row in segno.make(text, error="m", micro=False).matrix]


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
    """Redeeming a valid code connects the redeemer with the invite creator right away.

    Both sides have consented: the inviter by creating and sharing the code, the friend by
    redeeming it. Connecting changes nothing about what either side shares; memories stay at the
    visibility each owner chose.
    """
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
    existing = get_connection_between(db, user.id, inviter.id)
    if existing:
        return RedeemInviteOut(
            status="ALREADY_CONNECTED",
            request_id=None,
            connection_id=str(existing.id),
            inviter_display_name=name,
            message=f"You and {name} are connected.",
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

    now = utcnow()
    # Any older pending request between the two is settled by this redeem.
    for pending in db.scalars(
        select(ConnectionRequest).where(
            ConnectionRequest.status == "PENDING",
            or_(
                (ConnectionRequest.sender_user_id == user.id) & (ConnectionRequest.recipient_user_id == inviter.id),
                (ConnectionRequest.sender_user_id == inviter.id) & (ConnectionRequest.recipient_user_id == user.id),
            ),
        )
    ).all():
        pending.status = "ACCEPTED"
        pending.responded_at = now
    # Kept as an audit record of which invite created the connection.
    req = ConnectionRequest(
        sender_user_id=user.id,
        recipient_user_id=inviter.id,
        status="ACCEPTED",
        context_invite_id=invite.id,
        responded_at=now,
    )
    invite.use_count += 1
    db.add(req)
    db.flush()

    ua, ub = _pair(user.id, inviter.id)
    conn = Connection(user_a_id=ua, user_b_id=ub)
    try:
        with db.begin_nested():
            db.add(conn)
            db.flush()
    except IntegrityError:  # a concurrent redeem/accept created it first
        conn = get_connection_between(db, user.id, inviter.id)
        assert conn is not None
    else:
        db.add(RelationshipEvent(connection_id=conn.id, event_type="CONNECTED", event_data={}))
    db.flush()
    analytics.track(db, "invitation_redeemed", user.id)
    analytics.track(db, "connection_accepted", user.id)
    return RedeemInviteOut(
        status="CONNECTED",
        request_id=str(req.id),
        connection_id=str(conn.id),
        inviter_display_name=name,
        message=f"You and {name} are connected.",
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
            is_sample=is_sample_user(db.get(User, r.sender_user_id)),
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


def last_interaction(db: Session, connection_id: uuid.UUID):
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
        friend = db.get(User, friend_id)
        out.append(
            ConnectionOut(
                connection_id=str(c.id),
                user_id=str(friend_id),
                display_name=display_name(friend),
                since=as_aware(c.created_at),
                last_interaction_at=last_interaction(db, c.id),
                is_sample=is_sample_user(friend),
            )
        )
    return ConnectionListOut(connections=out)


def remove_connection(db: Session, user: User, connection_id: str) -> None:
    conn, _ = own_connection(db, user, connection_id)
    db.delete(conn)
    db.flush()


def block_user(db: Session, user: User, connection_id: str | None = None, request_id: str | None = None) -> str:
    """Block a connected friend or the sender of a pending request. Removes the connection."""
    if connection_id:
        conn, target = own_connection(db, user, connection_id)
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
        _, target = own_connection(db, user, connection_id)
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
