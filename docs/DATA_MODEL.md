# Venn data model

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
| `memory_proposals` | id*, user_id*, items* (JSON list of candidates), source* (`assistant`/`openai`/`heuristic`/`chatgpt_memory`), expires_at*, consumed_at, created_at* | Server-side record of what was shown to the user. 24h TTL, single use; `items` is emptied when the proposal is saved or discarded. Nothing in here is a saved memory. |
| `memories` | id*, user_id*, category*, title*, description*, tags* (JSON), visibility*, source (`chatgpt_memory` or null), approved_at*, created_at*, updated_at* | Only created from an approved proposal item. `source` marks memories imported from ChatGPT's memory. |

Categories: `INTEREST`, `DISLIKE`, `PREFERENCE`, `EXPERIENCE`, `WORK`, `PERSONAL_MEMORY`, `SOCIAL_GOAL`,
`RELATIONSHIP_CONTEXT`. Visibility: `PRIVATE` (default), `SHARED_WITH_CONNECTIONS`,
`PUBLIC_PROFILE`. `PRIVATE` memories are never read on behalf of another user.
Limits: 500 memories per user, 8 items per proposal (30 for an import from ChatGPT memory), title ≤ 120, description ≤ 500 chars, 8 tags.

## Social graph

| Table | Columns | Notes |
| --- | --- | --- |
| `invites` | id*, created_by_user_id*, code* (unique), note, max_uses*, use_count*, expires_at*, revoked_at, created_at* | Codes use an unambiguous alphabet, shown as `XXXX-XXXX`. Default 72h, 5 uses. |
| `connection_requests` | id*, sender_user_id*, recipient_user_id*, status* (`PENDING`/`ACCEPTED`/`REJECTED`), context_invite_id (FK set null), created_at*, responded_at | One pending request per pair. |
| `connections` | id*, user_a_id*, user_b_id*, created_at* | Canonical pair `user_a_id < user_b_id`, unique, check distinct. |
| `relationship_events` | id*, connection_id* (FK cascade), event_type* (`CONNECTED`/`INTERACTION`), event_data* (JSON), created_at* | Drives "last seen" and reconnection suggestions. |
| `blocks` | blocker_user_id*, blocked_user_id*, created_at* | Composite PK. Checked in both directions. |
| `abuse_reports` | id*, reporter_user_id*, reported_user_id*, reason*, created_at* | For moderation review. |

## People (friends who are not on Venn)

| Table | Columns | Notes |
| --- | --- | --- |
| `people` | id*, owner_user_id* (FK cascade), name*, relationship, notes, interests* (JSON list), created_at*, updated_at* | Private note written by the owner. Never shared, never linked to a Venn account, never used to contact the person. |
| `person_interactions` | id*, person_id* (FK cascade), activity, created_at* | Hangouts the owner logged; drives "last seen" and reconnection suggestions. |
| `people_imports` | id*, user_id* (FK cascade), items* (JSON list of candidates), source, expires_at*, consumed_at, created_at* | Server-side record of the people shown on an import card. 24h TTL, single use; items are cleared once used. Nobody in here is a saved note. |
| `follow_ups` | id*, owner_user_id* (FK cascade), connection_id (FK cascade), person_id (FK cascade), text*, done_at, created_at* | "Ask about this next time." Private to the owner. Exactly one of connection_id / person_id (check constraint). |

Limits: 500 people per user, 50 candidates per import, 20 open follow-ups per friend (≤ 200 chars), name/relationship ≤ 80, notes ≤ 1000, 12 interests of ≤ 40 chars.

## Plans, question links, samples

