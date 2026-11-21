# T29 · Connect Google Calendar

**Goal.** "Connect your calendar once" (C1). The user follows a link, approves Google, and Venn
can read their free/busy and create events.

## Read first

- `SCHEDULING.md` › Providers, Scopes, Data held
- `backend/app/invite_page.py` (a hosted page to copy), `backend/app/main.py` (routes)
- `backend/app/config.py`

## Do

1. `services/calendar/`: a `CalendarProvider` protocol (`auth_url`, `exchange`, `free_busy`,
   `create_event`, `cancel_event`, `revoke`), `GoogleCalendar` over `httpx`, `FakeCalendar`.
   `CALENDAR_PROVIDER` picks one; `fake` is the default.
2. Table `calendar_connections` (user, provider, account email, encrypted refresh token, busy
   calendar ids, connected at). Fernet key `CALENDAR_TOKEN_KEY`; refuse to start in production
   without it.
3. Routes `GET /calendar/connect?state=` (redirect to Google) and `GET /calendar/callback`
   (store the grant, show "Connected. Go back to your chat."). `state` is a signed, 10-minute
   token naming the user.
4. Scope `venn.calendar`. Tools `venn_calendar_status` (R: connected, account email, or a
   `connect_url`) and `venn_disconnect_calendar` (D: revoke, delete the row).
5. Tests use `FakeCalendar`. Docs: `MCP_TOOLS.md`, `DATA_MODEL.md`, `.env.example`.

## Done when

- [ ] Status for a new user returns a `connect_url`; after the callback, `connected: true`.
- [ ] The token column holds ciphertext, never the refresh token.
- [ ] A `state` for Alice cannot connect Bob's account; an expired `state` is refused.
- [ ] `make test && make lint` pass.

## Not in this task

Choosing calendars in a card (later). Microsoft (backlog).
