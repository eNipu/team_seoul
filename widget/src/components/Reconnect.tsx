import { useState } from "react";
import { friendArg, parseLogInteraction, plural, type ReconnectCandidate, type ReconnectViewData } from "../types";
import { ActionError, ChatStatus, useAction, useChatPrompt, type ViewProps } from "./common";

const keyOf = (c: ReconnectCandidate) => `${c.kind}:${c.id}`;

export default function Reconnect({ data, bridge, nav }: ViewProps<ReconnectViewData>) {
  const action = useAction();
  const chat = useChatPrompt(bridge);
  const [logged, setLogged] = useState<string[]>([]);
  const [drafted, setDrafted] = useState<string | null>(null);

  const busy = action.busy !== null;
  const remaining = data.candidates.filter((c) => !logged.includes(keyOf(c)));
  const done = data.candidates.filter((c) => logged.includes(keyOf(c)));

  function ideas(c: ReconnectCandidate) {
    void action.run(`ideas-${keyOf(c)}`, () => nav.openView("venn_suggest_activity", friendArg(c.kind, c.id)));
  }

  function draft(c: ReconnectCandidate) {
    setDrafted(keyOf(c));
    void chat.send(`Help me draft a short, warm message to reconnect with ${c.display_name}. I will send it myself.`);
  }

  function metUp(c: ReconnectCandidate) {
    void action.run(`log-${keyOf(c)}`, async () => {
      const res = await bridge.callTool("venn_log_interaction", friendArg(c.kind, c.id));
      if (!res.ok) return res.errorText;
      if (!parseLogInteraction(res.data).recorded) return "Venn couldn't log that.";
      setLogged((l) => [...l, keyOf(c)]);
      return null;
    });
  }

  const [at, setAt] = useState(0);

  if (remaining.length === 0) {
    return (
      <section className="onb">
        <h2 className="onb__title">{done.length > 0 ? "Nice. All caught up." : "You're all caught up."}</h2>
        <p className="onb__body">Venn will tell you when it's been a while.</p>
      </section>
    );
  }

  const c = remaining[at % remaining.length];
  const k = keyOf(c);
  const next = remaining.length > 1 ? remaining[(at + 1) % remaining.length] : null;
  const first = c.display_name.split(/\s+/)[0];
  return (
    <section className="onb" aria-label="Time to reconnect">
      {done.length > 0 && <p className="onb__done" role="status">Logged. Nice that you met up with {done[done.length - 1].display_name}.</p>}
      <h2 className="onb__title">See {first} soon.</h2>
      <p className="onb__body">
        {c.last_activity ? `Last time: ${c.last_activity}, ` : "Last time: "}{plural(c.days_since_last_interaction, "day", "days")} ago.
      </p>
      {c.suggested_activity && (
        <div className="onb__moment">
          <p>{c.suggested_activity}</p>
          {c.reason && <small>{c.reason}</small>}
        </div>
      )}
      <ActionError action={action} />
      <button type="button" className="onb__cta" disabled={chat.state === "sending"} onClick={() => draft(c)}>
        {chat.state === "sending" && drafted === k ? "Asking…" : "Draft a message"}
      </button>
      {drafted === k && <ChatStatus state={chat.state} prompt={chat.prompt} />}
      <div className="onb__row">
        {next ? <button type="button" className="onb__link" onClick={() => setAt(at + 1)}>Next: {next.display_name.split(/\s+/)[0]}</button> : <span />}
        <details className="onb__more">
          <summary>More</summary>
          <div className="onb__more-body">
            <button type="button" className="btn btn--block" disabled={busy} onClick={() => ideas(c)}>
              {action.busy === `ideas-${k}` ? "Loading…" : "Get ideas"}
            </button>
            <button type="button" className="btn btn--block" disabled={busy} onClick={() => metUp(c)}>
              {action.busy === `log-${k}` ? "Logging…" : "We met up"}
            </button>
          </div>
        </details>
      </div>
    </section>
  );
}
