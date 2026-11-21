# T32 · Book on the calendar, cancel

**Goal.** On acceptance the meeting lands on both calendars with a Google Meet link, exactly
once (C5); either side can cancel (C6).

## Read first

- `SCHEDULING.md` › Rules
- `Venn PRD.md` §7.2
- `backend/app/services/meeting_service.py`, `services/calendar/`

## Do

1. `book(db, request, slot)`: re-check free/busy for both; if the slot is gone, set the request back
   to `picking` with fresh slots and say so. Otherwise create the event on the organiser's
   calendar, the counterparty as attendee, with `conferenceData` for Meet.
2. Idempotency key per request, so a retry never makes a second event. Store the provider event id
   and the Meet link on the request; status `booked`.
3. Log an interaction for both users (`relationship_service.log_interaction`).
4. `venn_cancel_meeting(request_id)` (D): either party; cancels the provider event; status
   `cancelled`.
5. Provider failure: status `failed`, both sides see it in `venn_list_meeting_requests`.

## Done when

- [ ] Accepting twice creates one event.
- [ ] A slot that became busy between propose and accept returns new slots, not a booking.
- [ ] Cancel removes the fake event and either party can do it; Carol cannot.
- [ ] `make test && make lint` pass.

## Not in this task

Rescheduling as one step (cancel then find times again is enough for now).
