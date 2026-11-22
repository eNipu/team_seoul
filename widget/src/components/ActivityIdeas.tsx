import { useState } from "react";
import { friendArg, parseLogInteraction, type ActivityIdeasViewData } from "../types";
import { ActionError, ChatStatus, useAction, useChatPrompt, type ViewProps } from "./common";
import { Icon } from "./icons";
import { IdeaList, PlanTools } from "./PlanTools";
import "./cards.css";

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
      const res = await bridge.callTool("venn_log_interaction", { ...friendArg(data.kind, data.id), activity: title });
      if (!res.ok) return res.errorText;
      if (!parseLogInteraction(res.data).recorded) return "Venn couldn't log that.";
      setLogged((l) => [...l, index]);
      return null;
    });
  }

  const first = data.display_name.trim().split(/\s+/)[0] || data.display_name;

  return (
    <section className="vc">
      <h2 className="vc__title">Ideas with {first}</h2>
      {data.shared_interests.length > 0 && <p className="vc__muted">You both like {data.shared_interests.join(", ")}.</p>}

      <ActionError action={action} />

      {data.suggestions.length === 0 ? (
        <p className="vc__muted">No ideas yet. Tell Venn a bit more about what you both enjoy and ask again.</p>
      ) : (
        <IdeaList
          ideas={data.suggestions}
          actions={(s, i) => (
            <>
              <PlanTools
                quiet
                more={
                  logged.includes(i) ? (
                    <span className="vc__done" role="status">
                      <Icon name="check" size={16} /> Logged
                    </span>
                  ) : (
                    <button type="button" className="vc__link" disabled={busy} onClick={() => didThis(i, s.title)}>
                      {action.busy === `log-${i}` ? "Logging…" : "We did this"}
                    </button>
                  )
                }
                bridge={bridge}
                title={s.title}
                details={s.description}
                calendarTitle={data.display_name ? `${s.title} with ${data.display_name}` : s.title}
                friends={[{ kind: data.kind, id: data.id }]}
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

      <details className="vc__more">
        <summary>Why these ideas</summary>
        <div className="vc__more-body">
          <p
            className="vc__body"
            role="meter"
            aria-label="Match"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}%`}
          >
            <strong>{percent}% match</strong>
          </p>
          {data.score_explanation.length > 0 && (
            <ul className="vc__list">
              {data.score_explanation.map((line, i) => (
                <li key={i} className="vc__muted">{line}</li>
              ))}
            </ul>
          )}
          {data.note && <p className="vc__muted">{data.note}</p>}
        </div>
      </details>
    </section>
  );
}