| Table | Columns | Notes |
| --- | --- | --- |
| `plans` | id*, owner_user_id* (FK cascade), title*, details, planned_for, done_at, created_at*, updated_at* | Something the user wants to do with friends. |
| `plan_members` | id*, plan_id* (FK cascade), connection_id (FK cascade), person_id (FK cascade) | Exactly one target per row. |
| `question_links` | id*, owner_user_id* (FK cascade), token* (unique), person_id (FK set null), for_name, max_responses*, response_count*, expires_at*, revoked_at, created_at* | A link a friend can answer without an account. |
| `question_responses` | id*, link_id* (FK cascade), owner_user_id* (FK cascade), name*, answers* (JSON), reviewed_at, created_at* | Waits for the owner's review; `answers` is emptied once saved or discarded. |

Also: `memories.people` (JSON list of names the memory is about), `people.is_sample`, and `memories.source = "sample"`
mark sample data. Sample friends are users with `auth_subject = "sample|<owner id>|<slug>"`.

## Consent & analytics

| Table | Columns | Notes |
| --- | --- | --- |
| `consents` | id*, user_id*, consent_type*, resource_id, granted_at*, revoked_at | `SHARE_MEMORIES_WITH_CONNECTIONS`, `PUBLIC_PROFILE`. |
| `analytics_events` | id*, event_type*, user_id (FK set null), session_id, event_metadata* (JSON), created_at* | Allow-listed event types and metadata keys (`count`, `source`, `category`). Never stores memory text, names or free text. |

Events: `profile_created`, `memory_proposed`, `memory_approved`, `memory_deleted`,
`invite_created`, `invitation_redeemed`, `connection_requested`, `connection_accepted`,
`activity_suggested`, `reconnection_suggested`, `person_added`, `people_imported`,
`people_searched`, `group_planned`, `meetup_brief`, `meetup_recapped`, `quiz_started`.
Search queries, import sources and quiz content are never recorded. Quiz scores are not stored anywhere.

## Site tables (not managed by Alembic)

The landing page (`site/`) creates two tables of its own on first use, in whatever database its
`DATABASE_URL` points at. They are not models here and `venn_delete_account` does not touch them.

| Table | Columns | Notes |
| --- | --- | --- |
| `waitlist_signups` | id*, email* (unique), utm_source, utm_content, ref, ref_code* (unique), created_at* | Waitlist emails. `ref` is the invite code the person arrived with; `ref_code` is their own. |
| `site_events` | id*, event*, visitor*, utm_source, utm_content, ref, created_at* | `page_view` and `core_action_completed`. `visitor` is a daily salted hash, never an IP. |

See `site/README.md` › Waitlist, Analytics.

## Development OAuth (dev mode only)

| Table | Columns |
| --- | --- |
| `dev_oauth_clients` | client_id*, client_info* (JSON), created_at* |
| `dev_oauth_codes` | code*, client_id*, data* (JSON), note, created_at* |

## Scheduling

| Table | Columns | Notes |
| --- | --- | --- |
| `availability` | id*, user_id* (FK cascade, unique), timezone*, work_days* (JSON, Monday = 0), day_start_minute*, day_end_minute*, buffer_minutes*, min_notice_minutes*, default_length_minutes*, created_at*, updated_at* | When the user takes meetings. Minutes are local wall-clock (0–1440). No row means the defaults. See `docs/tasks/SCHEDULING.md`. |
| `calendar_connections` | id*, user_id* (FK cascade, unique), provider*, account_email*, refresh_token_enc* (Fernet), calendar_ids* (JSON), created_at*, updated_at* | One calendar grant per user. Busy times and events are never stored. |

## Deletion

`venn_delete_account` deletes the user row; profile, memories, proposals, invites, requests,
connections (and their events), people notes (and their hangout logs), pending imports, follow-ups, plans, question links and their responses, availability, calendar connections, blocks and consents cascade; the account's sample friends are deleted with it. Analytics events keep no user link
(`user_id` set null).

## Migrations

```bash
make migrate                       # alembic upgrade head against $DATABASE_URL
make migration m="add something"   # autogenerate a new revision
```

Local SQLite databases are also auto-created on startup for convenience; Postgres schemas are
always managed by Alembic.
