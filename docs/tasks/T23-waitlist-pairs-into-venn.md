# T23 · Carry waitlist pairs into Venn

**Goal.** When two people who joined the waitlist together both use Venn, each finds the other
waiting as a connection request, so nobody starts with an empty circle.

**Needs a decision first.**

- Venn has no email for its users: `backend/app/models/` stores none and `AUTH_MODE=dev` signs
  people in by username. Matching a waitlist row to a user needs a verified email from the
  identity provider (`README.md` › Production, step 1). Until then this task cannot start.
- How the backend learns the pairs: read `waitlist_signups` in the shared Postgres, or have
  the site export pairs once at launch. The first couples two schemas that are separate today.
- Whether a waitlist email may be kept for this. T17 has to say so in the privacy policy.

## Read first

- `WAITLIST.md` › Decisions, Rules
- `docs/tasks/CONTEXT.md` › rules 1, 4, 6 and 9
- `backend/app/services/social_service.py` (invite codes, requests, `is_blocked`)
- `backend/app/auth/context.py`, `backend/app/auth/jwt_verifier.py`
- `docs/DATA_MODEL.md` › connections

## Do

1. On a user's first sign-in with a verified email, find the waitlist rows attached to theirs
   in either direction.
2. For each one whose owner is already a Venn user, create a connection request from the
   invitee to the inviter, the same as redeeming an invite code. Skip blocked pairs and pairs
   that are already connected or already have a request.
3. The request appears on the home card like any other. Nothing is accepted automatically.
4. Run it once per user and record that it ran.
5. Tests: both orders of arrival, a blocked pair, a second sign-in, an unverified email.
6. Update `docs/DATA_MODEL.md` and `docs/SECURITY.md`.

## Done when

- [ ] Alice and Bob joined as a pair; after both sign in, Alice has one request from Bob.
- [ ] No tool takes an email, and no email reaches a tool result or analytics.
- [ ] `make test && make lint` pass.

## Not in this task

An identity provider. Email of any kind. Connecting people without a request.
