"use client";

import { useEffect, useState } from "react";

const STEP_MS = 2400;

/**
 * "You already know your next customer." The last word changes every few seconds.
 *
 * The first word is in the HTML, so the line is whole without script. The word holds still
 * for a visitor who asks for reduced motion, while the pointer rests on the line, while a
 * form field has focus, and while the tab is hidden. Screen readers get one sentence with
 * every word instead of the changing one.
 */
export default function NextWord({ words }: { words: string[] }) {
  const [turn, setTurn] = useState({ now: 0, before: -1 });
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held || words.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.hidden || document.activeElement instanceof HTMLInputElement) return;
      setTurn(({ now }) => ({ now: (now + 1) % words.length, before: now }));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [held, words.length]);

  const all = words.length > 1 ? `${words.slice(0, -1).join(", ")} or ${words.at(-1)}` : words[0];

  return (
    <p className="hero__next">
      <span className="sr-only">You already know your next {all}.</span>
      <span
        className="hero__next-line"
        aria-hidden="true"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
      >
        <span>You already know your next</span>
        <span className="hero__next-words">
          {words.map((word, index) => (
            <span
              key={word}
              className={`hero__next-word${
                index === turn.now ? " hero__next-word--on" : index === turn.before ? " hero__next-word--out" : ""
              }`}
            >
              {word}.
            </span>
          ))}
        </span>
      </span>
    </p>
  );
}
