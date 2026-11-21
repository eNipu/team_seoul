from __future__ import annotations

from sqlalchemy import func, select

from app.models import Availability


def test_new_user_gets_defaults(alice):
    result = alice.ok("venn_get_availability")
    assert result == {
        "timezone": "UTC",
        "work_days": [0, 1, 2, 3, 4],
        "day_start": "09:00",
        "day_end": "17:00",
        "buffer_minutes": 10,
        "min_notice_minutes": 240,
        "default_length_minutes": 30,
        "is_default": True,
    }


def test_partial_update_keeps_the_rest(alice):
    saved = alice.ok("venn_set_availability", timezone="Europe/Berlin", day_start="10:00")
    assert saved["timezone"] == "Europe/Berlin"
    assert saved["day_start"] == "10:00"
    assert saved["day_end"] == "17:00"
    assert saved["is_default"] is False

    again = alice.ok("venn_set_availability", work_days=[4, 0, 0], default_length_minutes=45)
    assert again["timezone"] == "Europe/Berlin"
    assert again["work_days"] == [0, 4]
    assert alice.ok("venn_get_availability") == again


def test_day_can_end_at_midnight(alice):
    assert alice.ok("venn_set_availability", day_start="18:00", day_end="24:00")["day_end"] == "24:00"


def test_invalid_values_are_refused(alice):
    assert alice.err("venn_set_availability", timezone="Mars/Olympus").startswith("INVALID_REQUEST")
    assert alice.err("venn_set_availability", day_start="18:00", day_end="09:00").startswith("INVALID_REQUEST")
    assert alice.err("venn_set_availability", day_start="9am").startswith("INVALID_REQUEST")
    assert alice.err("venn_set_availability", day_end="24:30").startswith("INVALID_REQUEST")
    assert alice.err("venn_set_availability", work_days=[]).startswith("INVALID_REQUEST")
    assert alice.ok("venn_get_availability")["is_default"] is True


def test_deleting_the_account_deletes_availability(alice, db):
    alice.ok("venn_set_availability", timezone="Asia/Seoul")
    alice.ok("venn_delete_account", confirmation="DELETE MY VENN ACCOUNT")
    assert db.scalar(select(func.count()).select_from(Availability)) == 0
