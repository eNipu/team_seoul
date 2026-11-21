"""Find times two (or more) people are all free. Pure functions: no database, no network.

Working hours are local wall-clock times, applied per local date, so daylight-saving changes
move them correctly. Everything else is UTC. See docs/tasks/SCHEDULING.md › Times.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

STEP_MINUTES = 15

Interval = tuple[datetime, datetime]


@dataclass(frozen=True)
class Hours:
    timezone: str
    work_days: tuple[int, ...]  # Monday = 0
    day_start_minute: int
    day_end_minute: int  # up to 1440 (midnight at the end of the day)
    buffer_minutes: int = 0
    min_notice_minutes: int = 0


@dataclass(frozen=True)
class Participant:
    hours: Hours
    busy: Sequence[Interval] = field(default_factory=tuple)


@dataclass(frozen=True)
class Slot:
    start: datetime
    end: datetime


def _local(d: date, minute: int, tz: ZoneInfo) -> datetime:
    if minute >= 24 * 60:
        return datetime.combine(d + timedelta(days=1), time(0), tzinfo=tz)
    return datetime.combine(d, time(minute // 60, minute % 60), tzinfo=tz)


def _working(hours: Hours, start: datetime, end: datetime) -> list[Interval]:
    tz = ZoneInfo(hours.timezone)
    out: list[Interval] = []
    day = start.astimezone(tz).date() - timedelta(days=1)
    last = end.astimezone(tz).date() + timedelta(days=1)
    while day <= last:
        if day.weekday() in hours.work_days:
            a = _local(day, hours.day_start_minute, tz).astimezone(UTC)
            b = _local(day, hours.day_end_minute, tz).astimezone(UTC)
            if a < b:
                out.append((a, b))
        day += timedelta(days=1)
    return out


def _clip(intervals: list[Interval], start: datetime, end: datetime) -> list[Interval]:
    return [(max(a, start), min(b, end)) for a, b in intervals if min(b, end) > max(a, start)]


def _subtract(free: list[Interval], busy: list[Interval]) -> list[Interval]:
    out = free
    for ba, bb in busy:
        nxt: list[Interval] = []
        for a, b in out:
            if bb <= a or ba >= b:
                nxt.append((a, b))
                continue
            if ba > a:
                nxt.append((a, ba))
            if bb < b:
                nxt.append((bb, b))
        out = nxt
    return out


def _intersect(x: list[Interval], y: list[Interval]) -> list[Interval]:
    out: list[Interval] = []
    i = j = 0
    x, y = sorted(x), sorted(y)
    while i < len(x) and j < len(y):
        a, b = max(x[i][0], y[j][0]), min(x[i][1], y[j][1])
        if a < b:
            out.append((a, b))
        if x[i][1] < y[j][1]:
            i += 1
        else:
            j += 1
    return out


def free_intervals(p: Participant, start: datetime, end: datetime, now: datetime) -> list[Interval]:
    """When `p` could meet inside [start, end): working hours, minus padded busy, after notice."""
    earliest = max(start, now + timedelta(minutes=p.hours.min_notice_minutes))
    if earliest >= end:
        return []
    pad = timedelta(minutes=p.hours.buffer_minutes)
    busy = [(a.astimezone(UTC) - pad, b.astimezone(UTC) + pad) for a, b in p.busy]
    return _subtract(_clip(_working(p.hours, start, end), earliest, end), busy)


def _ceil_step(dt: datetime) -> datetime:
    floor = dt.replace(second=0, microsecond=0, minute=dt.minute - dt.minute % STEP_MINUTES)
    return floor if floor == dt else floor + timedelta(minutes=STEP_MINUTES)


def find_slots(
    participants: Sequence[Participant],
    window_start: datetime,
    window_end: datetime,
    length_minutes: int,
    now: datetime,
    limit: int = 3,
) -> list[Slot]:
    """The best `limit` slots everyone is free for, earliest first and spread across days.

    Days are counted in the first participant's (the organiser's) time zone.
    """
    if not participants or length_minutes <= 0 or limit <= 0:
        return []
    start, end, now = window_start.astimezone(UTC), window_end.astimezone(UTC), now.astimezone(UTC)
    common = free_intervals(participants[0], start, end, now)
    for p in participants[1:]:
        common = _intersect(common, free_intervals(p, start, end, now))

    length = timedelta(minutes=length_minutes)
    step = timedelta(minutes=STEP_MINUTES)
    candidates: list[Slot] = []
    for a, b in sorted(common):
        t = _ceil_step(a)
        while t + length <= b:
            candidates.append(Slot(t, t + length))
            t += step

    tz = ZoneInfo(participants[0].hours.timezone)
    chosen: list[Slot] = []
    seen_days: set[date] = set()
    for slot in candidates:  # one per day first
        day = slot.start.astimezone(tz).date()
        if day not in seen_days and len(chosen) < limit:
            seen_days.add(day)
            chosen.append(slot)
    for slot in candidates:  # then fill without overlaps
        if len(chosen) >= limit:
            break
        if all(slot.end <= c.start or slot.start >= c.end for c in chosen):
            chosen.append(slot)
    return sorted(chosen, key=lambda s: s.start)
