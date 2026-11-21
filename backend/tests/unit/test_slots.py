from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from app.services.slots import Hours, Participant, find_slots, free_intervals

BERLIN = ZoneInfo("Europe/Berlin")
WEEKDAYS = (0, 1, 2, 3, 4)


def hours(tz: str = "UTC", days=WEEKDAYS, start: int = 9 * 60, end: int = 17 * 60, buffer: int = 0, notice: int = 0):
    return Hours(tz, tuple(days), start, end, buffer, notice)


def utc(*args) -> datetime:
    return datetime(*args, tzinfo=UTC)


# Monday 23 Nov 2026: Berlin is UTC+1, New York UTC-5.
MON = utc(2026, 11, 23)
NOW = utc(2026, 11, 22)


def test_berlin_and_new_york_overlap_only_in_the_berlin_afternoon():
    alice = Participant(hours("Europe/Berlin"))
    bob = Participant(hours("America/New_York"))
    slots = find_slots([alice, bob], MON, MON + timedelta(days=1), 30, NOW, limit=20)
    assert slots
    for s in slots:
        local = s.start.astimezone(BERLIN)
        assert local.hour >= 15
        assert s.end.astimezone(BERLIN) <= local.replace(hour=17, minute=0)
    assert slots[0].start.astimezone(BERLIN).hour == 15


def test_busy_block_is_padded_by_the_buffer():
    p = Participant(hours(buffer=10), busy=[(utc(2026, 11, 23, 10), utc(2026, 11, 23, 11))])
    free = free_intervals(p, MON, MON + timedelta(days=1), NOW)
    assert free == [
        (utc(2026, 11, 23, 9), utc(2026, 11, 23, 9, 50)),
        (utc(2026, 11, 23, 11, 10), utc(2026, 11, 23, 17)),
    ]


def test_minimum_notice_hides_the_next_hours():
    p = Participant(hours(notice=240))
    now = utc(2026, 11, 23, 9, 7)
    slots = find_slots([p], MON, MON + timedelta(days=1), 30, now, limit=1)
    assert slots[0].start == utc(2026, 11, 23, 13, 15)


def test_working_hours_follow_the_clock_change():
    # Clocks go back in Europe on Sunday 25 Oct 2026 at 03:00.
    p = Participant(hours("Europe/Berlin", days=range(7)))
    sat = free_intervals(p, utc(2026, 10, 24), utc(2026, 10, 25), utc(2026, 10, 1))
    sun = free_intervals(p, utc(2026, 10, 25), utc(2026, 10, 26), utc(2026, 10, 1))
    assert sat[0][0] == utc(2026, 10, 24, 7)
    assert sun[0][0] == utc(2026, 10, 25, 8)
    assert sun[0][0].astimezone(BERLIN).hour == 9


def test_slots_are_spread_across_days():
    p = Participant(hours())
    slots = find_slots([p], MON, MON + timedelta(days=3), 30, NOW)
    assert [s.start for s in slots] == [utc(2026, 11, 23, 9), utc(2026, 11, 24, 9), utc(2026, 11, 25, 9)]


def test_fills_one_day_without_overlaps():
    p = Participant(hours())
    slots = find_slots([p], MON, MON + timedelta(days=1), 60, NOW)
    assert len(slots) == 3
    for a, b in zip(slots, slots[1:], strict=False):
        assert a.end <= b.start


def test_weekend_and_fully_busy_give_nothing():
    weekend = utc(2026, 11, 28)
    assert find_slots([Participant(hours())], weekend, weekend + timedelta(days=2), 30, NOW) == []
    busy = Participant(hours(), busy=[(MON, MON + timedelta(days=1))])
    assert find_slots([busy], MON, MON + timedelta(days=1), 30, NOW) == []


def test_slots_start_on_quarter_hours():
    p = Participant(hours(), busy=[(utc(2026, 11, 23, 9), utc(2026, 11, 23, 9, 7))])
    slots = find_slots([p], MON, MON + timedelta(days=1), 30, NOW, limit=1)
    assert slots[0].start == utc(2026, 11, 23, 9, 15)
