import { useId, useState, type FormEvent } from "react";
import { LIMITS, formatRelative, friendArg, groupArgs, plural, type PeopleSearchViewData, type SearchResult } from "../types";
import { ActionError, Avatar, EmptyNote, Spinner, useAction, type ViewProps } from "./common";
import { Icon } from "./icons";

export function SearchIcon() {
  return (
    <span className="search__icon" aria-hidden="true">
      <Icon name="search" size={18} />
    </span>
  );
}

export default function PeopleSearch({ data, nav }: ViewProps<PeopleSearchViewData>) {
  const id = useId();
  const action = useAction();
  const [query, setQuery] = useState(data.query);
  const busy = action.busy !== null;
  const canGroup = data.results.length >= LIMITS.groupMin;

  function search(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Swap the results in place so Back still leads to where the search started.
    void action.run("search", () => nav.replaceView("venn_find_people", { query: q }));
  }

  function open(r: SearchResult) {
    void action.run(`open-${r.kind}:${r.id}`, () => nav.openView("venn_view_friend", friendArg(r.kind, r.id)));
  }

  function planTogether() {
    void action.run("group", () => nav.openView("venn_plan_group", groupArgs(data.results)));
  }

  return (
    <section className="panel">
      <div>
        <p className="eyebrow">Who do I know who…</p>
        <h2>“{data.query}”</h2>
      </div>

      <form className="search-form" role="search" onSubmit={search}>
        <label className="sr-only" htmlFor={`${id}-q`}>
          Search your circle
        </label>
        <div className="search">
          <SearchIcon />
          <input
            id={`${id}-q`}
            type="search"
            value={query}
            maxLength={LIMITS.searchQuery}
            placeholder="climbing, Busan, loves ramen…"
            autoComplete="off"
            enterKeyHint="search"
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={busy || query.trim() === ""}>
          {action.busy === "search" ? "Searching…" : "Search"}
        </button>
      </form>

      <ActionError action={action} />

      {data.results.length === 0 ? (
        <EmptyNote art="search" title={`No one in your circle matches “${data.query}” yet`}>
          Try another word, or add more people so Venn has more to search.
        </EmptyNote>
      ) : (
        <>
          <p className="muted small" role="status">
            {plural(data.results.length, "match", "matches")}
            {data.searched > 0 ? ` among ${plural(data.searched, "friend", "friends")}` : ""}
          </p>
          <ul className="list list--tight">
            {data.results.map((r) => (
              <li key={`${r.kind}:${r.id}`}>
                <button type="button" className="friend-row friend-row--top" disabled={busy} onClick={() => open(r)}>
                  <Avatar name={r.display_name} />
                  <span className="friend-row__body">
                    <span className="pick__name">
                      <strong>{r.display_name}</strong>
                      <span className={`badge ${r.on_venn ? "badge--on" : "badge--note"}`}>
                        {r.on_venn ? "On Venn" : "Private note"}
                      </span>
                    </span>
                    <span className="muted small">
                      {[r.relationship, r.last_interaction_at ? `Last met ${formatRelative(r.last_interaction_at)}` : "No hangouts logged yet"]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {r.matched.length > 0 && (
                      <span className="chips">
                        <span className="sr-only">Matched: </span>
                        {r.matched.map((m, i) => (
                          <span key={`${m}-${i}`} className="chip chip--match">
                            <Icon name="check" size={12} />
                            {m}
                          </span>
                        ))}
                      </span>
                    )}
                    {r.snippet && <span className="small snippet">{r.snippet}</span>}
                  </span>
                  <span className="friend-row__open" aria-hidden="true">
                    {action.busy === `open-${r.kind}:${r.id}` ? <Spinner /> : <Icon name="chevron-right" size={18} />}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {canGroup && (
            <div className="callout">
              <div>
                <strong>Get them together</strong>
                <p className="muted small">
                  {data.results.length > LIMITS.groupMax
                    ? `Plan something with the first ${LIMITS.groupMax} matches.`
                    : "See what everyone has in common and plan something."}
                </p>
              </div>
              <button type="button" className="btn btn--small" disabled={busy} onClick={planTogether}>
                <Icon name="users" size={16} />
                {action.busy === "group" ? "Planning…" : "Plan something together"}
              </button>
            </div>
          )}
        </>
      )}

      {data.note && <p className="muted small footnote">{data.note}</p>}
    </section>
  );
}
