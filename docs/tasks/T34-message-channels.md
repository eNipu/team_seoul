# T34 · Link email, Telegram or WhatsApp

**Goal.** The user links the places Venn may reach them, and proves each one is theirs.

## Read first

- `SCHEDULING.md` › Providers, Scopes, Data held
- `backend/app/main.py` (routes), `backend/app/config.py`

## Do

1. Table `message_channels`: user, kind (`email` | `telegram` | `whatsapp`), address, verified
   at, preferred, hashed link code, code expiry. Migration.
2. Scope `venn.messages`. Tools: `venn_list_channels` (R), `venn_link_channel(kind, email?)` (W)
   returns a code-entry prompt for email, a `t.me` link for Telegram, a `wa.me` link for WhatsApp;
   `venn_verify_channel(kind, code)` (W) for email; `venn_set_preferred_channel` (W);
   `venn_unlink_channel` (D).
3. Webhooks `POST /hooks/telegram` and `POST /hooks/whatsapp`: check the secret first, then bind
   `/start <code>` or the code text to the code's owner. Unknown codes get a fixed reply.
4. Only verified channels are ever used. Codes: single use, 15 minutes, 5 tries.
5. Shape of the channel list into `CONTRACTS.md`. Docs: `MCP_TOOLS.md`, `DATA_MODEL.md`.

## Done when

- [ ] A Telegram update with Alice's code verifies Alice's channel; a wrong secret is a 401.
- [ ] A used or expired code does nothing.
- [ ] Bob cannot see or unlink Alice's channels.
- [ ] `make test && make lint` pass.

## Not in this task

Sending (T35). Channels card (later; data tool is enough to start).
