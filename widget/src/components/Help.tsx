// The help card: what Venn can do, with things to say that start each task.

import { useState } from "react";
import type { HelpTopic, HelpViewData } from "../types";
import { ChatFallback, type ViewProps } from "./common";
import { Icon } from "./icons";
import SetupCard from "./Setup";
import "./cards.css";

type ExampleState = "sending" | "sent" | "failed";

export default function Help({ data, bridge, nav }: ViewProps<HelpViewData>) {
  // Keyed by "<topic index>:<example index>"; states stay until the card is closed.
  const [examples, setExamples] = useState<Record<string, ExampleState>>({});
  const sending = Object.values(examples).includes("sending");

  async function tryIt(id: string, text: string) {
    setExamples((s) => ({ ...s, [id]: "sending" }));
    let ok = false;
    try {
      ok = await bridge.sendMessage(text);
    } catch {
      ok = false;
    }
    setExamples((s) => ({ ...s, [id]: ok ? "sent" : "failed" }));
  }

  const picks = data.topics
    .map((t, i) => ({ topic: t, id: `${i}:0`, text: t.examples[0] }))
    .filter((p) => p.text)
    .slice(0, 3);
  const failed = picks.filter((p) => examples[p.id] === "failed");

  // Help is one line and quiet links: the setup guide and every example sit one tap away, never stacked.
  const guide = data.onboarding && [data.onboarding.memories_ready, data.onboarding.contacts_ready, data.onboarding.matches_reviewed].some((r) => r !== true);
  return (
    <>
      <section className="vc">
        <h2 className="vc__title">Just ask Venn.</h2>
        <p className="vc__muted">Say what you need in the chat. Venn will tell you here when something matters.</p>
        {failed.map((e) => (
          <ChatFallback key={e.id} text={e.text} />
        ))}

        {guide && (
          <details className="vc__more">
            <summary>Getting started</summary>
            <SetupCard data={data} nav={nav} />
          </details>
        )}

        <details className="vc__more">
          <summary>Everything Venn can do</summary>
          <ul className="vc__items">
            {data.topics.map((t, i) => (
              <Topic key={`${t.key}-${i}`} topic={t} index={i} states={examples} disabled={sending} onTry={tryIt} />
            ))}
          </ul>
        </details>

        {data.privacy.length > 0 && (
          <details className="vc__more">
            <summary>Only you see what you save</summary>
            <ul className="vc__list">
              {data.privacy.map((p, i) => (
                <li key={i} className="vc__muted">{p}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </>
  );
}

function Topic({
  topic,
  index,
  states,
  disabled,
  onTry,
}: {
  topic: HelpTopic;
  index: number;
  states: Record<string, ExampleState>;
  disabled: boolean;
  onTry: (id: string, text: string) => Promise<void>;
}) {
  const failed = topic.examples.map((text, j) => ({ text, id: `${index}:${j}` })).filter((e) => j0(e.id) && states[e.id] === "failed");
  return (
    <li>
      <h3 className="vc__item-title">{topic.title}</h3>
      {topic.description && <p className="vc__muted">{topic.description}</p>}
      {topic.examples.length > 0 && (
        <div className="vc__actions" aria-label={`Try it: ${topic.title}`}>
          {topic.examples.map((text, j) => {
            const id = `${index}:${j}`;
            const state = states[id];
            return state === "sent" ? (
              <span key={id} className="vc__done" role="status">
                <Icon name="check" size={16} /> Sent
              </span>
            ) : (
              <button key={id} type="button" className="vc__link" style={{ textAlign: "left" }} disabled={disabled} onClick={() => void onTry(id, text)}>
                {state === "sending" ? "Sending…" : `“${text}”`}
              </button>
            );
          })}
        </div>
      )}
      {failed.map((e) => (
        <ChatFallback key={e.id} text={e.text} />
      ))}
    </li>
  );
}

// The first example of each topic already shows its fallback above the list.
function j0(id: string) {
  return !id.endsWith(":0");
}
