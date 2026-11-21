"""Explicit consent records (e.g. sharing memories with connections)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Consent
from app.models._base import utcnow

SHARE_MEMORIES_WITH_CONNECTIONS = "SHARE_MEMORIES_WITH_CONNECTIONS"
PUBLIC_PROFILE = "PUBLIC_PROFILE"


def grant(db: Session, user_id: uuid.UUID, consent_type: str, resource_id: uuid.UUID | None) -> Consent:
    existing = active(db, user_id, consent_type, resource_id)
    if existing:
        return existing
    consent = Consent(user_id=user_id, consent_type=consent_type, resource_id=resource_id)
    db.add(consent)
    db.flush()
    return consent


def active(db: Session, user_id: uuid.UUID, consent_type: str, resource_id: uuid.UUID | None) -> Consent | None:
    return db.scalar(
        select(Consent).where(
            Consent.user_id == user_id,
            Consent.consent_type == consent_type,
            Consent.resource_id == resource_id,
            Consent.revoked_at.is_(None),
        )
    )


def revoke(db: Session, user_id: uuid.UUID, consent_type: str, resource_id: uuid.UUID | None) -> int:
    rows = db.scalars(
        select(Consent).where(
            Consent.user_id == user_id,
            Consent.consent_type == consent_type,
            Consent.resource_id == resource_id,
            Consent.revoked_at.is_(None),
        )
    ).all()
    for c in rows:
        c.revoked_at = utcnow()
    return len(rows)
