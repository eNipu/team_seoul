import { useState } from "react";
import { LIMITS, type WelcomeViewData } from "../types";
import ErrorBanner from "./ErrorBanner";
import { ActionError, useAction, type ViewProps } from "./common";

const SETUP_PROMPT = "Let's set up Heldly. Ask me a few questions about my interests and the people I want to stay close to.";

const POINTS: { icon: string; title: string; text: string }[] = [
  { icon: "🔒", title: "Remembers only what you approve", text: "Nothing is saved until you say yes." },
  { icon: "🤝", title: "Helps you stay close to friends", text: "Gentle nudges and ideas for time together." },
  { icon: "✋", title: "Never contacts anyone for you", text: "You always reach out yourself." },
];

type Phase = "choosing" | "starting" | "started" | "unavailable";

export default function Welcome({ data, bridge, nav }: ViewProps<WelcomeViewData>) {
  const action = useAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("choosing");
  const [error, setError] = useState<string | null>(null);

  const atLimit = selected.length >= LIMITS.goals;
  const toggle = (value: string) =>
    setSelected((cur) =>
      cur.includes(value) ? cur.filter((v) => v !== value) : cur.length >= LIMITS.goals ? cur : [...cur, value],
    );

  async function start() {
    if (phase === "starting" || action.busy !== null) return;
    setPhase("starting");
    setError(null);
    if (selected.length > 0) {
      const res = await bridge.callTool("heldly_update_profile", { social_goals: selected });
      // Not fatal: the chat set-up can still go ahead, but tell the user.
      if (!res.ok) setError(res.errorText);
    }
    const sent = await bridge.sendMessage(SETUP_PROMPT);
    setPhase(sent ? "started" : "unavailable");
  }

  const name = data.display_name.trim();

  if (phase === "started" || phase === "unavailable") {
    return (
      <section className="panel empty">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <div className="empty__art" aria-hidden="true">💬</div>
        <p className="empty__title">Great, tell me about yourself in the chat</p>
        {phase === "started" ? (
          <p className="muted">Heldly will ask a few questions there. You approve everything before it's saved.</p>
        ) : (
          <p className="muted">Start by typing in the chat: “{SETUP_PROMPT}”</p>
        )}
      </section>
    );
  }

  const busy = phase === "starting" || action.busy !== null;

  return (
    <section className="panel welcome">
      <div className="welcome__hero">
        <span className="welcome__art" aria-hidden="true">♡</span>
        <h2>{name ? `Welcome to Heldly, ${name}` : "Welcome to Heldly"}</h2>
        <p className="muted">A companion that helps you keep the people you care about close.</p>
      </div>

      <ul className="points">
        {POINTS.map((p) => (
          <li key={p.title} className="point">
            <span className="point__icon" aria-hidden="true">{p.icon}</span>
            <div>
              <strong>{p.title}</strong>
              <p className="muted small">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <ActionError action={action} />

      <div className="offer">
        <div className="offer__body">
          <strong>Already told ChatGPT about yourself?</strong>
          <p className="muted small">Start with what ChatGPT already knows about you. You choose what comes over.</p>
        </div>
        <button
          type="button"
          className="btn btn--block"
          disabled={busy}
          onClick={() => void action.run("import", () => nav.openView("heldly_import_chatgpt_memory", {}))}
        >
          {action.busy === "import" ? "Opening…" : "Import my ChatGPT memory"}
        </button>
      </div>

      {data.goal_options.length > 0 && (
        <fieldset className="goal-picker" disabled={busy}>
          <legend>What brings you here?</legend>
          <p className="muted small">Pick any that fit{atLimit ? ` (up to ${LIMITS.goals})` : ""}. You can change this later.</p>
          <div className="chips">
            {data.goal_options.map((g) => {
              const on = selected.includes(g.value);
              return (
                <button
                  key={g.value}
                  type="button"
                  className={`chip chip--toggle ${on ? "chip--on" : ""}`}
                  aria-pressed={on}
                  disabled={!on && atLimit}
                  onClick={() => toggle(g.value)}
                >
                  <span aria-hidden="true">{on ? "✓" : "+"}</span>
                  {g.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="actions">
        <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={() => void start()}>
          {phase === "starting" ? "Getting started…" : "Get started"}
        </button>
      </div>
    </section>
  );
}
