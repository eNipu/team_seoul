// Send a standard Meta Pixel event if the pixel is on the page. No-op otherwise.
type Fbq = (command: "track", event: string, params?: Record<string, unknown>) => void;

export function trackPixel(event: "Lead" | "CompleteRegistration" | "ViewContent", params?: Record<string, unknown>) {
  const fbq = (globalThis as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq === "function") fbq("track", event, params);
}
