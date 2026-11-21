import { useEffect, useRef, useState } from "react";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  formatDate,
  formatDaysAgo,
  formatRelative,
  friendArg,
  parseLogInteraction,
  type BriefViewData,
} from "../types";
import { ActionError, Avatar, SectionTitle, copyText, useAction, type ViewProps } from "./common";
import FollowUps from "./FollowUps";

export default function Brief({ data, bridge, nav }: ViewProps<BriefViewData>) {
  const action = useAction();
  const arg = friendArg(data.kind, data.id);
  const isPerson = data.kind === "person";
  const first = data.display_name.trim().split(/\s+/)[0] || data.display_name;

  const [logged, setLogged] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const busy = action.busy !== null;

  const when = logged
    ? "today"
    : data.days_since_last_interaction !== null
      ? formatDaysAgo(data.days_since_last_interaction)
      : data.last_interaction_at
        ? formatRelative(data.last_interaction_at)
        : null;
  const onDate = !logged && data.last_interaction_at ? formatDate(data.last_interaction_at) : "";

  const sharedKeys = new Set(data.shared_interests.map((s) => s.toLowerCase()));
  const others = data.interests.filter((i) => !sharedKeys.has(i.toLowerCase()));

  function metUp() {
    void action.run("log", async () => {
      const res = await bridge.callTool("heldly_log_interaction", arg);
      if (!res.ok) return res.errorText;
      if (!parseLogInteraction(res.data).recorded) return "Heldly couldn't log that.";
      setLogged(true);
      return null;
    });
  }

  async function copyStarter(index: number, text: string) {
    const ok = await copyText(text);
    window.clearTimeout(timer.current);
    setCopyFailed(!ok);
    setCopied(ok ? index : null);
    if (ok) timer.current = window.setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section className="panel">
      <div className="profile-head">
        <Avatar name={data.display_name} size="large" />
        <div className="profile-head__body">
          <p className="eyebrow">Before you see</p>
          <h2>{data.display_name}</h2>
          <div className="row row--wrap">
            <span className={`badge ${data.on_heldly ? "badge--on" : "badge--note"}`}>
              {data.on_heldly ? "On Heldly" : "Private note"}
            </span>
            {data.relationship && <span className="badge badge--note">{data.relationship}</span>}
          </div>
        </div>
      </div>

      <ActionError action={action} />

      <div className="last-time">
        <span className="last-time__icon" aria-hidden="true">
          🕰️
        </span>
        <div>
          <span className="field__label">Last time</span>
          {when ? (
            <>
              <p className="last-time__when">
                <strong>{when.charAt(0).toUpperCase() + when.slice(1)}</strong>
                {onDate && <span className="muted small"> · {onDate}</span>}
              </p>
              {!logged && data.last_activity && <p className="small">{data.last_activity}</p>}
              {logged && <p className="small">Logged just now</p>}
            </>
          ) : (
            <p className="small">No hangouts logged yet. This one can be the first.</p>
          )}
        </div>
      </div>

      <SectionTitle>What you have in common</SectionTitle>
      {data.shared_interests.length > 0 ? (
        <div className="chips">
          {data.shared_interests.map((s, i) => (
            <span key={`${s}-${i}`} className="chip chip--shared">
              {s}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted small">Nothing in common recorded yet. A good thing to find out.</p>
      )}
      {others.length > 0 && (
        <div className="chips-line">
          <span className="muted small">{first} is also into</span>
          <div className="chips">
            {others.map((s, i) => (
              <span key={`${s}-${i}`} className="chip chip--plain">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <FollowUps bridge={bridge} friend={arg} name={first} initial={data.things_to_ask} />

      {data.conversation_starters.length > 0 && (
        <>
          <SectionTitle>Conversation starters</SectionTitle>
          <ul className="list list--tight">
            {data.conversation_starters.map((s, i) => (
              <li key={i}>
                <button type="button" className="starter" onClick={() => void copyStarter(i, s)}>
                  <span className="starter__quote" aria-hidden="true">
                    “
                  </span>
                  <span className="starter__text">{s}</span>
                  <span className="starter__copy">{copied === i ? "✓ Copied" : "Copy"}</span>
                </button>
              </li>
            ))}
          </ul>
          <span className="sr-only" role="status">
            {copied !== null ? "Copied to clipboard" : ""}
          </span>
          {copyFailed && (
            <p className="hint" role="status">
              Couldn't copy from here. Select the line and copy it yourself.
            </p>
          )}
        </>
      )}

      {isPerson
        ? data.notes && (
            <div className="note-box">
              <span className="field__label">Your notes</span>
              <p>{data.notes}</p>
            </div>
          )
        : data.shared_memories.length > 0 && (
            <>
              <SectionTitle count={data.shared_memories.length}>What {first} shared with you</SectionTitle>
              <ul className="list list--tight">
                {data.shared_memories.map((m, i) => (
                  <li key={i} className="shared-memory">
                    <span className={`cat-icon cat--${m.category.toLowerCase()}`} title={CATEGORY_LABELS[m.category]} aria-hidden="true">
                      {CATEGORY_ICONS[m.category]}
                    </span>
                    <div>
                      <strong>{m.title}</strong>
                      <span className="sr-only"> ({CATEGORY_LABELS[m.category]})</span>
                      {m.description && <p className="muted small">{m.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

      <div className="button-row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void action.run("ideas", () => nav.openView("heldly_suggest_activity", arg))}
        >
          {action.busy === "ideas" ? "Loading…" : "Get ideas"}
        </button>
        {logged ? (
          <span className="status-pill status-pill--grow" role="status">
            ✓ Hangout logged
          </span>
        ) : (
          <button type="button" className="btn" disabled={busy} onClick={metUp}>
            {action.busy === "log" ? "Logging…" : "We met up"}
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void action.run("open", () => nav.openView("heldly_view_friend", arg))}
        >
          {action.busy === "open" ? "Opening…" : `Open ${first}`}
        </button>
      </div>

      {data.note && <p className="muted small footnote">{data.note}</p>}
    </section>
  );
}
