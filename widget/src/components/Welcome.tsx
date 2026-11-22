import { useState } from "react";
import { LIMITS, type WelcomeViewData } from "../types";
import ErrorBanner from "./ErrorBanner";
import { ActionError, ChatFallback, useAction, type ViewProps } from "./common";
import { Illustration } from "./icons";
import { QUICK_IMPORT_PROMPT } from "../memoryImport";
import { CIRCLES, DEMO, saveCircle, type Circle } from "../onboardingCircle";
import "./onboarding.css";

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
  const selected: string[] = [];
  const [phase, setPhase] = useState<Phase>("choosing");
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState("");
  const [connecting, setConnecting] = useState<"sent" | "fallback" | null>(null);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const people = names.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, ...clue] = line.split("|");
    return { name: name.trim(), relationship: clue.join("|").trim() || null };
  });
  const namesError = validatePeople(people);

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

  function trySample() {
    void action.run("sample", async () => {
      const res = await bridge.callTool("venn_load_sample_circle", {});
      if (!res.ok) return res.errorText;
      return nav.openView("venn_show_dashboard", {});
    });
  }

  // Connect requests a draft card; nothing is imported until the user taps Import there.
  async function connect() {
    if (busy) return;
    setPhase("starting");
    let sent = false;
    try {
      const who = CIRCLES.find((c) => c.value === circle)?.label.toLowerCase();
      sent = await bridge.sendMessage(QUICK_IMPORT_PROMPT + (who ? ` Venn is mainly for: ${who}.` : ""));
    } catch {
      sent = false;
    }
    if (sent && bridge.isMock) {
      setPhase("choosing");
      await action.run("preview", () => nav.openView("mock_prepare_memory_import", {}));
      return;
    }
    setConnecting(sent ? "sent" : "fallback");
    setPhase("choosing");
  }

  if (connecting) {
    return (
      <section className="onb" aria-live="polite">
        <h2 className="onb__title">{connecting === "sent" ? "Looking for memories…" : "Open the import card"}</h2>
        {connecting === "sent" ? <p className="onb__body">If ChatGPT finds memories, you can import them on the next card without replying in chat.</p> :
          <ChatFallback text={QUICK_IMPORT_PROMPT} />}
        <button type="button" className="onb__link" onClick={() => setConnecting(null)}>Back</button>
      </section>
    );
  }

  if (step === 1) {
    return (
      <section className="onb">
        <StepCount n={1} />
        <h2 className="onb__title">Who is Venn for?</h2>
        <fieldset className="onb__choices">
          <legend className="sr-only">Who is Venn for</legend>
          {CIRCLES.map((c) => (
            <label key={c.value} className="onb__choice">
              <input type="radio" name="circle" checked={circle === c.value}
                onChange={() => { setCircle(c.value); saveCircle(c.value); setStep(2); }} />
              <span>{c.label}</span>
            </label>
          ))}
        </fieldset>
      </section>
    );
  }

  const demo = DEMO[circle ?? "friends_family"];
  return (
    <section className="onb">
      <StepCount n={2} />
      <h2 className="onb__title">Connect your AI memories.</h2>
      <p className="onb__body">Private. You choose what to save.</p>
      <ActionError action={action} />
      <button type="button" className="onb__cta" disabled={busy} onClick={() => void connect()}>
        {phase === "starting" ? "Connecting…" : "Connect"}
      </button>
      <figure className="onb__demo" aria-label="What Venn does, in ChatGPT">
        <figcaption><span className="onb__gpt">ChatGPT</span> next week</figcaption>
        <p className="onb__ask">{demo.ask}</p>
        <div className="onb__moment">
          <p>{demo.answer}</p>
          <small>Shared by {demo.person}{demo.person.endsWith("s") ? "'" : "'s"} AI · via <b>venn</b></small>
        </div>
      </figure>
      <div className="onb__row">
      <button type="button" className="onb__link" onClick={() => setStep(1)}>Back</button>
      <details className="onb__more">
        <summary>Preview first</summary>
        <div className="onb__more-body">
          <button type="button" className="btn btn--block" disabled={busy}
            onClick={() => void action.run("import", () => nav.openView("venn_import_chatgpt_memory", {}))}>
            {action.busy === "import" ? "Opening…" : "Pick what to import"}
          </button>
          <button type="button" className="btn btn--block" disabled={busy} onClick={() => void start()}>
            {phase === "starting" ? "Getting started…" : "Tell Venn about me in chat"}
          </button>
          {!data.sample_loaded && (
            <button type="button" className="btn btn--ghost btn--block" disabled={busy} onClick={trySample}>
              {action.busy === "sample" ? "Loading…" : "Try with sample friends"}
            </button>
          )}
          {steps.some((st) => st.key === "your_people" && !st.done) && (
            <details className="welcome__goals">
              <summary>Add people by name</summary>
              <form className="form" onSubmit={(event) => {
                event.preventDefault();
                if (busy || !people.length || namesError) return;
                void action.run("people", () => nav.openView("venn_propose_people_import", { people, source: "pasted list" }));
              }}>
                <textarea aria-label="Names, one per line" rows={3} placeholder={"Maya | uni\nAlex | running club"} value={names} disabled={busy}
                  onChange={(event) => setNames(event.target.value)} />
                {namesError && <p role="alert" className="small text-danger">{namesError}</p>}
                <button type="submit" className="btn" disabled={busy || !people.length || !!namesError}>
                  {action.busy === "people" ? "Opening…" : "Review names"}
                </button>
              </form>
            </details>
          )}
        </div>
      </details>
      </div>
    </section>
  );
}

export function StepCount({ n }: { n: number }) {
  return (
    <p className="onb__steps" aria-label={`Step ${n} of 3`}>0{n} / 03</p>
  );
}
