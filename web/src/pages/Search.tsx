// Search results: who came up, and above all why.

import { useState } from "react";
import { api } from "../api";
import { Link, useLocation } from "../router";
import { firstName, friendPath, type SearchResult } from "../types";
import { Avatar, CopyButton, Loaded, PageHeader, Skeleton, useAsync } from "../ui";
import { MemoryCard } from "./Memories";
import "./tools.css";

const EXAMPLES = ["photography", "board games", "climbing", "pottery", "Lisbon"];

function draftFor(r: SearchResult, query: string): string {
  const topic = (r.matched[0] ?? query).trim();
  return `Hi ${firstName(r.display_name)}! I was thinking about ${topic} and you came to mind. Want to do something together soon? No pressure — would be great to catch up.`;
}

function ResultRow({ r, query, moment }: { r: SearchResult; query: string; moment: boolean }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(() => draftFor(r, query));
  const panelId = `draft-${r.kind}-${r.id}`;
  return (
    <li className={`tl__card ${moment ? "tl__moment" : ""}`}>
      <div className="tl__who">
        <Avatar name={r.display_name} />
        <div>
          <h3>
            <Link to={friendPath(r.kind, r.id)}>{r.display_name}</Link>
          </h3>
          {(r.relationship || r.is_sample) && (
            <p className="tl__meta">{[r.relationship, r.is_sample && "Sample"].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      </div>
      <p>{r.why || r.snippet || "Matched your search."}</p>
      <div className="tl__row">
        <button
          type="button"
          className="tl__link"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide message" : `Message ${firstName(r.display_name)}`}
        </button>
      </div>
      {open && (
        <div className="tl__draft" id={panelId}>
          <label htmlFor={`${panelId}-text`} className="sr-only">
            A message for {firstName(r.display_name)}
          </label>
          <textarea id={`${panelId}-text`} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="tl__row">
            <CopyButton text={message} label="Copy" />
            <span className="tl__meta">Venn doesn't send it.</span>
          </div>
        </div>
      )}
    </li>
  );
}

const examples = (
  <div className="tl__chips">
    {EXAMPLES.map((e) => (
      <Link key={e} to="/search" query={{ q: e }} className="tl__chip">
        {e}
      </Link>
    ))}
  </div>
);

function Results({ q }: { q: string }) {
  const search = useAsync(() => api.search(q), [q]);
  return (
    <Loaded state={search} skeleton={<Skeleton rows={3} />}>
      {(s) =>
        s.results.length === 0 && s.memories.length === 0 ? (
          <>
            <p>No one came up. Try one word.</p>
            {examples}
          </>
        ) : (
          <>
            {s.results.length > 0 && (
              <ul className="tl__list" aria-label="People">
                {s.results.map((r, i) => (
                  <ResultRow key={`${r.kind}:${r.id}`} r={r} query={q} moment={i === 0} />
                ))}
              </ul>
            )}
            {s.memories.length > 0 && (
              <details className="tl__more" open={s.results.length === 0}>
                <summary>From your memories ({s.memories.length})</summary>
                <ul className="memories card card--flush">
                  {s.memories.map((m) => (
                    <MemoryCard key={m.memory_id} memory={m} />
                  ))}
                </ul>
                <p>
                  <Link to="/memories" query={{ q }} className="tl__link">
                    See all
                  </Link>
                </p>
              </details>
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
      <div className="page tl">
        <PageHeader title="Who do you know who…" />
        {examples}
      </div>
    );
  }
  return (
    <div className="page tl">
      <PageHeader title={`“${q}”`} />
      <Results key={q} q={q} />
    </div>
  );
}
