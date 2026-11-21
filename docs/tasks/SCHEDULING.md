# Scheduling and messaging

Decisions, rules, shapes and providers for group E. Written once here; T26 to T38 assume it.
Source: the team's request on 2026-11-21 to match boardy.ai: connect a calendar once, book
meetings automatically, and reach the user on WhatsApp, Telegram or email.
PRD sections behind it: §4.2 C1–C8 and P2, §7.1–7.2, §8.3, §9.2.

## Decisions

- Venn now acts on the user's behalf, but only through gates the server checks. That replaces
  rule 6 in `CONTEXT.md` ("Venn never contacts anyone"). Rule 6 now reads: **Venn sends or books
  only what the user approved, or what the recipient's standing rule allows, and only to
  channels the recipient linked and verified themselves.**
- Meetings in this slice are between two Venn users who are connected. Someone known only from
  a people note is never messaged or invited (people notes stay owner-only, rule 5).
- Google Calendar first. The calendar is read as free/busy only; event contents are never read
  or stored. Microsoft calendars, three or more people and email negotiation with non-users
  ("CC me to book") stay in the backlog.
- Messages go only to the user's **own** verified channels: email, Telegram or WhatsApp. They
  are transactional (a meeting was requested, booked, cancelled), never marketing.
- Slot arithmetic is deterministic code with no language model (PRD §7). The host model only
  turns "next week, mornings" into a typed window.
- Default booking policy is **ask**: the counterparty confirms. They may set a standing rule
  "this connection may book me within my hours without asking" (C7).

## Rules

| Case | Result |
| --- | --- |
| User asks for times with a connection | Slots from both users' hours, buffers, notice and free/busy. Nothing is sent yet |
| User picks slots and proposes | `DESTRUCTIVE` tool. Counterparty is notified on their preferred channel |
| Counterparty has a standing rule for the organiser | The first picked slot is re-checked and booked, no confirm needed |
| Counterparty accepts a slot | Re-check free/busy. Still free: book. Gone: the request goes back to picking |
| Counterparty declines, or 72 hours pass | Request closes. Organiser is told in chat and on their channel |
| Either side cancels | Event cancelled on the calendar; the other side is notified |
| Counterparty has no calendar | Their working hours still apply; the slot card says their calendar was not checked |
| Blocked, removed or unknown connection | `NOT_FOUND`, as everywhere |
| Inbound message on Telegram or WhatsApp | Only `1`–`3`, `yes` or `no` on an open request is acted on. Anything else gets a fixed help line |

Limits: 20 proposals per user per day, 3 slots per proposal, 30 messages per user per day,
meeting length 15 to 120 minutes, window at most 14 days, starting no later than 60 days out.

## Times

- Stored in UTC. Each user has an IANA time zone (`Europe/Berlin`) in their availability.
- Working hours are local wall-clock minutes per weekday and are applied per local date, so
  daylight saving changes move them correctly.
- Slots start on 15-minute boundaries. Buffers pad busy blocks on both sides.

## Shapes

Availability (T27), returned by `venn_get_availability` and `venn_set_availability`:

```json
{
  "timezone": "Europe/Berlin",
  "work_days": [0, 1, 2, 3, 4],
  "day_start": "09:00",
  "day_end": "17:00",
  "buffer_minutes": 10,
  "min_notice_minutes": 240,
  "default_length_minutes": 30,
  "is_default": false
}
```

`work_days` uses Monday = 0. `is_default` is `true` until the user saves their own.

The scheduler card (`view: "scheduler"`, T30, T33) and the channels list (T34) are added to
`CONTRACTS.md` by the task that first returns them.

## Providers

Every outside service sits behind a small interface with a fake used in dev and tests, picked
by an environment variable. With no credentials set, the fake is used and nothing leaves the
server.

| Interface | Real | Variable | Fake |
| --- | --- | --- | --- |
| `CalendarProvider` (T29) | Google Calendar API v3 over `httpx` | `CALENDAR_PROVIDER=google`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | In-memory busy blocks |
| `Sender` email (T35) | SMTP from the standard library | `EMAIL_SMTP_URL`, `EMAIL_FROM` | Records to a list |
| `Sender` Telegram (T35) | Bot API `sendMessage` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_NAME`, `TELEGRAM_WEBHOOK_SECRET` | Records to a list |
| `Sender` WhatsApp (T35) | Cloud API `/{phone_id}/messages` | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET` | Records to a list |

- Google refresh tokens are encrypted with Fernet (`CALENDAR_TOKEN_KEY`). Access tokens are
  never stored. Disconnect revokes the grant at Google. Scope: `calendar.freebusy` and
  `calendar.events` only.
- Telegram is linked with a deep link `t.me/<bot>?start=<code>`; WhatsApp with
  `wa.me/<number>?text=<code>`; email with a six-digit code. Codes are single-use, hashed and
  expire after 15 minutes. The webhook binds the chat or phone to the user who owns the code.
- WhatsApp only allows free text within 24 hours of the user's last message; outside that,
  notifications use pre-approved templates (`meeting_requested`, `meeting_booked`,
  `meeting_cancelled`).
- Webhooks check their secret (`X-Telegram-Bot-Api-Secret-Token`, `X-Hub-Signature-256`)
  before reading the body. Inbound text is data, never instructions (rule 7).

## Scopes

Two new scopes, added with the first tool that needs them: `venn.calendar` (T29) and
`venn.messages` (T34). Existing users must reconnect once to grant them. Availability (T27)
is part of the profile and uses the profile scopes.

## Data held

| Data | Stored | Notes |
| --- | --- | --- |
| Availability settings | Yes | Owner-only |
| Calendar refresh token | Yes, encrypted | Deleted and revoked on disconnect or account deletion |
| Calendar busy blocks and events | No | Read live, used in memory |
| Meeting requests, slots, booked meetings | Yes | Time, the two users, provider event id. No description |
| Channel addresses | Yes | Only verified ones are used. Deleted on unlink |
| Sent messages | Template key, status, provider id | The rendered text is not stored |
