import { Pool, type QueryResultRow } from "pg";

// One pool per server process. Kept on globalThis so dev hot reloads reuse it.
const globals = globalThis as typeof globalThis & {
  __vennPool?: Pool;
  __vennSchema?: Promise<void>;
};

// Table names are prefixed for the site: this database may be the same one the
// MCP backend uses, which already has an `analytics_events` table of its own.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  utm_source TEXT,
  utm_content TEXT,
  ref TEXT,
  ref_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version TEXT NOT NULL DEFAULT 'open',
  invited_by BIGINT REFERENCES waitlist_signups (id),
  confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS waitlist_signups_ref_idx ON waitlist_signups (ref);

CREATE TABLE IF NOT EXISTS site_events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  visitor TEXT NOT NULL,
  utm_source TEXT,
  utm_content TEXT,
  ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version TEXT
);
CREATE INDEX IF NOT EXISTS site_events_event_idx ON site_events (event, created_at);

-- A database from before the waitlist had pairs (docs/tasks/WAITLIST.md). This runs once,
-- when the columns are missing: everyone already on the list joined the open version and is
-- confirmed, and is attached to the link they came with while that link has room (4 people,
-- or 3 if its owner arrived through a link too).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'waitlist_signups' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE waitlist_signups
      ADD COLUMN version TEXT NOT NULL DEFAULT 'open',
      ADD COLUMN invited_by BIGINT REFERENCES waitlist_signups (id),
      ADD COLUMN confirmed_at TIMESTAMPTZ;
    UPDATE waitlist_signups SET confirmed_at = created_at;
    UPDATE waitlist_signups s SET invited_by = m.inviter
    FROM (
      SELECT
        c.id,
        r.id AS inviter,
        row_number() OVER (PARTITION BY r.id ORDER BY c.id) AS n,
        CASE WHEN EXISTS (SELECT 1 FROM waitlist_signups p WHERE p.ref_code = r.ref AND p.id < r.id)
          THEN 3 ELSE 4 END AS room
      FROM waitlist_signups c
      JOIN waitlist_signups r ON r.ref_code = c.ref AND r.id < c.id
    ) m
    WHERE s.id = m.id AND m.n <= m.room;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'site_events' AND column_name = 'version'
  ) THEN
    ALTER TABLE site_events ADD COLUMN version TEXT;
    UPDATE site_events SET version = 'open';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS waitlist_signups_invited_by_idx ON waitlist_signups (invited_by);
`;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export class DatabaseNotConfigured extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "DatabaseNotConfigured";
  }
}

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new DatabaseNotConfigured();
  globals.__vennPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  return globals.__vennPool;
}

function ensureSchema(): Promise<void> {
  globals.__vennSchema ??= pool()
    .query(SCHEMA)
    .then(() => undefined)
    .catch((error) => {
      // Let the next request try again instead of caching the failure.
      globals.__vennSchema = undefined;
      throw error;
    });
  return globals.__vennSchema;
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<Row[]> {
  await ensureSchema();
  const result = await pool().query<Row>(text, params);
  return result.rows;
}

export type Query = <Row extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<Row[]>;

/** Runs `work` in one transaction on one connection. A throw rolls everything back. */
export async function transaction<Result>(work: (query: Query) => Promise<Result>): Promise<Result> {
  await ensureSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(async (text, params = []) => (await client.query(text, params)).rows);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Postgres unique-violation, e.g. a second signup with the same email. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}
