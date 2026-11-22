import { strongestFirst } from "../../../shared/importInterests";
import { useEffect, useRef, useState } from "react";
import { DEMO_PLATFORM_LABELS, formatDaysAgo, parseImportPeople, parseView, plural, type ImportCandidate, type PeopleImportViewData } from "../types";
import { ActionError, Avatar, EmptyNote, useAction, type ViewProps } from "./common";
import ImportInterests from "./ImportInterests";
import PeopleRadar from "./PeopleRadar";
import { Illustration } from "./icons";

export default function PeopleImport({ data, bridge, nav }: ViewProps<PeopleImportViewData>) {
  const action = useAction();
  const demoPlatform = data.demo_platform;
  const platform = demoPlatform && DEMO_PLATFORM_LABELS[demoPlatform];
  const token = data.confirmation_token;
  const socialSource = demoPlatform ?? (data.source === "instagram" || data.source === "linkedin" ? data.source : null);
  const [page, setPage] = useState(0);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const pageSize = 4;
  const pages = Math.ceil(data.candidates.length / pageSize);
  const visible = platform ? strongestFirst(data.candidates).slice(page * pageSize, (page + 1) * pageSize) : [];
  function showPage(next: number) {
    setPage(next);
    listHeading.current?.focus();
  }
  const fresh = data.candidates.filter((c) => !c.already_added);
  // Everyone new starts selected: one tap adds them; tapping a person on the radar or list leaves them out.
  const [picked, setPicked] = useState<Set<number>>(() => new Set(fresh.map((c) => c.index)));
  const [added, setAdded] = useState<{ count: number; names: string[] } | null>(null);

  useEffect(() => { if (added) resultHeading.current?.focus(); }, [added]);

  async function continueSetup() {
    // A standalone import may have happened before step one. Consult current account state;
    // don't use this open card as proof that its prerequisites are still satisfied.
    const result = await bridge.callTool("venn_show_dashboard", {});
    if (!result.ok) return result.errorText;
    const home = parseView(result.data);
    if (home?.view === "dashboard" && home.onboarding?.memories_ready && home.onboarding.contacts_ready) {
      return nav.openView("venn_find_interest_matches", {});
    }
    return nav.openDashboard("profile");
  }

  const busy = action.busy !== null;
  const count = picked.size;
  const selection = platform ? plural(count, "profile", "profiles") : plural(count, "person", "people");
  const confirmLabel = action.busy === "import" ? "Adding…" :
    platform && fresh.length === 0 ? "All profiles already added" : count === 0 ? "Pick someone to add" : `Add ${selection}`;
  const skippedLine =
    data.skipped > 0
      ? `${plural(data.skipped, "entry was", "entries were")} left out because ${data.skipped === 1 ? "it" : "they"} contained sensitive details.`
      : null;

  function toggle(c: ImportCandidate) {
    action.clear();
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(c.index)) next.delete(c.index);
      else next.add(c.index);
      return next;
    });
  }

  function confirm() {
    const indexes = data.candidates.filter((c) => picked.has(c.index)).map((c) => c.index);
    if (indexes.length === 0 || (platform && !token)) return;
    void action.run("import", async () => {
      const args = { import_id: data.import_id, indexes };
      const res = platform
        ? await bridge.callTool("venn_import_demo_people", { ...args, confirmation_token: token })
        : await bridge.callTool("venn_import_people", args);
      if (!res.ok) {
        if (platform && /mcp resource not found/i.test(res.errorText)) {
          return "ChatGPT couldn't reach the Add action. Refresh Venn in Plugins, then open a fresh preview in a new chat.";
        }
        return res.errorText;
      }
      const result = parseImportPeople(res.data);
      if (!result) return "Venn couldn't verify what was added. Check Friends before trying again.";
      if (result.count === 0) {
        return platform ? "Those profiles are already in Venn. Open a fresh preview to review again." : "Venn didn't add anyone. Try again.";
      }
      setAdded({ count: result.count, names: result.imported.map((p) => p.name) });
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
        <h2 ref={resultHeading} tabIndex={-1} role="status">Added {platform ? plural(added.count, "profile", "profiles") : plural(added.count, "person", "people")}</h2>
        <p className="muted">
          {platform ? `These sample ${platform} contacts are private notes. Clear preview data on the dashboard to remove them.` :
            "They're saved as private notes. Only you can see them."}
        </p>
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
            onClick={() => void action.run("friends", socialSource ? continueSetup : () => nav.openDashboard("friends"))}
          >
            {action.busy === "friends" ? "Loading…" : socialSource ? "Continue to interest matches" : "See my friends"}
          </button>
          <button
            type="button"
            className="onb__link"
            disabled={busy}
            onClick={() => void action.run("reconnect", () => socialSource
              ? nav.replaceView("venn_preview_demo_people_import", { platform: socialSource === "instagram" ? "linkedin" : "instagram" })
              : nav.openView("venn_reconnection_suggestions", {}))}
          >
            {action.busy === "reconnect" ? "Opening…" : socialSource ? `Also review ${socialSource === "instagram" ? "LinkedIn" : "Instagram"} profiles` : "Who should I reconnect with?"}
          </button>
        </div>
      </section>
    );
  }

  const addButton = (
    <button type="button" className="btn btn--primary btn--block" disabled={busy || count === 0} onClick={confirm}>
      {confirmLabel}
    </button>
  );

  return (
    <section className="panel">
      <h2 ref={listHeading} tabIndex={-1}>{platform ? `${platform} import` : "Add more people."}</h2>
      <p className="muted small lead">
        {platform ? `Choose fictional ${platform} contacts to add as private notes.` : `Only you see these.`}
      </p>

      <ActionError action={action} />

      {demoPlatform && !token ? (
        <div className="stack">
          <p className="muted small">This review can’t confirm an import. Open a fresh review to choose who to add.</p>
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy}
            onClick={() => void action.run("reopen", () => nav.replaceView("venn_preview_demo_people_import", { platform: demoPlatform }))}
          >
            {action.busy === "reopen" ? "Opening…" : "Open fresh review"}
          </button>
        </div>
      ) : data.candidates.length === 0 ? (
        <EmptyNote art="search" title="No one to add">
          {platform ? `No sample ${platform} contacts are available.` : "Venn couldn't find any people in that. Try pasting names, one per line."}
        </EmptyNote>
      ) : (
        <>
          {!platform && <PeopleRadar candidates={data.candidates} picked={picked} busy={busy} toggle={toggle} />}
          <div className="pick-bar">
            <span className={platform ? "pick-bar__count" : "sr-only"} role="status">
              {count} of {data.candidates.length} selected
            </span>
          </div>

          {platform && (
            <>
              {pages > 1 && <nav aria-label="Profile pages" className="button-row">
                <button type="button" className="btn" disabled={busy || page === 0} aria-label="Previous profiles" onClick={() => showPage(page - 1)}>Previous</button>
                <span className="muted small" role="status">Page {page + 1} of {pages}</span>
                <button type="button" className="btn" disabled={busy || page + 1 >= pages} aria-label="Next profiles" onClick={() => showPage(page + 1)}>Next</button>
              </nav>}

              <ul
                className="list pick-list pick-list--demo"
                aria-label="Preview profiles"
              >
                {visible.map((c) => {
                  const on = picked.has(c.index);
                  const meta = [c.relationship, c.last_met_days_ago !== null ? `Last met ${approxDays(c.last_met_days_ago)}` : null]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={c.index}>
                      <label className={`pick ${on ? "pick--on" : ""}`}>
                        <input type="checkbox" checked={on} disabled={busy || c.already_added} onChange={() => toggle(c)} />
                        <Avatar name={c.name} size="small" />
                        <span className="pick__body">
                          <span className="pick__name">
                            <strong>{c.name}</strong>
                            {c.already_added && <span className="badge badge--on">Already in Venn</span>}
                          </span>
                          {meta && <span className="muted small">{meta}</span>}
                          {c.notes && <span className="muted small pick__notes">{c.notes}</span>}
                          <ImportInterests {...c} />
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {skippedLine && <p className="muted small">{skippedLine}</p>}

          <div className="sticky-bar">{addButton}</div>
        </>
      )}
    </section>
  );
}

/** "~3 days ago", but no tilde in front of "today"/"yesterday". */
function approxDays(days: number): string {
  const text = formatDaysAgo(days);
  return days <= 1 || text.startsWith("over") ? text : `~${text.replace(/^about /, "")}`;
}
