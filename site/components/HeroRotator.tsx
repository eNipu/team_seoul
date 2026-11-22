"use client";

import { useEffect, useRef, useState } from "react";
import Moment from "./sections/Moment";
import { HEROES } from "@/lib/heroes";

// Research (2025-27: Baymard, NextAfter, WCAG 2.2.2), see vann-ads/out/research_2026.md:
// cold mobile traffic gets ONE static, ad-matched line; rotation is desktop-only, 9s, pauses on
// hover/focus, stops after any manual pick, and has a visible pause button.
const HOLD_MS = 9000;
const ROTATION = HEROES.map((h, i) => (h.rotate ? i : -1)).filter((i) => i >= 0);

export default function HeroRotator({ pinned }: { pinned: number }) {
  const [index, setIndex] = useState(pinned < 0 ? 0 : pinned);
  const [auto, setAuto] = useState(false);
  const [playing, setPlaying] = useState(true);
  const hover = useRef(false);
  const hero = HEROES[index];

  useEffect(() => {
    (window.clarity as unknown as ((...a: string[]) => void) | undefined)?.("set", "hero", pinned < 0 ? HEROES[0].key : HEROES[pinned].key);
    const desktop = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAuto(pinned < 0 && desktop && !calm);
  }, [pinned]);

  useEffect(() => {
    if (!auto || !playing) return;
    const t = window.setInterval(() => {
      if (!hover.current && document.visibilityState === "visible") setIndex((i) => ROTATION[(ROTATION.indexOf(i) + 1) % ROTATION.length]);
    }, HOLD_MS);
    const stop = (e: Event) => { if ((e.target as HTMLElement)?.closest?.("form")) setPlaying(false); };
    document.addEventListener("focusin", stop);
    return () => { window.clearInterval(t); document.removeEventListener("focusin", stop); };
  }, [auto, playing]);

  const pick = (i: number) => { setIndex(i); setPlaying(false); };

  return (
    <div className="hero-rot" onMouseEnter={() => (hover.current = true)} onMouseLeave={() => (hover.current = false)}>
      <h1 className="h-display hero-rot__head" id="hero-title" key={`h${index}`}>{hero.head}</h1>
      <p className="h-sub hero-rot__brand"><span>Connect your AI memories. Build your inner circle.</span></p>
      <p className="lead hero__what hero-rot__fade" key={`s${index}`}>{hero.sub}</p>
      <div className="chat hero__chat hero-rot__fade" key={`c${index}`} aria-label="Example inside ChatGPT">
        <p className="chat__user">{hero.ask}</p>
        <Moment person={hero.person} text={hero.answer} yellow />
      </div>
      {pinned < 0 && (
        <div className="hero-rot__controls">
          {auto && (
            <button type="button" className="hero-rot__pause" onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause headlines" : "Play headlines"}>
              {playing ? "❚❚" : "▶"}
            </button>
          )}
          {ROTATION.map((i) => HEROES[i]).map((h) => { const i = HEROES.indexOf(h); return (
            <button key={h.key} type="button" className="hero-rot__dot" data-on={i === index}
              aria-label={`Show: ${h.head}`} aria-pressed={i === index} onClick={() => pick(i)} />
          ); })}
        </div>
      )}
    </div>
  );
}
