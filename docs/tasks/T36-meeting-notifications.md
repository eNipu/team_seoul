# T36 · Tell people about their meetings

**Goal.** When a meeting is proposed, booked, declined or cancelled, the other person hears about
it on their channel, not only the next time they open ChatGPT.

## Read first

- `SCHEDULING.md` › Rules
- `backend/app/services/meeting_service.py`, `services/messaging/`

## Do

1. Call `notify` after commit at: proposed (to counterparty, with the times in their zone and the
   reply options `1`–`3` or `no`), booked (both), declined and expired (organiser), cancelled
   (the other side).
2. Names in messages are display names, capped at 40 characters.
3. A user can mute meeting messages: `venn_set_preferred_channel(kind="none")`.

## Done when

- [ ] Proposing with Bob's Telegram linked records one `meeting_requested` for Bob.
- [ ] A rolled-back propose sends nothing.
- [ ] `make test && make lint` pass.

## Not in this task

Acting on replies (T37).
