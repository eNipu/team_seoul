// The help card: what Venn can do, with things to say that start each task.

import { useState } from "react";
import type { HelpTopic, HelpViewData } from "../types";
import { ChatFallback, type ViewProps } from "./common";
import { Icon, Illustration, type IconName } from "./icons";
import SetupCard from "./Setup";

const TOPIC_ICONS: Record<string, IconName> = {
  setup: "flag",
  memories: "bookmark",
  people: "note",
  connect: "user-plus",
  stay_close: "heart",
  quiz: "dice",
  privacy: "lock",
};

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

  return (
    <>
      <section className="panel">
        <div className="hero hero--row">
          <Illustration name="help" size="sm" />
          <div>
            <h2>How Venn helps</h2>
            <p className="muted small">
              Venn remembers what matters to you and helps you stay close to your people. Pick something to try, or just ask in
              the chat.
            </p>
          </div>
        </div>
      </section>

      <SetupCard steps={data.setup} bridge={bridge} nav={nav} />

      <section className="panel">
        <h3 className="section-title">What you can do</h3>
        <ul className="list topics">
          {data.topics.map((t, i) => (
            <Topic key={`${t.key}-${i}`} topic={t} index={i} states={examples} disabled={sending} onTry={tryIt} />
          ))}
        </ul>

        {data.privacy.length > 0 && (
          <div className="privacy">
            <h3 className="section-title">Your data</h3>
            <ul className="privacy__list">
              {data.privacy.map((p, i) => (
                <li key={i}>
                  <Icon name="shield" size={16} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
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
  const failed = topic.examples.map((text, j) => ({ text, id: `${index}:${j}` })).filter((e) => states[e.id] === "failed");
  return (
    <li className="topic">
      <span className="topic__icon" aria-hidden="true">
        <Icon name={TOPIC_ICONS[topic.key] ?? "sparkle"} />
      </span>
      <div className="topic__body">
        <h4 className="topic__title">{topic.title}</h4>
        {topic.description && <p className="muted small">{topic.description}</p>}
        {topic.examples.length > 0 && (
          <ul className="try-list" aria-label={`Try it: ${topic.title}`}>
            {topic.examples.map((text, j) => {
              const id = `${index}:${j}`;
              const state = states[id];
              return (
                <li key={id}>
                  {state === "sent" ? (
                    <span className="try try--sent" role="status">
                      <Icon name="check" size={16} />
                      <span>Sent — continue in the chat</span>
                    </span>
                  ) : (
                    <button type="button" className="try" disabled={disabled} onClick={() => void onTry(id, text)}>
                      <Icon name="chat" size={16} />
                      <span>{state === "sending" ? "Sending…" : `“${text}”`}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {failed.map((e) => (
          <ChatFallback key={e.id} text={e.text} />
        ))}
      </div>
    </li>
  );
}
