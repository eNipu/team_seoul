import { useEffect, useRef, useState } from "react";
import {
  CATEGORY_LABELS,
  friendArg,
  parseLogInteraction,
  type BriefViewData,
} from "../types";
import { ActionError, copyText, useAction, type ViewProps } from "./common";
import { Icon } from "./icons";
import "./cards.css";
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


  const sharedKeys = new Set(data.shared_interests.map((s) => s.toLowerCase()));
  const others = data.interests.filter((i) => !sharedKeys.has(i.toLowerCase()));

  function metUp() {
    void action.run("log", async () => {
      const res = await bridge.callTool("venn_log_interaction", arg);
      if (!res.ok) return res.errorText;
      if (!parseLogInteraction(res.data).recorded) return "Venn couldn't log that.";
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

  const [lead, ...moreStarters] = data.conversation_starters;
  const common = data.shared_interests.join(", ");

  function Starter({ text, index, lead: isLead }: { text: string; index: number; lead?: boolean }) {
    return (
      <button type="button" className={isLead ? "vc__moment" : "vc__pick"} style={isLead ? { border: 0, textAlign: "left", font: "inherit", cursor: "pointer", width: "100%" } : undefined}
        onClick={() => void copyStarter(index, text)}>
        {isLead ? <p>“{text}”</p> : <span>“{text}”</span>}
        {copied === index ? <small>Copied</small> : <span className="sr-only">Copy</span>}
      </button>
    );
  }

  return (
    <section className="vc">
      <h2 className="vc__title">Before you see {first}</h2>
      {common && <p className="vc__muted">You both like {common}.</p>}

      <ActionError action={action} />

      {lead && <Starter text={lead} index={0} lead />}
      <span className="sr-only" role="status">
        {copied !== null ? "Copied to clipboard" : ""}
      </span>
      {copyFailed && (
        <p className="vc__muted" role="status">
          Couldn't copy from here. Select the line and copy it yourself.
        </p>
      )}

      <button
        type="button"
        className="vc__cta"
        disabled={busy}
        onClick={() => void action.run("ideas", () => nav.openView("venn_suggest_activity", arg))}
      >
        {action.busy === "ideas" ? "Loading…" : "Plan time together"}
      </button>

      <details className="vc__more">
        <summary>More about {first}</summary>
        <div className="vc__more-body">
          <FollowUps bridge={bridge} friend={arg} name={first} initial={data.things_to_ask} />
          {moreStarters.length > 0 && (
            <ul className="vc__picks" aria-label="More conversation starters">
              {moreStarters.map((s, i) => <li key={i}><Starter text={s} index={i + 1} /></li>)}
            </ul>
          )}
          {others.length > 0 && <p className="vc__muted">{first} is also into {others.join(", ")}.</p>}
          {isPerson
            ? data.notes && (
                <div className="vc__quiet">
                  <span className="vc__muted">Your notes</span>
                  <p className="vc__body">{data.notes}</p>
                </div>
              )
            : data.shared_memories.length > 0 && (
                <ul className="vc__list" aria-label={`What ${first} shared with you`}>
                  {data.shared_memories.map((m, i) => (
                    <li key={i}>
                      <strong>{m.title}</strong>
                      <span className="sr-only"> ({CATEGORY_LABELS[m.category]})</span>
                      {m.description && <span className="vc__muted" style={{ display: "block" }}>{m.description}</span>}
                    </li>
                  ))}
                </ul>
              )}
          <div className="vc__actions">
          {logged ? (
            <span className="vc__done" role="status">
              <Icon name="check" size={16} /> Hangout logged
            </span>
          ) : (
            <button type="button" className="vc__link" disabled={busy} onClick={metUp}>
              {action.busy === "log" ? "Logging…" : "We met up"}
            </button>
          )}
          <button
            type="button"
            className="vc__link"
            disabled={busy}
            onClick={() => void action.run("open", () => nav.openView("venn_view_friend", arg))}
          >
            {action.busy === "open" ? "Opening…" : `Open ${first}`}
          </button>
          </div>
          {data.note && <p className="vc__muted">{data.note}</p>}
        </div>
      </details>
    </section>
  );
}
