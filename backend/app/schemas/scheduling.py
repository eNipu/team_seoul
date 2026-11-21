"""Shapes for scheduling. Written once in docs/tasks/SCHEDULING.md › Shapes."""

from __future__ import annotations

from pydantic import BaseModel


class AvailabilityOut(BaseModel):
    timezone: str
    work_days: list[int]  # Monday = 0
    day_start: str  # "HH:MM", local
    day_end: str  # "HH:MM", local; "24:00" is midnight at the end of the day
    buffer_minutes: int
    min_notice_minutes: int
    default_length_minutes: int
    is_default: bool
