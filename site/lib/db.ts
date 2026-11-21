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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS waitlist_signups_ref_idx ON waitlist_signups (ref);

CREATE TABLE IF NOT EXISTS site_events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  visitor TEXT NOT NULL,
  utm_source TEXT,
  utm_content TEXT,
  ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_events_event_idx ON site_events (event, created_at);
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

/** Postgres unique-violation, e.g. a second signup with the same email. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}
