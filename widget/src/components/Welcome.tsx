import { useState } from "react";
import { LIMITS, type WelcomeViewData } from "../types";
import DemoImport from "./DemoImport";
import ErrorBanner from "./ErrorBanner";
import { ActionError, ChatFallback, useAction, type ViewProps } from "./common";
import { Icon, Illustration } from "./icons";

const SETUP_PROMPT = "Let's set up Venn. Start with my first unfinished step and ask me one question at a time.";

type Phase = "choosing" | "starting" | "started" | "unavailable";

function validatePeople(people: { name: string; relationship: string | null }[]): string | null {
  if (people.length > LIMITS.importPeople) return `Review up to ${LIMITS.importPeople} people at a time.`;
  const seen = new Set<string>();
  for (const { name, relationship } of people) {
    if (!name || Array.from(name).length > LIMITS.personName) {
      return `Enter a name of 1 to ${LIMITS.personName} characters on each line.`;
    }
    if (Array.from(relationship ?? "").length > LIMITS.relationship) {
      return `Each clue can have up to ${LIMITS.relationship} characters.`;
    }
    if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(name + " " + (relationship ?? ""))) {
      return "Use a relationship or group as the clue. Email addresses are removed during import.";
    }
    const key = JSON.stringify([name, relationship ?? ""].map((part) => part.toLowerCase().replace(/\s+/g, " ")));
    if (seen.has(key)) return "Two entries look the same. Give them different clues or remove the repeated line.";
    seen.add(key);
  }
  return null;
}

export default function Welcome({ data, bridge, nav }: ViewProps<WelcomeViewData>) {
  const action = useAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("choosing");
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState("");
  const people = names.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, ...clue] = line.split("|");
    return { name: name.trim(), relationship: clue.join("|").trim() || null };
  });
  const namesError = validatePeople(people);

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
      const res = await bridge.callTool("venn_update_profile", { social_goals: selected });
      // Not fatal: the chat set-up can still go ahead, but tell the user.
      if (!res.ok) setError(res.errorText);
    }
    let sent = false;
    try {
      sent = await bridge.sendMessage(SETUP_PROMPT);
    } catch {
      sent = false;
    }
    setPhase(sent ? "started" : "unavailable");
  }

  const name = data.display_name.trim();

  if (phase === "started" || phase === "unavailable") {
    return (
      <section className="panel empty">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <Illustration name="chat" />
        <p className="empty__title">Great, tell me about yourself in the chat</p>
        {phase === "started" ? (
          <p className="muted">Venn will ask a few questions there. You approve everything before it's saved.</p>
        ) : (
          <ChatFallback text={SETUP_PROMPT} />
        )}
      </section>
    );
  }

  const busy = phase === "starting" || action.busy !== null;

  // The first open step is where the user is; on a brand-new account that is step 1.
  const steps = data.setup;
  const current = steps.find((s) => !s.done) ?? null;

  function trySample() {
    void action.run("sample", async () => {
      const res = await bridge.callTool("venn_load_sample_circle", {});
      if (!res.ok) return res.errorText;
      return nav.openView("venn_show_dashboard", {});
    });
  }

  const startHere = (
    <section className="welcome__start" aria-label="Starter actions">
      <h3 className="section-title">Start here</h3>
      <div className="welcome__actions">
        <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={() => void start()}>
          {phase === "starting" ? "Getting started…" : "Set up Venn"}
          {phase !== "starting" && <Icon name="arrow-right" size={18} />}
        </button>
        <button
          type="button"
          className="btn btn--block"
          disabled={busy}
          onClick={() => void action.run("import", () => nav.openView("venn_import_chatgpt_memory", {}))}
        >
          <Icon name="import" size={18} />
          {action.busy === "import" ? "Opening…" : "Import my ChatGPT memory"}
        </button>
      </div>
      <DemoImport nav={nav} action={action} disabled={busy} />
      {data.goal_options.length > 0 && (
        <details className="welcome__goals">
          <summary>Choose your goals{selected.length > 0 ? ` (${selected.length})` : ""}</summary>
          <fieldset className="goal-picker" disabled={busy}>
            <legend className="sr-only">Venn goals</legend>
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
                    <Icon name={on ? "check" : "plus"} size={14} />
                    {g.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </details>
      )}
      {!data.sample_loaded && (
        <div className="sample-offer">
          <button type="button" className="btn btn--ghost btn--block" disabled={busy} onClick={trySample}>
            <Icon name="sparkle" size={18} />
            {action.busy === "sample" ? "Loading sample friends…" : "Try with sample friends"}
          </button>
          <p className="muted small">See every card with a made-up circle. Remove it with one tap.</p>
        </div>
      )}
    </section>
  );

  return (
    <section className="panel welcome">
      <div className="welcome__hero">
        <div>
          <h2 className="welcome__title">{name ? `Welcome to Venn, ${name}` : "Welcome to Venn"}</h2>
          <p className="muted">Who would you like to spend more time with, and what would you enjoy doing together?</p>
        </div>
        <Illustration name="welcome" size="md" />
      </div>

      <ActionError action={action} />
      {startHere}

      {steps.length > 0 && (
        <>
          <h3 className="section-title">
            <span>Set up in {steps.length === 3 ? "three" : steps.length} short steps</span>
          </h3>
          <ol className="setup-steps setup-steps--path">
            {steps.map((step, i) => {
              const here = step === current;
              return (
                <li
                  key={step.key}
                  className={`setup-step ${step.done ? "setup-step--done" : ""} ${here ? "setup-step--current" : ""}`}
                  aria-current={here ? "step" : undefined}
                >
                  <span className="setup-step__marker" aria-hidden="true">
                    {step.done ? <Icon name="check" size={16} /> : i + 1}
                  </span>
                  <div className="setup-step__body">
                    <p className="setup-step__title">
                      {step.title}
                      {step.done && <span className="sr-only"> (done)</span>}
                    </p>
                    {step.description && <p className="muted small">{step.description}</p>}
                    {step.key === "your_people" && !step.done && (
                      <details className="welcome__goals">
                        <summary><Icon name="user-plus" size={16} /> Add people by name</summary>
                        <form className="form" onSubmit={(event) => {
                          event.preventDefault();
                          if (busy || !people.length || namesError) return;
                          void action.run("people", () => nav.openView("venn_propose_people_import", {
                            people, source: "pasted list",
                          }));
                        }}>
                          <label className="field">
                            <span className="field__label">Names, one per line</span>
                            <textarea rows={3} placeholder={"Alex | running club\nAlex | work"} value={names} disabled={busy}
                              onChange={(event) => setNames(event.target.value)} />
                          </label>
                          <p className="muted small">After a name, add | and an optional clue about how you know them. You review each private note before saving.</p>
                          {namesError && <p role="alert" className="small text-danger">{namesError}</p>}
                          <button type="submit" className="btn" disabled={busy || !people.length || !!namesError}>
                            {action.busy === "people" ? "Opening…" : "Review names"}
                          </button>
                        </form>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <p className="trust">
        <Icon name="shield" size={18} />
        <span>Nothing is saved until you approve it, and Venn never contacts anyone for you.</span>
      </p>
      <p className="muted small welcome__privacy">
        Saved Venn records are available in ChatGPT and on the Venn website. Your ChatGPT chats and ChatGPT's own memory are not synced.
      </p>
    </section>
  );
}
