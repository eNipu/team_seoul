import { useState } from "react";
import { friendArg, parseLogInteraction, type ActivityIdeasViewData } from "../types";
import { ActionError, ChatStatus, EmptyNote, useAction, useChatPrompt, type ViewProps } from "./common";

export default function ActivityIdeas({ data, bridge }: ViewProps<ActivityIdeasViewData>) {
  const action = useAction();
  const chat = useChatPrompt(bridge);
  const [logged, setLogged] = useState<number[]>([]);
  const [planned, setPlanned] = useState<number | null>(null);

  const percent = Math.round(data.match_score * 100);
  const busy = action.busy !== null;

  function plan(index: number, title: string) {
    setPlanned(index);
    void chat.send(`Help me plan "${title}" with ${data.display_name}. I will reach out myself.`);
  }

  function didThis(index: number, title: string) {
    void action.run(`log-${index}`, async () => {
      const res = await bridge.callTool("heldly_log_interaction", { ...friendArg(data.kind, data.id), activity: title });
      if (!res.ok) return res.errorText;
      if (!parseLogInteraction(res.data).recorded) return "Heldly couldn't log that.";
      setLogged((l) => [...l, index]);
      return null;
    });
  }

  return (
    <section className="panel">
      <h2>Ideas with {data.display_name}</h2>

      {data.shared_interests.length > 0 ? (
        <div className="chips" aria-label="Shared interests">
          {data.shared_interests.map((s, i) => (
            <span key={`${s}-${i}`} className="chip chip--shared">
              {s}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted small">No shared interests yet, so these are general ideas.</p>
      )}

      <div className="meter-block">
        <div className="row row--between">
          <span className="small muted" id="match-label">
            Match
          </span>
          <strong className="small">{percent}%</strong>
        </div>
        <div
          className="meter"
          role="progressbar"
          aria-labelledby="match-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="meter__fill" style={{ width: `${percent}%` }} />
        </div>
        {data.score_explanation.length > 0 && (
          <details className="details">
            <summary>Why this score?</summary>
            <ul className="bullets">
              {data.score_explanation.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <ActionError action={action} />

      {data.suggestions.length === 0 ? (
        <EmptyNote icon="🌱" title="No ideas yet">
          Tell Heldly a bit more about what you both enjoy and ask again.
        </EmptyNote>
      ) : (
        <ul className="list">
          {data.suggestions.map((s, i) => {
            const isLogged = logged.includes(i);
            return (
              <li key={i} className="card">
                <strong className="card__title">{s.title}</strong>
                {s.description && <p>{s.description}</p>}
                {s.grounded_in.length > 0 && <p className="muted small">Based on: {s.grounded_in.join(", ")}</p>}
                {s.suggested_action && (
                  <p className="next-step">
                    <span aria-hidden="true">→ </span>
                    {s.suggested_action}
                  </p>
                )}
                <div className="card__actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--small"
                    disabled={chat.state === "sending"}
                    onClick={() => plan(i, s.title)}
                  >
                    {chat.state === "sending" && planned === i ? "Asking…" : "Plan it"}
                  </button>
                  {isLogged ? (
                    <span className="status-pill" role="status">
                      ✓ Logged
                    </span>
                  ) : (
                    <button type="button" className="btn btn--small" disabled={busy} onClick={() => didThis(i, s.title)}>
                      {action.busy === `log-${i}` ? "Logging…" : "We did this"}
                    </button>
                  )}
                </div>
                {planned === i && <ChatStatus state={chat.state} prompt={chat.prompt} />}
              </li>
            );
          })}
        </ul>
      )}

      {data.note && <p className="muted small footnote">{data.note}</p>}
    </section>
  );
}
