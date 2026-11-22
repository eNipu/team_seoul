// Search results: who came up, and above all why.

import { useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { Link, useLocation } from "../router";
import { firstName, formatLastSeen, friendPath, plural, type SearchResult } from "../types";
import { Avatar, Chips, CopyButton, EmptyState, KindTag, Loaded, PageHeader, Skeleton, Tag, useAsync } from "../ui";
import { MemoryCard } from "./Memories";

const EXAMPLES = ["photography", "board games", "climbing", "pottery", "Lisbon"];

function draftFor(r: SearchResult, query: string): string {
  const topic = (r.matched[0] ?? query).trim();
  return `Hi ${firstName(r.display_name)}! I was thinking about ${topic} and you came to mind. Want to do something together soon? No pressure — would be great to catch up.`;
}

function ResultRow({ r, query }: { r: SearchResult; query: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(() => draftFor(r, query));
  const panelId = `draft-${r.kind}-${r.id}`;
  return (
    <li className="result">
      <Avatar name={r.display_name} size="large" />
      <div className="result__main">
        <div className="result__head">
          <h3>
            <Link to={friendPath(r.kind, r.id)}>{r.display_name}</Link>
          </h3>
          {r.relationship && <span className="muted">{r.relationship}</span>}
          <KindTag onVenn={r.on_venn} />
          {r.is_sample && <Tag tone="info">Sample</Tag>}
        </div>
        <p className="why">
          <span className="why__label">Why {firstName(r.display_name)} came up</span>
          <span className="why__text">{r.why || r.snippet || "Matched your search."}</span>
        </p>
        {r.matched.length > 0 && (
          <div className="result__matched">
            <span className="muted small">Matched</span>
            <Chips items={r.matched} tone="shared" />
          </div>
        )}
        <p className="muted small">
          <Icon name="clock" size={14} /> {formatLastSeen(r.last_interaction_at)}
        </p>
        <div className="row">
          <Link to={friendPath(r.kind, r.id)} className="btn btn--small btn--primary">
            Open {firstName(r.display_name)}'s page
            <Icon name="arrow-right" size={16} />
          </Link>
          <button
            type="button"
            className="btn btn--small"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name="send" size={16} />
            {r.is_sample ? "Draft a sample invitation" : "Draft an invitation"}
          </button>
        </div>
        {open && (
          <div className="draft draft--edit" id={panelId}>
            <label htmlFor={`${panelId}-text`} className="draft__label">
              A message for {firstName(r.display_name)} — edit it to sound like you
            </label>
            <textarea id={`${panelId}-text`} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="row">
              <CopyButton text={message} label="Copy message" />
              <span className="muted small">
                <Icon name="shield" size={14} /> Venn doesn't send this for you.
              </span>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function Results({ q }: { q: string }) {
  const search = useAsync(() => api.search(q), [q]);
  return (
    <Loaded state={search} skeleton={<Skeleton rows={3} />}>
      {(s) =>
        s.results.length === 0 && s.memories.length === 0 ? (
          <EmptyState illustration="search" title={`No one came up for “${q}”`}>
            <p>
              Venn looked through {plural(s.searched, "person", "people")} and your saved memories. Try one word — an interest,
              a place, a job.
            </p>
            <p className="examples">
              {EXAMPLES.map((e) => (
                <Link key={e} to="/search" query={{ q: e }} className="chip chip--link">
                  {e}
                </Link>
              ))}
            </p>
          </EmptyState>
        ) : (
          <>
            <section className="results-section">
              <h2>
                People <span className="count-badge">{s.results.length}</span>
              </h2>
              {s.results.length === 0 ? (
                <p className="muted">No one in your circle matched, but your memories did.</p>
              ) : (
                <ul className="results">
                  {s.results.map((r) => (
                    <ResultRow key={`${r.kind}:${r.id}`} r={r} query={q} />
                  ))}
                </ul>
              )}
            </section>
            {s.memories.length > 0 && (
              <section className="results-section">
                <h2>
                  From your memories <span className="count-badge">{s.memories.length}</span>
                </h2>
                <ul className="memories card card--flush">
                  {s.memories.map((m) => (
                    <MemoryCard key={m.memory_id} memory={m} />
                  ))}
                </ul>
                <p className="fine">
                  <Link to="/memories" query={{ q }}>
                    See all matching memories
                  </Link>
                </p>
              </section>
            )}
          </>
        )
      }
    </Loaded>
  );
}

export default function Search() {
  const loc = useLocation();
  const q = (loc.query.get("q") ?? "").trim();
  if (!q) {
    return (
      <div className="page">
        <PageHeader title="Search your circle" lead="Ask it the way you'd wonder out loud: who do I know who…" />
        <EmptyState illustration="search" title="Who do you know who…">
          <p>Type in the search field above, or try one of these.</p>
          <p className="examples">
            {EXAMPLES.map((e) => (
              <Link key={e} to="/search" query={{ q: e }} className="chip chip--link">
                {e}
              </Link>
            ))}
          </p>
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="page">
      <PageHeader title={`Who do I know who… “${q}”`} lead="People from your circle, with the reason each one came up." />
      <Results key={q} q={q} />
    </div>
  );
}
