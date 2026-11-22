# Waitlist: pairs

Decisions, rules, the API shape and the copy for group D. Written once here; T18 to T23 assume it.
Source: prototype screens the team shared on 2026-11-21, branded "kolo" (a placeholder name).

## Decisions

- The product is Venn. The circle colours, the `h1` and the light page stay as they are.
- One list, two versions. `pair`: a place is held until one person joins with your link, then
  both are confirmed. `open`: confirmed on joining, inviting is optional (today's behaviour).
- The version comes from `?w=pair` or `?w=open` in the page URL, else from `WAITLIST_VERSION`,
  which defaults to `pair`. It is stored on the signup so `/metrics` can compare the two.
- An invitation is the person's own link (`/?ref=<code>`), which they share themselves. Venn
  sends nothing. No names are collected, so an invitee is not told who invited them.
- Nobody is turned away: a pending signup is stored like any other.
- Everyone who joined before this change is `open` and confirmed.
- At launch a waitlist pair becomes a connection request in Venn, not a connection (T23).

## Rules

| Case | Result |
| --- | --- |
| Joins `open`, no link | Confirmed |
| Joins `pair`, no link | Pending until the first person joins with their link |
| Joins with a link that has room | Confirmed, whatever the version. A pending inviter is confirmed too |
| Joins with an unknown or full link | Treated as no link. `ref` is still stored for attribution |
| Joins twice | The same spot comes back. Nothing changes |

A link has room for 4 people if its owner joined without a link (the +1 and three more), and
for 3 if its owner was invited. Either way a circle is at most 5 people.

## Shape

`POST /api/waitlist` takes `{ email, version?, utm_source?, utm_content?, ref? }`. It and
`GET /api/waitlist?code=` answer with today's three fields plus four:

```json
{ "position": 104, "refCode": "k3m9x2pq", "referrals": 1,
  "status": "confirmed", "version": "pair", "circle": 2, "invitesLeft": 3 }
```

`status` is `pending` or `confirmed`. `circle` counts the person, their inviter if any, and the
people attached to their link. `position` and `referrals` keep today's meaning.

Whether a `?ref=` link exists and has room is looked up by the page itself before it is sent
(`site/app/page.tsx` › `inviteState`), so there is no endpoint for it and no flash of the
wrong form.

## Copy

The hero heading is "Connect your AI memories." Everything follows the Copy rules in
`.agents/skills/venn-site-design/SKILL.md`.

| Where | Text |
| --- | --- |
| Hero subtitle | Build your inner circle. |
| Signup button | Build your inner circle |
| Form note, `pair` | You join with one person you know. We only email you about your invite. |
| Form note, `open` | Founding Circle. We only email you about your invite. (unchanged) |
| Pending, lead | Good things come in pairs. |
| Pending, text | Your place is held. It is confirmed when one person you know joins with your link. |
| Pending, note | One link. A confirmed place for both of you. |
| Confirmed, lead | You're both in. |
| Confirmed, text | Your places in the Founding Circle are confirmed. |
| Confirmed, note | 2 in your circle. 3 invites left. / 5 in your circle. Your circle is full for now. |
| Invitee, lead | Someone saved you a place. |
| Invitee, text | Joining confirms a place for both of you. |
| Invitee, button | Accept the invite |
| Invitee, note | No +1 needed. We only email you about your invite. |
| Full or unknown link | That invite link is no longer open. You can still join. |
| Primary button, pending and confirmed | Share my invite link |
| Onboarding link | See how it works |
| After copying | Invite link copied. Send it to one person you'd like on Venn. ("someone" once confirmed) |
| Share text | I saved you a place on the Venn waitlist. |

The `open` version keeps "You're #104 in the Founding Circle." and "Invite a connection to move up". The note beneath these actions appears when someone has joined with the link or when sharing gives feedback.

## Words from the prototype that are not used

| Prototype | Why not | Instead |
| --- | --- | --- |
| Connect your AI with the AIs of your professional network | The AIs do not talk to each other. Venn shows two connected people what each approved | The onboarding preview |
| Your next opportunity is someone you already know | Replaced by the current subtitle | Build your inner circle. |
| Private beta · invitation only | Anyone can join without a link | The form notes above |
| Share private invitation, Gift another invitation | A link can be forwarded, and it is one link, not several | Share my invite link |
| Your early access is secured | No access date exists to promise | Your places in the Founding Circle are confirmed. |
| Alex has invited you, Someone wants you in their world | No name is collected | Someone saved you a place. |
| Invite a founder, professional network | Venn is also for friends | someone you know, people you already know |
