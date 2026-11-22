"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

import VennMark from "./VennMark";

// A sample walk through getting into Venn, from the prototype the team sketched: approve memories,
// invite a +1, see their side, and land in a shared circle. Nothing is sent or stored.

const MEMORIES = ["Photography", "Weekend hikes", "Cooking"] as const;
type Memory = (typeof MEMORIES)[number];
const MAYA = ["Photography", "Weekend hikes", "Live music"] as const;

const STEPS = ["Connect your AI memories.", "Invite your +1.", "Maya gets your invite.", "You\u2019re both in."] as const;

// Where each memory sits inside its circle, relative to the circle's center. Dots that stay
// unshared sit on the outer side, so they never land in the overlap.
const YOUR_DOTS: Record<Memory, [number, number]> = {
  Photography: [-10, -26],
  "Weekend hikes": [14, 22],
  Cooking: [-28, 10],
};
const MAYA_DOTS: Record<(typeof MAYA)[number], [number, number]> = {
  Photography: [8, -26],
  "Weekend hikes": [-4, 24],
  "Live music": [26, 4],
};

// The overlap center, in each circle's own coordinates, once the circles have come together
// (see .stage__person--you / --them in globals.css: they move 32 units toward each other).
const MEET = 32;

function dotStyle(dx: number, dy: number, toX: number): CSSProperties {
  return { "--to-x": `${toX - dx}px`, "--to-y": `${-dy}px` } as CSSProperties;
}

/** One drawing for every step. Its parts move between steps, so the story reads as one motion. */
function Stage({ step, sent, selected, shared }: { step: number; sent: boolean; selected: Memory[]; shared: string[] }) {
  return (
    <svg
      className="stage"
      viewBox="0 0 320 176"
      data-step={step}
      data-sent={sent || undefined}
      aria-hidden="true"
      focusable="false"
    >
      <line className="stage__link" x1="134" y1="84" x2="186" y2="84" />

      <g className="stage__person stage__person--them">
        <circle className="stage__disc stage__disc--them" cx="160" cy="84" r="54" />
        <path className="stage__plus" d="M151 84h18M160 75v18" />
        {MAYA.map((memory) => {
          const [dx, dy] = MAYA_DOTS[memory];
          return (
            <circle
              key={memory}
              className={`stage__dot stage__dot--them${shared.includes(memory) ? " stage__dot--shared" : ""}`}
              cx={160 + dx}
              cy={84 + dy}
              r="6"
              style={dotStyle(dx, dy, -MEET)}
            />
          );
        })}
        <text className="stage__name" x="160" y="160">
          {step === 1 && !sent ? "+1" : "Maya"}
        </text>
      </g>

      <g className="stage__person stage__person--you">
        <circle className="stage__disc stage__disc--you" cx="160" cy="84" r="54" />
        {MEMORIES.map((memory) => {
          const [dx, dy] = YOUR_DOTS[memory];
          const on = selected.includes(memory);
          return (
            <circle
              key={memory}
              className={`stage__dot stage__dot--you${on ? " stage__dot--on" : ""}${
                on && shared.includes(memory) ? " stage__dot--shared" : ""
              }`}
              cx={160 + dx}
              cy={84 + dy}
              r="6"
              style={dotStyle(dx, dy, MEET)}
            />
          );
        })}
        <text className="stage__name" x="160" y="160">
          You
        </text>
      </g>

      <g className="stage__mail">
        <rect x="149" y="76" width="22" height="16" rx="3" />
        <path d="m151 79 9 6.5 9-6.5" />
      </g>

      <circle className={`stage__common${shared.length ? " stage__common--on" : ""}`} cx="160" cy="84" r="12" />
    </svg>
  );
}

export default function ConnectionWalkthrough() {
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);
  const [selected, setSelected] = useState<Memory[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const visited = useRef(false);
  const shared = selected.filter((memory) => MAYA.some((interest) => interest === memory));

  useEffect(() => {
    if (visited.current) heading.current?.focus();
  }, [step]);

  function go(next: number) {
    visited.current = true;
    if (next <= 1) setSent(false);
    setStep(next);
  }

  function restart() {
    setSelected([]);
    go(0);
  }

  function toggle(memory: Memory) {
    setSelected((current) =>
      current.includes(memory) ? current.filter((item) => item !== memory) : [...current, memory],
    );
  }

  return (
    <div className="walkthrough">
      <header className="walkthrough__header">
        <span className="walkthrough__brand">
          <VennMark size={22} /> Venn
        </span>
        <span>
          Step {step + 1} of {STEPS.length}
        </span>
        <div className="walkthrough__progress" aria-hidden="true">
          {STEPS.map((title, index) => (
            <span key={title} data-complete={index <= step} />
          ))}
        </div>
      </header>

      <div className="walkthrough__stage">
        <Stage step={step} sent={sent} selected={selected} shared={shared} />
      </div>

      <div className="walkthrough__body" key={step}>
        <h3 ref={heading} tabIndex={-1} aria-describedby="walkthrough-step">
          {STEPS[step]}
        </h3>
        <span className="sr-only" id="walkthrough-step">
          Step {step + 1} of {STEPS.length}
        </span>

        {step === 0 && (
          <>
            <fieldset className="walkthrough__choices">
              <legend className="walkthrough__hint">Tick what Venn may use.</legend>
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
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={!selected.length}
              onClick={() => go(1)}
            >
              {selected.length
                ? `Approve ${selected.length} ${selected.length === 1 ? "memory" : "memories"}`
                : "Tick a memory to continue"}
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <p className="walkthrough__hint" role="status">
              {sent ? "Sample invite sent. Your place is held." : "Your place is held until your +1 joins."}
            </p>
            {sent ? (
              <button type="button" className="btn btn--primary btn--block" onClick={() => go(2)}>
                See what Maya sees
              </button>
            ) : (
              <button type="button" className="btn btn--primary btn--block" onClick={() => setSent(true)}>
                Send sample invite
              </button>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="card walkthrough__invite">
              <strong>Your friend saved you a place.</strong>
              <span className="muted">Joining confirms a place for both of you.</span>
            </div>
            <button type="button" className="btn btn--primary btn--block" onClick={() => go(3)}>
              Accept as Maya
            </button>
          </>
        )}

        {step === 3 && (
          <>
            {shared.length ? (
              <ul className="walkthrough__interests" aria-label="What you share">
                {shared.map((interest) => (
                  <li key={interest} className="chip">
                    {interest}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="walkthrough__hint">Nothing in common yet. Try other memories.</p>
            )}
            <div className="walkthrough__circle">
              <div className="waitlist__circle" aria-hidden="true">
                {Array.from({ length: 5 }, (_, seat) => (
                  <span key={seat} className={`avatar avatar--small ${seat < 2 ? "avatar--you" : "waitlist__seat"}`} />
                ))}
              </div>
              <span className="walkthrough__hint">2 in your circle. 3 invites left.</span>
            </div>
            <a className="btn btn--primary btn--block" href="/#waitlist">
              Join the Waitlist
            </a>
          </>
        )}
      </div>

      <footer className="walkthrough__footer">
        {step > 0 && (
          <button type="button" className="btn btn--ghost" onClick={() => go(step - 1)}>
            Back
          </button>
        )}
        <span>Sample preview · nothing is sent or saved</span>
        {step > 0 && (
          <button type="button" className="btn btn--ghost" onClick={restart}>
            Restart
          </button>
        )}
      </footer>
    </div>
  );
}
