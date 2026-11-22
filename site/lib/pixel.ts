"use client";

import { effectiveConsent } from "@/lib/consent";

// Send a standard Meta Pixel event if the pixel is on the page and ads consent allows it.
type Fbq = (command: "track", event: string, params?: Record<string, unknown>) => void;

export function trackPixel(event: "Lead" | "CompleteRegistration" | "ViewContent", params?: Record<string, unknown>) {
  if (effectiveConsent()?.ads !== true) return;
  const fbq = (globalThis as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq === "function") fbq("track", event, params);
}
