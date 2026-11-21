"use client";

import { useEffect, useRef, useState } from "react";

import VennMark from "./VennMark";

const MEMORIES = ["Photography", "Weekend hikes", "Cooking"] as const;
type Memory = (typeof MEMORIES)[number];

const MAYA_INTERESTS: readonly Memory[] = ["Photography", "Weekend hikes"];
const STEPS = [
  "Choose what to share.",
  "Invite someone you know.",
  "See what Maya sees.",
  "Your circle starts here.",
] as const;

function CirclePreview({ connected = false }: { connected?: boolean }) {
  return (
    <svg className="onboarding__circle" viewBox="0 0 260 124" aria-hidden="true" focusable="false">
      {connected ? (
        <>
          <circle cx="101" cy="62" r="51" className="onboarding__member onboarding__member--first" />
          <circle cx="159" cy="62" r="51" className="onboarding__member onboarding__member--second" />
          <text x="84" y="62">You</text>
          <text x="176" y="62">Maya</text>
        </>
      ) : (
        <>
          <path d="M96 62h68" className="onboarding__outline" />
          <circle cx="54" cy="62" r="42" className="onboarding__member onboarding__member--first" />
          <circle cx="206" cy="62" r="42" className="onboarding__outline" />
          <text x="54" y="62">You</text>
          <text x="206" y="62">Maya</text>
        </>
      )}
    </svg>
  );
}

export default function OnboardingPreview() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Memory[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const visited = useRef(false);
  const shared = MAYA_INTERESTS.filter((interest) => selected.includes(interest));

  useEffect(() => {
    if (visited.current) heading.current?.focus();
  }, [step]);

  function go(next: number) {
    visited.current = true;
    setStep(next);
  }

  function toggle(memory: Memory) {
    setSelected((current) => current.includes(memory) ? current.filter((item) => item !== memory) : [...current, memory]);
  }

  return (
    <div className="onboarding">
      <header className="onboarding__header">
        <span className="onboarding__brand"><VennMark size={22} /> Venn</span>
        <span>Step {step + 1} of {STEPS.length}</span>
        <div className="onboarding__progress" aria-hidden="true">
          {STEPS.map((title, index) => <span key={title} data-complete={index <= step} />)}
        </div>
      </header>

      <div className="onboarding__body" key={step}>
        <h3 ref={heading} tabIndex={-1} aria-describedby="onboarding-step">{STEPS[step]}</h3>
        <span className="sr-only" id="onboarding-step">Step {step + 1} of {STEPS.length}</span>

        {step === 0 && (
          <>
            <p className="muted">Pick sample memories to share in this preview.</p>
            <fieldset className="onboarding__choices">
              <legend className="sr-only">Sample memories</legend>
              {MEMORIES.map((memory) => {
                const checked = selected.includes(memory);
                return (
                  <label key={memory} className={`pick pick--row${checked ? " pick--on" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(memory)} />
                    <strong>{memory}</strong>
                  </label>
                );
              })}
            </fieldset>
            <button type="button" className="btn btn--primary btn--block" disabled={!selected.length} onClick={() => go(1)}>
              {selected.length ? `Approve ${selected.length} ${selected.length === 1 ? "memory" : "memories"}` : "Select a memory to continue"}
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <CirclePreview />
            <button type="button" className="btn btn--primary btn--block" onClick={() => go(2)}>Preview Maya’s invitation</button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="card onboarding__invite">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              <strong>Someone invited you to Venn.</strong>
              <p className="muted">Connect to see which interests you share.</p>
            </div>
            <button type="button" className="btn btn--primary btn--block" onClick={() => go(3)}>Accept as Maya</button>
          </>
        )}

        {step === 3 && (
          <>
            <CirclePreview connected />
            <div className="onboarding__result">
              <p>{shared.length ? "You and Maya share these interests." : "Maya joined your sample circle."}</p>
              {shared.length ? (
                <ul className="onboarding__interests" aria-label="Shared interests">
                  {shared.map((interest) => <li key={interest} className="chip">{interest}</li>)}
                </ul>
              ) : <p className="muted">No shared interests in the memories you chose.</p>}
            </div>
            <a className="btn btn--primary btn--block" href="#waitlist">Join the Waitlist</a>
          </>
        )}
      </div>

      <footer className="onboarding__footer">
        {step > 0 && <button type="button" className="btn btn--ghost" onClick={() => go(step - 1)}>Back</button>}
        <span>Preview · No choices saved</span>
        {step > 0 && (
          <button type="button" className="btn btn--ghost" onClick={() => { setSelected([]); go(0); }}>Restart</button>
        )}
      </footer>
    </div>
  );
}
