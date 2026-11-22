"use client";

import { useEffect } from "react";

/**
 * Turns on the scroll reveals (globals.css › Motion). Renders nothing.
 *
 * Elements marked `data-reveal` fade and rise in the first time they come into view;
 * `data-reveal="group"` does it for the element's children, one after the other.
 * Without script, with reduced motion, or in an old browser nothing is ever hidden:
 * the hidden state only applies once this has set `data-motion` on <html>, and whatever
 * is already on screen at that moment is left as it is.
 */
export default function Motion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const root = document.documentElement;
    const waiting: Element[] = [];
    for (const el of document.querySelectorAll("[data-reveal]")) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.setAttribute("data-in", "");
      else waiting.push(el);
    }
    root.setAttribute("data-motion", "");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    for (const el of waiting) observer.observe(el);

    return () => {
      observer.disconnect();
      root.removeAttribute("data-motion");
    };
  }, []);

  return null;
}
