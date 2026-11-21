"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

// three.js is a separate chunk that never runs on the server and is not requested
// until the page is idle. The CSS circles below are what paints first.
const VennScene = dynamic(() => import("./VennScene"), { ssr: false });

type Mode = "css" | "loading" | "webgl";

function canAnimateIn3d(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;
  return "WebGLRenderingContext" in window;
}

/**
 * Full-bleed, non-interactive hero background: the Venn scene, with a veil over it
 * that keeps the text contrast high. Stays on the CSS circles when the visitor asks
 * for reduced motion or data saving, or when WebGL is unavailable.
 */
export default function HeroBackdrop() {
  const [mode, setMode] = useState<Mode>("css");

  useEffect(() => {
    if (!canAnimateIn3d()) return;
    const start = () => setMode((current) => (current === "css" ? "loading" : current));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 300);
    return () => clearTimeout(id);
  }, []);

  const onReady = useCallback(() => setMode("webgl"), []);
  const onFail = useCallback(() => setMode("css"), []);

  return (
    <div className="hero__backdrop" aria-hidden="true" data-scene={mode}>
      <div className="venn-fallback">
        <span className="venn-fallback__circle venn-fallback__circle--a" />
        <span className="venn-fallback__circle venn-fallback__circle--b" />
      </div>
      {mode !== "css" && <VennScene onReady={onReady} onFail={onFail} />}
      <div className="hero__veil" />
    </div>
  );
}
