// The set-up ("onboarding") card: three steps, the first open one emphasised.
// Shown on the dashboard and the help card while any step is open; the welcome
// card draws the same steps as a numbered path (see Welcome.tsx).

import { useState } from "react";
import type { HostBridge } from "../mcp/client";
import type { SetupKey, SetupStep } from "../types";
import { ActionError, ChatFallback, Ring, useAction, type Nav } from "./common";
import { Icon, type IconName } from "./icons";

export const ABOUT_YOU_PROMPT = "Let's set up Heldly. Ask me a few questions about what I enjoy and what I like to avoid.";
export const YOUR_PEOPLE_PROMPT =
  "I'd like to add my friends to Heldly. I'll paste a list, upload a contacts file, or just tell you about them.";

type StepAction =
  | { id: string; label: string; busyLabel: string; icon: IconName; tool: string }
  | { id: string; label: string; busyLabel: string; icon: IconName; prompt: string };

const STEP_ACTIONS: Record<SetupKey, StepAction[]> = {
  about_you: [
    { id: "import", label: "Import from ChatGPT", busyLabel: "Opening…", icon: "import", tool: "heldly_import_chatgpt_memory" },
    { id: "questions", label: "Answer a few questions", busyLabel: "Asking…", icon: "chat", prompt: ABOUT_YOU_PROMPT },
  ],
  your_people: [{ id: "people", label: "Add your people", busyLabel: "Asking…", icon: "users", prompt: YOUR_PEOPLE_PROMPT }],
  connect: [{ id: "invite", label: "Invite a friend", busyLabel: "Creating code…", icon: "user-plus", tool: "heldly_create_invite" }],
};

type Sent = { key: SetupKey; ok: true } | { key: SetupKey; ok: false; text: string };

/** Runs a step's actions and remembers how the last chat hand-off went. */
export function useSetupActions(bridge: HostBridge, nav: Nav) {
  const action = useAction();
  const [sent, setSent] = useState<Sent | null>(null);

  function run(key: SetupKey, a: StepAction) {
    void action.run(`${key}:${a.id}`, async () => {
      if ("tool" in a) return nav.openView(a.tool, {});
      let ok = false;
      try {
        ok = await bridge.sendMessage(a.prompt);
      } catch {
        ok = false;
      }
      setSent(ok ? { key, ok: true } : { key, ok: false, text: a.prompt });
      return null;
    });
  }

  return { action, sent, run };
}

/** Buttons for one step, plus the "continue in the chat" / copy fallback underneath. */
export function StepActions({
  step,
  emphasis,
  setup,
}: {
  step: SetupStep;
  /** The first open step gets the card's primary button. */
  emphasis: boolean;
  setup: ReturnType<typeof useSetupActions>;
}) {
  const { action, sent, run } = setup;
  const mine = sent?.key === step.key ? sent : null;
  return (
    <>
      <div className="setup-step__actions">
        {STEP_ACTIONS[step.key].map((a, i) => {
          const id = `${step.key}:${a.id}`;
          const primary = emphasis && i === 0;
          return (
            <button
              key={a.id}
              type="button"
              className={`btn ${primary ? "btn--primary" : ""} ${emphasis ? "" : "btn--small"}`}
              disabled={action.busy !== null}
              onClick={() => run(step.key, a)}
            >
              <Icon name={a.icon} size={18} />
              {action.busy === id ? a.busyLabel : a.label}
            </button>
          );
        })}
      </div>
      {mine?.ok === true && (
        <p className="hint hint--ok" role="status">
          <Icon name="chat" size={16} /> Continue in the chat
        </p>
      )}
      {mine?.ok === false && <ChatFallback text={mine.text} />}
    </>
  );
}

interface Props {
  steps: SetupStep[];
  bridge: HostBridge;
  nav: Nav;
}

export default function SetupCard({ steps, bridge, nav }: Props) {
  const setup = useSetupActions(bridge, nav);
  const done = steps.filter((s) => s.done).length;
  if (steps.length === 0 || done === steps.length) return null;
  const firstOpen = steps.find((s) => !s.done);

  return (
    <section className="setup" aria-labelledby="setup-title">
      <div className="setup__head">
        <Ring ratio={done / steps.length} label={`${done}/${steps.length}`} />
        <div className="setup__head-text">
          <h2 id="setup-title" className="setup__title">
            Finish setting up
          </h2>
          <p className="muted small">
            {done} of {steps.length} done
          </p>
        </div>
      </div>
      <ol className="setup-steps">
        {steps.map((step, i) => {
          const current = step === firstOpen;
          return (
            <li
              key={step.key}
              className={`setup-step ${step.done ? "setup-step--done" : ""} ${current ? "setup-step--current" : ""}`}
              aria-current={current ? "step" : undefined}
            >
              <span className="setup-step__marker" aria-hidden="true">
                {step.done ? <Icon name="check" size={16} /> : i + 1}
              </span>
              <div className="setup-step__body">
                <p className="setup-step__title">
                  {step.title}
                  {step.done && <span className="sr-only"> (done)</span>}
                </p>
                {!step.done && step.description && <p className="muted small">{step.description}</p>}
                {!step.done && <StepActions step={step} emphasis={current} setup={setup} />}
              </div>
            </li>
          );
        })}
      </ol>
      <ActionError action={setup.action} />
    </section>
  );
}
