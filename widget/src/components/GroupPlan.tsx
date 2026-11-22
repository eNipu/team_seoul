import { useState } from "react";
import { firstName, joinNames, type GroupPlanViewData } from "../types";
import { ChatStatus, useChatPrompt, type ViewProps } from "./common";
import { IdeaList, PlanTools } from "./PlanTools";
import "./cards.css";

export default function GroupPlan({ data, bridge }: ViewProps<GroupPlanViewData>) {
  const chat = useChatPrompt(bridge);
  const [planned, setPlanned] = useState<number | null>(null);

  const names = data.members.map((m) => firstName(m.display_name));
  const everyone = joinNames(names);

  function plan(index: number, title: string) {
    setPlanned(index);
    void chat.send(`Help me plan "${title}" with ${everyone}. I will reach out to everyone myself.`);
  }

  return (
    <section className="vc">
      <h2 className="vc__title">You{everyone ? `, ${everyone}` : ""}</h2>
      <p className="vc__muted">
        {data.common_to_all.length > 0
          ? `Everyone's into ${data.common_to_all.join(", ")}.`
          : "No single thing everyone shares yet."}
      </p>

      {data.suggestions.length === 0 ? (
        <p className="vc__muted">No ideas yet. Add a few interests for each friend and ask again.</p>
      ) : (
        <IdeaList
          ideas={data.suggestions}
          actions={(s, i) => (
            <>
              <PlanTools
                quiet
                bridge={bridge}
                title={s.title}
                details={s.description}
                calendarTitle={everyone ? `${s.title} with ${everyone}` : s.title}
                friends={data.members.map((m) => ({ kind: m.kind, id: m.id }))}
              >
                <button
                  type="button"
                  className="vc__cta"
                  disabled={chat.state === "sending"}
                  onClick={() => plan(i, s.title)}
                >
                  {chat.state === "sending" && planned === i ? "Asking…" : "Plan it"}
                </button>
              </PlanTools>
              {planned === i && <ChatStatus state={chat.state} prompt={chat.prompt} />}
            </>
          )}
        />
      )}

      {(data.common_to_some.length > 0 || data.note) && (
        <details className="vc__more">
          <summary>What some of you share</summary>
          <div className="vc__more-body">
            <ul className="vc__list">
              {data.common_to_some.map((o, i) => (
                <li key={`${o.interest}-${i}`}>
                  <strong>{o.interest}</strong>
                  <span className="vc__muted"> · {joinNames(o.members.map((n) => (n === "You" ? n : firstName(n))))}</span>
                </li>
              ))}
            </ul>
            {data.note && <p className="vc__muted">{data.note}</p>}
          </div>
        </details>
      )}
    </section>
  );
}
