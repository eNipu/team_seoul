# T35 · Senders and the outbox

**Goal.** One way to send a fixed message to a user's verified channel, with the real provider
or a fake, logged and rate-limited.

## Read first

- `SCHEDULING.md` › Providers, Limits, Data held
- `backend/app/models/` (T34's `message_channels`)

## Do

1. `services/messaging/`: `Sender` protocol `send(address, template, params) -> provider_id`.
   `FakeSender` (records), `SmtpEmailSender` (`smtplib`), `TelegramSender`, `WhatsAppSender`
   (template messages outside the 24-hour window). Picked from config; fake when unset.
2. Templates are fixed strings in code (`meeting_requested`, `meeting_booked`,
   `meeting_cancelled`, `channel_code`). Params are length-capped plain text.
3. Table `outbound_messages`: recipient, channel, template, status, provider id, attempts. The
   rendered text is not stored.
4. `notify(db, recipient_user, template, params)`: preferred verified channel, else none. 30 per
   user per day. Failures are recorded, never raised into the tool call.
5. Analytics: `message_sent` with `count` and `source` (the channel kind) only.

## Done when

- [ ] With no channel, `notify` records nothing and returns `False`.
- [ ] The 31st message in a day is not sent.
- [ ] A provider error leaves a `failed` row and the tool still succeeds.
- [ ] `make test && make lint` pass.

## Not in this task

Free-form messages the model writes. Only the fixed templates are sent.
