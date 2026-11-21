import { useState } from "react";
import { joinNames, type GroupPlanViewData } from "../types";
import { Avatar, ChatStatus, EmptyNote, SectionTitle, useChatPrompt, type ViewProps } from "./common";
import { Icon } from "./icons";
import CalendarPicker from "./CalendarPicker";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export default function GroupPlan({ data, bridge }: ViewProps<GroupPlanViewData>) {
  const chat = useChatPrompt(bridge);
  const [planned, setPlanned] = useState<number | null>(null);
  const [calendar, setCalendar] = useState<number | null>(null);

  const names = data.members.map((m) => firstName(m.display_name));
  const everyone = joinNames(names);

  function plan(index: number, title: string) {
    setPlanned(index);
    void chat.send(`Help me plan "${title}" with ${everyone}. I will reach out to everyone myself.`);
  }

  return (
    <section className="panel">
      <div className="group-head">
        <div className="avatar-stack" aria-hidden="true">
          <span className="avatar avatar--you">You</span>
          {data.members.map((m, i) => (
            <Avatar key={`${m.kind}:${m.id}:${i}`} name={m.display_name} />
          ))}
        </div>
        <div>
          <p className="eyebrow">Group hangout</p>
          <h2>You{everyone ? `, ${everyone}` : ""}</h2>
        </div>
      </div>

      <div className={`spotlight ${data.common_to_all.length === 0 ? "spotlight--quiet" : ""}`}>
        {data.common_to_all.length > 0 ? (
          <>
            <span className="spotlight__label">
              <Icon name="sparkle" size={16} /> Everyone's into
            </span>
            <div className="chips">
              {data.common_to_all.map((s, i) => (
                <span key={`${s}-${i}`} className="chip chip--big">
                  {s}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="small">No single thing everyone shares yet — here's what overlaps</p>
        )}
      </div>

      {data.common_to_some.length > 0 && (
        <>
          <SectionTitle>Some of you share</SectionTitle>
          <ul className="list overlap-list">
            {data.common_to_some.map((o, i) => (
              <li key={`${o.interest}-${i}`} className="overlap">
                <span className="chip chip--plain">{o.interest}</span>
                <span className="overlap__who">
                  <span className="avatar-stack avatar-stack--small" aria-hidden="true">
                    {o.members.map((n, j) =>
                      n === "You" ? (
                        <span key={j} className="avatar avatar--small avatar--you">
                          You
                        </span>
                      ) : (
                        <Avatar key={j} name={n} size="small" />
                      ),
                    )}
                  </span>
                  <span className="muted small">{joinNames(o.members.map((n) => (n === "You" ? n : firstName(n))))}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle count={data.suggestions.length}>Ideas for the group</SectionTitle>
      {data.suggestions.length === 0 ? (
        <EmptyNote art="ideas" title="No ideas yet">
          Add a few interests for each friend and ask again.
        </EmptyNote>
      ) : (
        <ul className="list">
          {data.suggestions.map((s, i) => (
            <li key={i} className="card">
              <strong className="card__title">{s.title}</strong>
              {s.description && <p>{s.description}</p>}
              {s.grounded_in.length > 0 && <p className="muted small">Based on: {s.grounded_in.join(", ")}</p>}
              {s.suggested_action && (
                <p className="next-step">
                  <Icon name="arrow-right" size={16} />
                  <span>{s.suggested_action}</span>
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
                <button
                  type="button"
                  className="btn btn--small"
                  aria-expanded={calendar === i}
                  onClick={() => setCalendar(calendar === i ? null : i)}
                >
                  <Icon name="calendar" size={16} /> Add to calendar
                </button>
              </div>
              {calendar === i && (
                <CalendarPicker
                  bridge={bridge}
                  title={everyone ? `${s.title} with ${everyone}` : s.title}
                  details={s.description}
                  onClose={() => setCalendar(null)}
                />
              )}
              {planned === i && <ChatStatus state={chat.state} prompt={chat.prompt} />}
            </li>
          ))}
        </ul>
      )}

      {data.note && <p className="muted small footnote">{data.note}</p>}
    </section>
  );
}
