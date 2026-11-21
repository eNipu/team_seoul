"use client";

import { useEffect, useRef, useState } from "react";

const STEP_MS = 2400;

/**
 * "You already know your next customer." on one line, with the last word rolling upward to
 * the next one every few seconds. On a phone the sentence is wider than the screen, so the
 * word sits on a line of its own there (globals.css).
 *
 * The slot is as wide as the word in it, which keeps the sentence centered; its width is
 * animated from one word to the next so the words before it glide instead of jumping.
 *
 * The first word is in the HTML, so the line is whole without script. The word holds still
 * for a visitor who asks for reduced motion, while the pointer rests on the line, while a
 * form field has focus, and while the tab is hidden. Screen readers get one sentence with
 * every word instead of the changing one.
 */
export default function NextWord({ words }: { words: string[] }) {
  const [turn, setTurn] = useState({ now: 0, before: -1 });
  const [held, setHeld] = useState(false);
  const slot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (held || words.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.hidden || document.activeElement instanceof HTMLInputElement) return;
      setTurn(({ now }) => ({ now: (now + 1) % words.length, before: now }));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [held, words.length]);

  // Give the slot the width of the word now in it. The first time this equals the width it
  // already has; after that the change is what the CSS transition animates. The observer
  // covers a resized window and a late font, both of which change how wide a word is.
  useEffect(() => {
    const box = slot.current;
    const word = box?.children[turn.now];
    if (!box || !(word instanceof HTMLElement)) return;
    const fit = () => {
      box.style.width = `${word.offsetWidth}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(word);
    return () => observer.disconnect();
  }, [turn.now]);

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
        <span className="hero__next-lead">You already know your next</span>{" "}
        <span className="hero__next-words" ref={slot}>
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
