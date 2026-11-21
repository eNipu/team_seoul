"""When the user takes meetings: working hours, buffers, notice and default length.

Owner-only. Read by the slot finder (services/slots.py) through `hours_of`.
"""

from __future__ import annotations

import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Availability, User
from app.schemas.scheduling import AvailabilityOut
from app.services.errors import InvalidRequest
from app.services.slots import Hours

DEFAULTS = {
    "timezone": "UTC",
    "work_days": [0, 1, 2, 3, 4],
    "day_start_minute": 9 * 60,
    "day_end_minute": 17 * 60,
    "buffer_minutes": 10,
    "min_notice_minutes": 4 * 60,
    "default_length_minutes": 30,
}
MAX_BUFFER = 60
MAX_NOTICE = 7 * 24 * 60
MIN_LENGTH, MAX_LENGTH = 15, 120
_HHMM = re.compile(r"^([01]\d|2[0-4]):([0-5]\d)$")


def _row(db: Session, user: User) -> Availability | None:
    return db.scalar(select(Availability).where(Availability.user_id == user.id))


def _hhmm(minute: int) -> str:
    return f"{minute // 60:02d}:{minute % 60:02d}"


def _minute(value: str, name: str) -> int:
    m = _HHMM.match(value.strip())
    if not m or (m.group(1) == "24" and m.group(2) != "00"):
        raise InvalidRequest(f"{name} must be a time like 09:00.")
    return int(m.group(1)) * 60 + int(m.group(2))


def _values(row: Availability | None) -> dict:
    if row is None:
        return dict(DEFAULTS)
    return {key: getattr(row, key) for key in DEFAULTS}


def _out(values: dict, is_default: bool) -> AvailabilityOut:
    return AvailabilityOut(
        timezone=values["timezone"],
        work_days=sorted(values["work_days"]),
        day_start=_hhmm(values["day_start_minute"]),
        day_end=_hhmm(values["day_end_minute"]),
        buffer_minutes=values["buffer_minutes"],
        min_notice_minutes=values["min_notice_minutes"],
        default_length_minutes=values["default_length_minutes"],
        is_default=is_default,
    )


def get(db: Session, user: User) -> AvailabilityOut:
    row = _row(db, user)
    return _out(_values(row), row is None)


def hours_of(db: Session, user: User) -> Hours:
    v = _values(_row(db, user))
    return Hours(
        timezone=v["timezone"],
        work_days=tuple(v["work_days"]),
        day_start_minute=v["day_start_minute"],
        day_end_minute=v["day_end_minute"],
        buffer_minutes=v["buffer_minutes"],
        min_notice_minutes=v["min_notice_minutes"],
    )


def update(
    db: Session,
    user: User,
    timezone: str | None = None,
    work_days: list[int] | None = None,
    day_start: str | None = None,
    day_end: str | None = None,
    buffer_minutes: int | None = None,
    min_notice_minutes: int | None = None,
    default_length_minutes: int | None = None,
) -> AvailabilityOut:
    """Change only the given fields. The first save turns the defaults into the user's own."""
    row = _row(db, user)
    v = _values(row)
    if timezone is not None:
        try:
            ZoneInfo(timezone.strip())
        except (ZoneInfoNotFoundError, ValueError):
            raise InvalidRequest("timezone must be an IANA name like Europe/Berlin.") from None
        v["timezone"] = timezone.strip()
    if work_days is not None:
        days = sorted(set(work_days))
        if not days or any(d < 0 or d > 6 for d in days):
            raise InvalidRequest("work_days must list weekdays 0 (Monday) to 6 (Sunday), at least one.")
        v["work_days"] = days
    if day_start is not None:
        v["day_start_minute"] = _minute(day_start, "day_start")
    if day_end is not None:
        v["day_end_minute"] = _minute(day_end, "day_end")
    if v["day_start_minute"] >= v["day_end_minute"]:
        raise InvalidRequest("day_start must be before day_end.")
    for key, value, low, high in (
        ("buffer_minutes", buffer_minutes, 0, MAX_BUFFER),
        ("min_notice_minutes", min_notice_minutes, 0, MAX_NOTICE),
        ("default_length_minutes", default_length_minutes, MIN_LENGTH, MAX_LENGTH),
    ):
        if value is not None:
            if not low <= value <= high:
                raise InvalidRequest(f"{key} must be between {low} and {high}.")
            v[key] = value

    if row is None:
        row = Availability(user_id=user.id, **v)
        db.add(row)
    else:
        for key, value in v.items():
            setattr(row, key, value)
    db.flush()
    return _out(v, False)
