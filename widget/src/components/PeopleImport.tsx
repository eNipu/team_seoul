import { useState } from "react";
import { formatDaysAgo, parseImportPeople, plural, type ImportCandidate, type PeopleImportViewData } from "../types";
import { ActionError, Avatar, EmptyNote, useAction, type ViewProps } from "./common";
import { Illustration } from "./icons";

export default function PeopleImport({ data, bridge, nav }: ViewProps<PeopleImportViewData>) {
  const action = useAction();
  const fresh = data.candidates.filter((c) => !c.already_added);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(fresh.map((c) => c.index)));
  const [added, setAdded] = useState<{ count: number; names: string[] } | null>(null);

  const busy = action.busy !== null;
  const count = data.candidates.filter((c) => picked.has(c.index)).length;
  const skippedLine =
    data.skipped > 0
      ? `${plural(data.skipped, "entry was", "entries were")} left out because ${data.skipped === 1 ? "it" : "they"} contained sensitive details.`
      : null;

  function toggle(c: ImportCandidate) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(c.index)) next.delete(c.index);
      else next.add(c.index);
      return next;
    });
  }

  function confirm() {
    const indexes = data.candidates.filter((c) => picked.has(c.index)).map((c) => c.index);
    if (indexes.length === 0) return;
    void action.run("import", async () => {
      const res = await bridge.callTool("venn_import_people", { import_id: data.import_id, indexes });
      if (!res.ok) return res.errorText;
      const result = parseImportPeople(res.data);
      if (result.count === 0 && result.imported.length === 0) return "Venn didn't add anyone. Try again.";
      setAdded({ count: result.count || result.imported.length, names: result.imported.map((p) => p.name) });
      window.scrollTo?.(0, 0);
      return null;
    });
  }

  if (added) {
    const shown = added.names.slice(0, 7);
    return (
      <section className="panel celebrate">
        <ActionError action={action} />
        <Illustration name="friends" />
        <h2 role="status">Added {plural(added.count, "person", "people")}</h2>
        <p className="muted">They're saved as private notes. Only you can see them.</p>
        {shown.length > 0 && (
          <div className="avatar-stack avatar-stack--center" aria-hidden="true">
            {shown.map((n, i) => (
              <Avatar key={`${n}-${i}`} name={n} />
            ))}
            {added.names.length > shown.length && <span className="avatar avatar--more">+{added.names.length - shown.length}</span>}
          </div>
        )}
        {skippedLine && <p className="muted small">{skippedLine}</p>}
        <div className="button-row celebrate__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => void action.run("friends", () => nav.openView("venn_show_dashboard", {}))}
          >
            {action.busy === "friends" ? "Loading…" : "See my friends"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void action.run("reconnect", () => nav.openView("venn_reconnection_suggestions", {}))}
          >
            {action.busy === "reconnect" ? "Looking…" : "Who should I reconnect with?"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Add these people?</h2>
      <p className="muted small lead">
        {data.source ? `From your ${data.source}. ` : ""}Nothing is saved until you confirm. They become private notes only you can
        see.
      </p>

      <ActionError action={action} />

      {data.candidates.length === 0 ? (
        <EmptyNote art="search" title="No one to add">
          Venn couldn't find any people in that. Try pasting names, one per line.
        </EmptyNote>
      ) : (
        <>
          <div className="pick-bar">
            <span className="pick-bar__count" role="status">
              {count} of {data.candidates.length} selected
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              disabled={busy}
              onClick={() => setPicked(new Set(fresh.map((c) => c.index)))}
            >
              Select all
            </button>
            <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setPicked(new Set())}>
              None
            </button>
          </div>

          <ul className="list pick-list">
            {data.candidates.map((c, i) => {
              const on = picked.has(c.index);
              const meta = [c.relationship, c.last_met_days_ago !== null ? `Last met ${approxDays(c.last_met_days_ago)}` : null]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={`${c.index}-${i}`}>
                  <label className={`pick ${on ? "pick--on" : ""}`}>
                    <input type="checkbox" checked={on} disabled={busy} onChange={() => toggle(c)} />
                    <Avatar name={c.name} size="small" />
                    <span className="pick__body">
                      <span className="pick__name">
                        <strong>{c.name}</strong>
                        {c.already_added && <span className="badge badge--on">Already in Venn</span>}
                      </span>
                      {meta && <span className="muted small">{meta}</span>}
                      {c.notes && <span className="muted small pick__notes">{c.notes}</span>}
                      {c.interests.length > 0 && (
                        <span className="chips">
                          {c.interests.map((it, j) => (
                            <span key={`${it}-${j}`} className="chip chip--small">
                              {it}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {skippedLine && <p className="muted small">{skippedLine}</p>}

          <div className="sticky-bar">
            <button type="button" className="btn btn--primary btn--block" disabled={busy || count === 0} onClick={confirm}>
              {action.busy === "import" ? "Adding…" : count === 0 ? "Pick someone to add" : `Add ${plural(count, "person", "people")}`}
            </button>
          </div>
        </>
      )}

      {data.note && <p className="muted small footnote">{data.note}</p>}
    </section>
  );
}

/** "~3 days ago", but no tilde in front of "today"/"yesterday". */
function approxDays(days: number): string {
  const text = formatDaysAgo(days);
  return days <= 1 || text.startsWith("over") ? text : `~${text.replace(/^about /, "")}`;
}
