"use client";

import { useState } from "react";

import VennMark from "./VennMark";

// The two cards a member sees inside ChatGPT, playable on the page. Everything here
// is made up; the cards use the same stylesheet as the real widget (venn-kit.css).

type Signal = { id: string; label: string; value: string; sensitive?: boolean };

const SIGNALS: Signal[] = [
  { id: "building", label: "Building", value: "Booking software for physio clinics" },
  { id: "based", label: "Based in", value: "Lisbon, launching in Berlin this spring" },
  { id: "looking", label: "Looking for", value: "First B2B customers in Berlin" },
  { id: "help", label: "Can help with", value: "Product design, early hiring" },
  { id: "personal", label: "Personal & sensitive info", value: "Health, family, money", sensitive: true },
];

// The example match rests on these two signals, so it only appears if one is approved.
const MATCH_NEEDS = ["based", "looking"];

const INTRO_DRAFT =
  "Hi Teodor, congrats on the move into Berlin B2B growth. I'm launching our clinic booking tool there this spring and would love to compare notes on finding the first customers. Coffee next week?";

type Step = "sync" | "match";

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="7" rx="2" fill="currentColor" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CardHeader({ label }: { label: string }) {
  return (
    <div className="preview-card__head">
      <VennMark size={22} />
      <span className="preview-card__brand">Venn</span>
      <span className="badge">{label}</span>
    </div>
  );
}

export default function ChatPreview() {
  const [step, setStep] = useState<Step>("sync");
  const [approved, setApproved] = useState<Set<string>>(
    () => new Set(SIGNALS.filter((signal) => !signal.sensitive).map((signal) => signal.id)),
  );
  const [drafted, setDrafted] = useState(false);

  const toggle = (id: string) =>
    setApproved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const go = (next: Step) => {
    setStep(next);
    setDrafted(false);
  };
  const hasMatch = MATCH_NEEDS.some((id) => approved.has(id));

  return (
    <div className="chat">
      <div className="chat__bar">
        <span className="chat__title">ChatGPT</span>
        <div className="chat__steps" role="group" aria-label="Preview step">
          <button
            type="button"
            className="chat__step"
            aria-pressed={step === "sync"}
            onClick={() => go("sync")}
          >
            <span className="chat__step-number" aria-hidden="true">1</span> Memory sync
          </button>
          <button
            type="button"
            className="chat__step"
            aria-pressed={step === "match"}
            onClick={() => go("match")}
          >
            <span className="chat__step-number" aria-hidden="true">2</span> Common ground
          </button>
        </div>
      </div>

      {step === "sync" ? (
        <div className="chat__thread" key="sync">
          <p className="chat__bubble">Sync Venn with what you know about my work.</p>
          <section className="panel preview-card" aria-labelledby="sync-title">
            <CardHeader label="Memory sync" />
            <div>
              <h3 id="sync-title">Choose what Venn may use</h3>
              <p className="muted small">ChatGPT picked out these signals. Untick anything you&rsquo;d rather keep to yourself.</p>
            </div>
            <ul className="preview-card__list">
              {SIGNALS.map((signal) => {
                const on = approved.has(signal.id);
                return (
                  <li key={signal.id}>
                    <label className={`pick pick--row${on ? " pick--on" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(signal.id)} />
                      <span className="pick__body">
                        <span className="pick__name">
                          <strong>{signal.label}</strong>
                          {signal.sensitive && (
                            <span className="badge">
                              <LockIcon />
                              &nbsp;Off by default
                            </span>
                          )}
                        </span>
                        <span className="muted small">{signal.value}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="lock-note">
              <LockIcon />
              Nothing is shared until you approve it
            </p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={approved.size === 0}
              onClick={() => go("match")}
            >
              {approved.size === 0
                ? "Tick at least one signal"
                : `Approve ${approved.size} ${approved.size === 1 ? "signal" : "signals"}`}
            </button>
          </section>
        </div>
      ) : (
        <div className="chat__thread" key="match">
          <p className="chat__bubble">Who do I already know that could help with Berlin?</p>
          <section className="panel preview-card" aria-labelledby="match-title">
            <CardHeader label="Common ground" />
            {hasMatch ? (
              <>
                <div className="match" aria-hidden="true">
                  <div className="venn-pair">
                    <span className="venn-pair__who venn-pair__who--a">You</span>
                    <span className="venn-pair__who venn-pair__who--b">TM</span>
                    <span className="venn-pair__shared">Berlin</span>
                  </div>
                </div>
                <div className="match__text">
                  <h3 id="match-title">You and Teodor Marin</h3>
                  <p className="match__line">
                    You&rsquo;re launching in Berlin <span aria-hidden="true">↔</span>
                    <span className="sr-only"> and </span> Teodor just shifted into Berlin B2B growth
                  </p>
                  <p className="muted small">Found from the signals you approved and what Teodor chose to share.</p>
                </div>
                {drafted ? (
                  <div className="card match__draft" role="status">
                    <span className="muted small">Draft for you to edit and send</span>
                    <p>{INTRO_DRAFT}</p>
                    <span className="lock-note">
                      <LockIcon />
                      Venn never sends anything for you
                    </span>
                  </div>
                ) : (
                  <button type="button" className="btn btn--primary btn--block" onClick={() => setDrafted(true)}>
                    Draft warm intro
                  </button>
                )}
              </>
            ) : (
              <div className="match__empty">
                <h3 id="match-title">No common ground yet</h3>
                <p className="muted small">
                  Venn only matches on what you approve. Share where you&rsquo;re based or what you&rsquo;re looking for to see
                  this example.
                </p>
                <button type="button" className="btn btn--block" onClick={() => go("sync")}>
                  Back to memory sync
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
