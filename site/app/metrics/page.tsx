import type { Metadata } from "next";

import SiteHeader from "@/components/SiteHeader";
import { type BreakdownRow, type Metrics, getMetrics } from "@/lib/analytics";
import { hasDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Venn metrics",
  robots: { index: false, follow: false },
};

const count = new Intl.NumberFormat("en");
const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });

const rate = (signups: number, visitors: number) => (visitors > 0 ? percent.format(signups / visitors) : "–");

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel tile">
      <span className="tile__label">{label}</span>
      <span className="tile__value">{value}</span>
      <span className="tile__hint">{hint}</span>
    </div>
  );
}

function Breakdown({
  title,
  column,
  rows,
  empty,
}: {
  title: string;
  column: string;
  rows: BreakdownRow[];
  empty: string;
}) {
  return (
    <section className="panel metrics__section">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <div className="metrics__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{column}</th>
                <th scope="col" className="num">
                  Visitors
                </th>
                <th scope="col" className="num">
                  Signups
                </th>
                <th scope="col" className="num">
                  Activation
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.label}|${row.detail}`}>
                  <th scope="row">
                    {row.label}
                    {row.detail && <span className="metrics__detail">{row.detail}</span>}
                  </th>
                  <td className="num">{count.format(row.visitors)}</td>
                  <td className="num">{count.format(row.signups)}</td>
                  <td className="num">{rate(row.signups, row.visitors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function load(): Promise<{ metrics: Metrics | null; problem: string | null }> {
  if (!hasDatabase()) return { metrics: null, problem: "DATABASE_URL is not set, so nothing is being recorded." };
  try {
    return { metrics: await getMetrics(), problem: null };
  } catch (error) {
    console.error("metrics: query failed", error);
    return { metrics: null, problem: "The database could not be reached. Check the server logs." };
  }
}

export default async function MetricsPage() {
  const { metrics, problem } = await load();

  return (
    <div className="metrics">
      <SiteHeader note="Metrics" />
      <main className="wrap">
        <h1 className="metrics__title">Launch metrics</h1>
        <p className="metrics__lede">
          Counted by this site in its own database. A visitor is an anonymous daily hash, so the same person on two days
          counts twice.
        </p>

        {problem && (
          <p className="notice" role="alert">
            {problem}
          </p>
        )}

        {metrics && (
          <>
            <div className="metrics__tiles">
              <Tile
                label="Unique Visitors"
                value={count.format(metrics.uniqueVisitors)}
                hint="Anonymous visitors, counted once per day"
              />
              <Tile
                label="Total Waitlist Signups"
                value={count.format(metrics.waitlistSignups)}
                hint={`${count.format(metrics.referredSignups)} came through an invite link`}
              />
              <Tile
                label="Activation Rate"
                value={rate(metrics.activatedVisitors, metrics.uniqueVisitors)}
                hint={`${count.format(metrics.activatedVisitors)} of ${count.format(metrics.uniqueVisitors)} visitors joined the waitlist`}
              />
            </div>

            <Breakdown
              title="By UTM source"
              column="utm_source / utm_content"
              rows={metrics.bySource}
              empty="No visits recorded yet."
            />
            <Breakdown
              title="By referral"
              column="Invite code (ref)"
              rows={metrics.byReferral}
              empty="Nobody has arrived through an invite link yet."
            />
          </>
        )}
      </main>
    </div>
  );
}
