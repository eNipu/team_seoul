import { useState } from "react";
import { friendArg, parseLogInteraction, type ActivityIdeasViewData } from "../types";
import { ActionError, Avatar, ChatStatus, EmptyNote, Ring, useAction, useChatPrompt, type ViewProps } from "./common";
import { Icon } from "./icons";
import CalendarPicker from "./CalendarPicker";

export default function ActivityIdeas({ data, bridge }: ViewProps<ActivityIdeasViewData>) {
  const action = useAction();
  const chat = useChatPrompt(bridge);
  const [logged, setLogged] = useState<number[]>([]);
  const [planned, setPlanned] = useState<number | null>(null);
  const [calendar, setCalendar] = useState<number | null>(null);

  const percent = Math.round(data.match_score * 100);
  const busy = action.busy !== null;

  function plan(index: number, title: string) {
    setPlanned(index);
    void chat.send(`Help me plan "${title}" with ${data.display_name}. I will reach out myself.`);
  }

  function didThis(index: number, title: string) {
    void action.run(`log-${index}`, async () => {
      const res = await bridge.callTool("venn_log_interaction", { ...friendArg(data.kind, data.id), activity: title });
      if (!res.ok) return res.errorText;
      if (!parseLogInteraction(res.data).recorded) return "Venn couldn't log that.";
      setLogged((l) => [...l, index]);
      return null;
    });
  }

  return (
    <section className="panel">
      <div className="person-head">
        <Avatar name={data.display_name} />
        <div className="person-head__body">
          <p className="eyebrow">Time together</p>
          <h2>Ideas with {data.display_name}</h2>
        </div>
      </div>

      <div className="match">
        <div className="match__head">
          <div
            className="match__gauge"
            role="meter"
            aria-label="Match"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}%`}
          >
            <Ring ratio={data.match_score} label={`${percent}%`} size={60} />
          </div>
          <div className="match__body">
            <strong>Match</strong>
            {data.shared_interests.length > 0 ? (
              <div className="chips" aria-label="Shared interests">
                {data.shared_interests.map((s, i) => (
                  <span key={`${s}-${i}`} className="chip chip--shared">
                    <Icon name="star" size={12} />
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted small">No shared interests yet, so these are general ideas.</p>
            )}
          </div>
        </div>
        {data.score_explanation.length > 0 && (
          <details className="details">
            <summary>
              <Icon name="chevron-right" size={16} />
              Why this score?
            </summary>
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
        <EmptyNote art="ideas" title="No ideas yet">
          Tell Venn a bit more about what you both enjoy and ask again.
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
                    <Icon name="arrow-right" size={16} />
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
                    <Icon name="chat" size={16} />
                    {chat.state === "sending" && planned === i ? "Asking…" : "Plan it"}
                  </button>
                  {isLogged ? (
                    <span className="status-pill" role="status">
                      <Icon name="check" size={16} /> Logged
                    </span>
                  ) : (
                    <button type="button" className="btn btn--small" disabled={busy} onClick={() => didThis(i, s.title)}>
                      {action.busy === `log-${i}` ? "Logging…" : "We did this"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    aria-expanded={calendar === i}
                    onClick={() => setCalendar(calendar === i ? null : i)}
                  >
                    <Icon name="calendar" size={16} />
                    Add to calendar
                  </button>
                </div>
                {calendar === i && (
                  <CalendarPicker
                    bridge={bridge}
                    title={data.display_name ? `${s.title} with ${data.display_name}` : s.title}
                    details={s.description}
                    onClose={() => setCalendar(null)}
                  />
                )}
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
