# Heldly data model

SQLAlchemy 2 models in `backend/app/models/`, migrations in `backend/migrations/` (Alembic).
Postgres (Supabase) in production; SQLite for local development and tests. Ids are UUIDs,
timestamps are timezone-aware UTC, JSON columns are `JSONB` on Postgres.
`*` = NOT NULL.

## Identity

| Table | Columns | Notes |
| --- | --- | --- |
| `users` | id*, auth_subject* (unique), display_name, created_at*, updated_at* | `auth_subject = "<issuer>\|<sub>"` from the verified token. Created on first tool call. |
| `user_profiles` | id*, user_id* (unique, FK cascade), bio, social_goals* (JSON list), visibility* (`PRIVATE`/`CONNECTIONS`/`PUBLIC`), created_at*, updated_at* | Social goals: `make_friends`, `maintain_friendships`, `deepen_relationships`, `find_activity_partners`, `reconnect`, `meet_people_with_shared_interests`. |

## Memories

| Table | Columns | Notes |
| --- | --- | --- |
| `memory_proposals` | id*, user_id*, items* (JSON list of candidates), source* (`model`/`openai`/`heuristic`/mixed), expires_at*, consumed_at, created_at* | Server-side record of what was shown to the user. 24h TTL, single use. Nothing in here is a saved memory. |
| `memories` | id*, user_id*, category*, title*, description*, tags* (JSON), visibility*, approved_at*, created_at*, updated_at* | Only created from an approved proposal item. |

Categories: `INTEREST`, `DISLIKE`, `PREFERENCE`, `EXPERIENCE`, `PERSONAL_MEMORY`, `SOCIAL_GOAL`,
`RELATIONSHIP_CONTEXT`. Visibility: `PRIVATE` (default), `SHARED_WITH_CONNECTIONS`,
`PUBLIC_PROFILE`. `PRIVATE` memories are never read on behalf of another user.
Limits: 500 memories per user, 8 items per proposal, title ≤ 120, description ≤ 500 chars, 8 tags.

## Social graph

| Table | Columns | Notes |
| --- | --- | --- |
| `invites` | id*, created_by_user_id*, code* (unique), note, max_uses*, use_count*, expires_at*, revoked_at, created_at* | Codes use an unambiguous alphabet, shown as `XXXX-XXXX`. Default 72h, 5 uses. |
| `connection_requests` | id*, sender_user_id*, recipient_user_id*, status* (`PENDING`/`ACCEPTED`/`REJECTED`), context_invite_id (FK set null), created_at*, responded_at | One pending request per pair. |
| `connections` | id*, user_a_id*, user_b_id*, created_at* | Canonical pair `user_a_id < user_b_id`, unique, check distinct. |
| `relationship_events` | id*, connection_id* (FK cascade), event_type* (`CONNECTED`/`INTERACTION`), event_data* (JSON), created_at* | Drives "last seen" and reconnection suggestions. |
| `blocks` | blocker_user_id*, blocked_user_id*, created_at* | Composite PK. Checked in both directions. |
| `abuse_reports` | id*, reporter_user_id*, reported_user_id*, reason*, created_at* | For moderation review. |

## People (friends who are not on Heldly)

| Table | Columns | Notes |
|---|---|---|
| `people` | id*, owner_user_id* (FK cascade), name*, relationship, notes, interests* (JSON list), created_at*, updated_at* | Private note written by the owner. Never shared, never linked to a Heldly account, never used to contact the person. |
| `person_interactions` | id*, person_id* (FK cascade), activity, created_at* | Hangouts the owner logged; drives "last seen" and reconnection suggestions. |

Limits: 200 people per user, name/relationship ≤ 80, notes ≤ 1000, 12 interests of ≤ 40 chars.

## Consent & analytics

| Table | Columns | Notes |
| --- | --- | --- |
| `consents` | id*, user_id*, consent_type*, resource_id, granted_at*, revoked_at | `SHARE_MEMORIES_WITH_CONNECTIONS`, `PUBLIC_PROFILE`. |
| `analytics_events` | id*, event_type*, user_id (FK set null), session_id, event_metadata* (JSON), created_at* | Allow-listed event types and metadata keys (`count`, `source`, `category`). Never stores memory text, names or free text. |

Events: `profile_created`, `memory_proposed`, `memory_approved`, `memory_deleted`,
`invite_created`, `invitation_redeemed`, `connection_requested`, `connection_accepted`,
`activity_suggested`, `reconnection_suggested`, `person_added`.

## Development OAuth (dev mode only)

| Table | Columns |
| --- | --- |
| `dev_oauth_clients` | client_id*, client_info* (JSON), created_at* |
| `dev_oauth_codes` | code*, client_id*, data* (JSON), note, created_at* |

## Deletion

`heldly_delete_account` deletes the user row; profile, memories, proposals, invites, requests,
connections (and their events), people notes (and their hangout logs), blocks and consents cascade. Analytics events keep no user link
(`user_id` set null).

## Migrations

```bash
make migrate                       # alembic upgrade head against $DATABASE_URL
make migration m="add something"   # autogenerate a new revision
```

Local SQLite databases are also auto-created on startup for convenience; Postgres schemas are
always managed by Alembic.
