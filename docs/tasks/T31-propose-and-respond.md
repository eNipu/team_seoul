# T31 · Propose times, accept or decline, standing rules

**Goal.** The organiser proposes picked slots; the counterparty accepts one or declines (C4).
A standing rule lets a connection book without asking (C7).

## Read first

- `SCHEDULING.md` › Decisions, Rules
- `backend/app/services/meeting_service.py` (T30)
- `backend/app/services/social_service.py` › connection requests (a two-party flow to copy)

## Do

1. `venn_propose_meeting(request_id, slot_ids)` (D): only the organiser, only from `picking`,
   1–3 slots, 20 per day. Status `proposed`, expires in 72 hours.
2. `venn_list_meeting_requests` (R): incoming and outgoing open requests, data only.
3. `venn_respond_to_meeting(request_id, slot_id | decline)` (D): only the counterparty. Accept
   hands off to booking (T32).
4. Table `booking_rules` (owner, connection, auto_book). `venn_set_booking_rule(connection_id,
   auto_book)` (W). On propose, if the counterparty's rule allows it, book the first slot directly.
5. Expiry is checked on read; no worker needed.

## Done when

- [ ] Bob sees Alice's proposal; Alice cannot respond to her own; Carol gets `NOT_FOUND`.
- [ ] With Bob's rule on for Alice, proposing books at once and says so.
- [ ] A 73-hour-old proposal shows as `expired` and cannot be accepted.
- [ ] `make test && make lint` pass.

## Not in this task

Calendar events (T32). Notifications (T36).
