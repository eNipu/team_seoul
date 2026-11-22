"use client";

// A demo of the real Venn loop, with made-up people:
// 1. In ChatGPT you say "Update my Venn". Your AI drafts this week's signals about you.
// 2. You keep or drop each one and pick who sees them. Nothing leaves until you approve.
// 3. Later, in someone else's ChatGPT, the right signal comes up at the right moment.
import { useEffect, useRef, useState } from "react";
import ConnectionMap from "./ConnectionMap";

type Signal = { id: string; kind: string; text: string };

const DRAFTS: readonly Signal[] = [
  { id: "launch", kind: "Working on", text: "Launching our beta in Berlin next week." },
  { id: "designer", kind: "Looking for", text: "A product designer who knows fintech." },
  { id: "lisbon", kind: "Plans", text: "In Lisbon from Friday to Sunday." },
];

const CIRCLES = ["Close friends", "Work network"] as const;
type Circle = (typeof CIRCLES)[number];

const STEPS = ["Your week, drafted by your AI.", "Shared with your circle.", "The right moment, in Maya's ChatGPT."] as const;

export default function OnboardingPreview() {
  const [step, setStep] = useState(0);
  const [kept, setKept] = useState<string[]>(DRAFTS.map((d) => d.id));
  const [circle, setCircle] = useState<Circle>("Close friends");
  const heading = useRef<HTMLHeadingElement>(null);
  const visited = useRef(false);

  useEffect(() => {
    if (visited.current) heading.current?.focus();
  }, [step]);

  const go = (next: number) => {
    visited.current = true;
    setStep(next);
  };
  const toggle = (id: string) =>
    setKept((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const restart = () => {
    setKept(DRAFTS.map((draft) => draft.id));
    setCircle("Close friends");
    go(0);
  };

  const shared = DRAFTS.filter((d) => kept.includes(d.id));
  // Maya's question matches the Lisbon plan for friends, the designer need for work.
  const match = circle === "Close friends" ? DRAFTS[2] : DRAFTS[1];
  const matchShared = kept.includes(match.id);
  const mayaAsks =
    circle === "Close friends" ? "Any friends around Lisbon this weekend?" : "Who do I know that's hiring a fintech designer?";
  const answer =
    match.id === "lisbon"
      ? "Alex, your friend from uni, is in Lisbon from Friday to Sunday."
      : "Alex, who you met at Web Summit, is looking for a fintech product designer.";

  return (
    <div className="onboarding" data-step={step + 1}>
      <header className="onboarding__header">
        <span className="onboarding__brand">Inside ChatGPT, with Venn</span>
        <span>
          {step + 1} of {STEPS.length}
        </span>
        <div className="onboarding__progress" aria-hidden="true">
          {STEPS.map((title, index) => (
            <span key={title} data-complete={index <= step} />
          ))}
        </div>
      </header>

      <ConnectionMap circle={circle} kept={DRAFTS.map((draft) => kept.includes(draft.id))}
        shared={step > 0} matched={step === 2 && matchShared} />

      <div className="onboarding__body" key={step}>
        <h3 ref={heading} tabIndex={-1}>
          {STEPS[step]}
        </h3>
        {step > 0 && (
          <button type="button" className="scroll-arrow onboarding__back" aria-label="Previous step"
            title="Previous step" onClick={() => go(step - 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 12H4m6-6-6 6 6 6" />
            </svg>
          </button>
        )}

        {step === 0 && (
          <>
            <p className="chat__user demo__user">Update my Venn for this week.</p>
            <p className="muted">This week I&apos;d share these. Keep what you want, drop the rest:</p>
            <fieldset className="onboarding__choices">
              <legend className="sr-only">This week&apos;s signals</legend>
              {DRAFTS.map((d) => (
                <label key={d.id} className="onboarding__choice">
                  <input type="checkbox" checked={kept.includes(d.id)} onChange={() => toggle(d.id)} />
                  <span>
                    <small className="demo__kind">{d.kind}</small>
                    {d.text}
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="demo__circles">
              <legend className="muted">Who can see them</legend>
              {CIRCLES.map((c) => (
                <label key={c} className="demo__circle">
                  <input type="radio" name="circle" checked={circle === c} onChange={() => setCircle(c)} />
                  <span>{c}</span>
                </label>
              ))}
            </fieldset>
            <button type="button" className="btn btn--primary" disabled={!shared.length} onClick={() => go(1)}>
              {shared.length ? `Share ${shared.length} with ${circle.toLowerCase()}` : "Keep at least one to share"}
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <p className="muted">
              Only these {shared.length} lines went to your {circle.toLowerCase()}. Not your chats, not your memory.
            </p>
            <ul className="demo__shared">
              {shared.map((d) => (
                <li key={d.id}>
                  <small className="demo__kind">{d.kind}</small>
                  {d.text}
                </li>
              ))}
            </ul>
            <p className="muted">They expire on their own. Delete any of them anytime.</p>
            <button type="button" className="btn btn--primary" onClick={() => go(2)}>
              See it from Maya&apos;s side
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="chat__user demo__user">{mayaAsks}</p>
            {matchShared ? (
              <div className="moment">
                <img className="moment__icon" src="/brand/ai-icon.png" alt="" width={66} height={70} />
                <p className="moment__text">{answer} Want to say hi?</p>
                <p className="moment__prov">
                  Shared by Alex&apos;s AI · via <b>venn</b>
                </p>
              </div>
            ) : (
              <p className="muted">
                Nothing comes up: you didn&apos;t share that signal, so Maya&apos;s AI never sees it. That&apos;s the point.
              </p>
            )}
            <div className="demo__actions">
              <a className="btn btn--primary" href="#waitlist">
                Build your inner circle
              </a>
              <button type="button" className="btn" onClick={restart}>
                Start again
              </button>
            </div>
          </>
        )}
      </div>
      <p className="onboarding__foot">Demo with made-up people. Nothing is saved.</p>
    </div>
  );
}
