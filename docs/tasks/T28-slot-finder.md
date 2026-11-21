# T28 · Find free slots for two people

**Goal.** A pure function that, given each person's availability and busy blocks, returns the
best few times both are free (PRD §7.1). No database, no network, no language model.

## Read first

- `SCHEDULING.md` › Times
- `Venn PRD.md` §7.1

## Do

1. `backend/app/services/slots.py`: `find_slots(participants, window_start, window_end,
   length_minutes, now, limit=3) -> list[Slot]`. A participant is its availability plus a list of
   busy `(start, end)` in UTC.
2. For each participant, build free intervals per local date from working hours, then subtract
   busy blocks padded by the buffer, and everything before `now + min_notice`.
3. Intersect the participants, cut into slots on 15-minute boundaries.
4. Rank: earlier first, at most one slot per day until every day has one, then fill.
5. Unit tests in `tests/unit/test_slots.py`, including a daylight-saving change.

## Done when

- [ ] Berlin 09–17 and New York 09–17 on the same weekday give slots between 15:00 and 17:00
      Berlin time only.
- [ ] A busy block 10:00–11:00 with a 10-minute buffer blocks 09:50–11:10.
- [ ] Working hours on the Sunday clocks change in Europe still map to 09:00 local.
- [ ] Three slots on three different days when three days are free.
- [ ] `make test && make lint` pass.

## Not in this task

Reading calendars (T29). Holding slots (T30).
