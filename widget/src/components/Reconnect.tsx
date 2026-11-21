import { useState } from "react";
import { friendArg, parseLogInteraction, plural, type ReconnectCandidate, type ReconnectViewData } from "../types";
import { ActionError, Avatar, ChatStatus, EmptyNote, useAction, useChatPrompt, type ViewProps } from "./common";

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
    void action.run(`ideas-${keyOf(c)}`, () => nav.openView("heldly_suggest_activity", friendArg(c.kind, c.id)));
  }

  function draft(c: ReconnectCandidate) {
    setDrafted(keyOf(c));
    void chat.send(`Help me draft a short, warm message to reconnect with ${c.display_name}. I will send it myself.`);
  }

  function metUp(c: ReconnectCandidate) {
    void action.run(`log-${keyOf(c)}`, async () => {
      const res = await bridge.callTool("heldly_log_interaction", friendArg(c.kind, c.id));
      if (!res.ok) return res.errorText;
      if (!parseLogInteraction(res.data).recorded) return "Heldly couldn't log that.";
      setLogged((l) => [...l, keyOf(c)]);
      return null;
    });
  }

  return (
    <section className="panel">
      <h2>Time to reconnect</h2>
      {data.candidates.length > 0 && (
        <p className="muted small lead">
          {data.min_days > 0
            ? `Friends you haven't seen in ${plural(data.min_days, "day", "days")} or more.`
            : "Friends you haven't seen in a while."}
        </p>
      )}

      <ActionError action={action} />

      {done.length > 0 && (
        <ul className="list list--tight" aria-label="Logged">
          {done.map((c) => (
            <li key={keyOf(c)} className="logged-row" role="status">
              <span aria-hidden="true">✓</span> Logged. Nice that you met up with {c.display_name}.
            </li>
          ))}
        </ul>
      )}

      {remaining.length === 0 ? (
        <EmptyNote icon="🌤️" title="You're all caught up">
          You've seen everyone recently. Enjoy it, and check back in a while.
        </EmptyNote>
      ) : (
        <ul className="list">
          {remaining.map((c) => {
            const k = keyOf(c);
            return (
              <li key={k} className="card">
                <div className="person-head">
                  <Avatar name={c.display_name} />
                  <div className="person-head__body">
                    <div className="row row--wrap">
                      <strong className="card__title">{c.display_name}</strong>
                      <span className={`badge ${c.kind === "connection" ? "badge--on" : "badge--note"}`}>
                        {c.kind === "connection" ? "On Heldly" : "Private note"}
                      </span>
                    </div>
                    <span className="muted small">
                      {plural(c.days_since_last_interaction, "day", "days")} since you last met
                      {c.last_activity ? ` · Last time: ${c.last_activity}` : ""}
                    </span>
                  </div>
                </div>
                {c.reason && <p>{c.reason}</p>}
                {c.suggested_activity && (
                  <p className="next-step">
                    <span aria-hidden="true">💡 </span>Idea: {c.suggested_activity}
                  </p>
                )}
                <div className="card__actions">
                  <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => ideas(c)}>
                    {action.busy === `ideas-${k}` ? "Loading…" : "Get ideas"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={chat.state === "sending"}
                    onClick={() => draft(c)}
                  >
                    {chat.state === "sending" && drafted === k ? "Asking…" : "Draft a message"}
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => metUp(c)}>
                    {action.busy === `log-${k}` ? "Logging…" : "We met up"}
                  </button>
                </div>
                {drafted === k && <ChatStatus state={chat.state} prompt={chat.prompt} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
