"use client";

import { useEffect, useRef, useState } from "react";

// One-word swap: the sentence reads fine frozen on any word. Plays one round only when in view
// (under WCAG's 5s pause rule it would otherwise need a control), then rests on the last word.
const WORDS = ["client", "investor", "cofounder", "mentor", "best friend", "opportunity"];
const STEP = 1400;

export default function NextIn() {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !ref.current) return;
    let t = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      let n = 0;
      t = window.setInterval(() => { n += 1; setI(n); if (n >= WORDS.length - 1) window.clearInterval(t); }, STEP);
    }, { threshold: 0.6 });
    io.observe(ref.current);
    return () => { io.disconnect(); window.clearInterval(t); };
  }, []);
  const word = WORDS[i];
  return (
    <section ref={ref} className="section section--paper next-in" aria-labelledby="next-in-title">
      <div className="wrap" data-reveal="group">
        <h2 className="h-display" id="next-in-title">
          Your next{" "}
          <span className="next-in__word" key={word} aria-hidden="true">{word}</span>
          <span className="sr-only">client, investor, cofounder, mentor or best friend</span>
          <br />is already in your network.
        </h2>
        <p className="lead">You just don&apos;t know it yet. Venn tells you when.</p>
      </div>
    </section>
  );
}
