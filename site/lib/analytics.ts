// First-party product analytics for the landing page. No third-party scripts, no
// cookies, nothing stored on the visitor's device.
//
// A visitor is a salted hash of IP address and user agent that changes every day
// (the approach Plausible uses). The raw IP is never stored, and the same person on
// two different days counts as two visitors.

import { createHash } from "node:crypto";

import { hasDatabase, query } from "./db";
import { clientIp } from "./rate-limit";

export type EventName = "page_view" | "core_action_completed";

export type Attribution = {
  utm_source: string | null;
  utm_content: string | null;
  ref: string | null;
};

const REF_PATTERN = /^[a-z0-9]{4,16}$/;
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|monitor|lighthouse|pingdom|headless/i;

function cleanLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 64);
  return label || null;
}

export function cleanRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ref = value.trim().toLowerCase();
  return REF_PATTERN.test(ref) ? ref : null;
}

/** Reads `utm_source`, `utm_content` and `ref` from untrusted input. */
export function cleanAttribution(input: unknown): Attribution {
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  return {
    utm_source: cleanLabel(source.utm_source),
    utm_content: cleanLabel(source.utm_content),
    ref: cleanRef(source.ref),
  };
}

export function isBot(headers: Headers): boolean {
  const agent = headers.get("user-agent") ?? "";
  return !agent || BOT_PATTERN.test(agent);
}

export function visitorId(headers: Headers): string {
  const ip = clientIp(headers);
  const agent = headers.get("user-agent") ?? "";
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT ?? process.env.DATABASE_URL ?? "venn";
  return createHash("sha256").update(`${salt}|${day}|${ip}|${agent}`).digest("hex").slice(0, 32);
}

/** Records one event. Without a database this does nothing. */
export async function track(event: EventName, visitor: string, attribution: Attribution): Promise<void> {
  if (!hasDatabase()) return;
  await query(
    "INSERT INTO site_events (event, visitor, utm_source, utm_content, ref) VALUES ($1, $2, $3, $4, $5)",
    [event, visitor, attribution.utm_source, attribution.utm_content, attribution.ref],
  );
}

export type BreakdownRow = { label: string; detail: string; visitors: number; signups: number };

export type Metrics = {
  uniqueVisitors: number;
  waitlistSignups: number;
  activatedVisitors: number;
  /** Visitors who completed the core action (joined the waitlist), as a share of all visitors. 0 to 1. */
  activationRate: number;
  referredSignups: number;
  bySource: BreakdownRow[];
  byReferral: BreakdownRow[];
};

export async function getMetrics(): Promise<Metrics> {
  const [totals] = await query<{ visitors: string; activated: string; signups: string; referred: string }>(`
    SELECT
      (SELECT count(DISTINCT visitor) FROM site_events) AS visitors,
      (SELECT count(DISTINCT visitor) FROM site_events WHERE event = 'core_action_completed') AS activated,
      (SELECT count(*) FROM waitlist_signups) AS signups,
      (SELECT count(*) FROM waitlist_signups s
        WHERE EXISTS (SELECT 1 FROM waitlist_signups r WHERE r.ref_code = s.ref)) AS referred
  `);

  const bySource = await query<{ label: string; detail: string; visitors: string; signups: string }>(`
    SELECT
      coalesce(utm_source, '(direct)') AS label,
      coalesce(utm_content, '') AS detail,
      count(DISTINCT visitor) AS visitors,
      count(DISTINCT visitor) FILTER (WHERE event = 'core_action_completed') AS signups
    FROM site_events
    GROUP BY 1, 2
    ORDER BY 3 DESC, 1, 2
    LIMIT 50
  `);

  const byReferral = await query<{ label: string; visitors: string; signups: string }>(`
    SELECT
      ref AS label,
      count(DISTINCT visitor) AS visitors,
      count(DISTINCT visitor) FILTER (WHERE event = 'core_action_completed') AS signups
    FROM site_events
    WHERE ref IS NOT NULL
    GROUP BY 1
    ORDER BY 3 DESC, 2 DESC, 1
    LIMIT 25
  `);

  const uniqueVisitors = Number(totals.visitors);
  const activatedVisitors = Number(totals.activated);
  const toRow = (row: { label: string; detail?: string; visitors: string; signups: string }): BreakdownRow => ({
    label: row.label,
    detail: row.detail ?? "",
    visitors: Number(row.visitors),
    signups: Number(row.signups),
  });

  return {
    uniqueVisitors,
    waitlistSignups: Number(totals.signups),
    activatedVisitors,
    activationRate: uniqueVisitors > 0 ? activatedVisitors / uniqueVisitors : 0,
    referredSignups: Number(totals.referred),
    bySource: bySource.map(toRow),
    byReferral: byReferral.map(toRow),
  };
}
