// Small shared building blocks used by every view.

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { HostBridge } from "../mcp/client";
import { LIMITS } from "../types";
import ErrorBanner from "./ErrorBanner";

/** In-widget navigation, provided by App. */
export interface Nav {
  /** Call a view-returning tool and push its view. Resolves to an error message, or null on success. */
  openView(tool: string, args: Record<string, unknown>): Promise<string | null>;
  /** Like openView, but swaps the current view in place (no new Back step). */
  replaceView(tool: string, args: Record<string, unknown>): Promise<string | null>;
  back(): void;
  canGoBack: boolean;
}

export interface ViewProps<T> {
  data: T;
  bridge: HostBridge;
  nav: Nav;
}

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = Array.from(parts[0] ?? "")[0] ?? "?";
  const second = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + second).toUpperCase();
}

/** Deterministic hue (0..359) from a name, so the same friend always gets the same color. */
function hueFor(name: string): number {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 360;
  return h;
}

export function Avatar({ name, size }: { name: string; size?: "large" | "small" }) {
  // Only the hue is set inline; saturation/lightness come from themed CSS variables.
  const style = { "--avatar-hue": String(hueFor(name)) } as CSSProperties;
  return (
    <span className={`avatar ${size ? `avatar--${size}` : ""}`} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tool actions: busy state, double-submit guard, retryable failure
// ---------------------------------------------------------------------------

export interface FailedAction {
  message: string;
  retry: () => void;
}

export interface Action {
  /** Id of the action currently in flight, or null. */
  busy: string | null;
  failure: FailedAction | null;
  /** Run `fn` unless another action is in flight. `fn` resolves to an error message or null. */
  run(id: string, fn: () => Promise<string | null>): Promise<boolean>;
  clear(): void;
}

export function useAction(): Action {
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<FailedAction | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async (id: string, fn: () => Promise<string | null>): Promise<boolean> => {
    if (inFlight.current) return false; // never double-submit
    inFlight.current = true;
    setBusy(id);
    setFailure(null);
    let message: string | null;
    try {
      message = await fn();
    } catch (e) {
      message = e instanceof Error ? e.message : "Something went wrong.";
    }
    inFlight.current = false;
    setBusy(null);
    if (message !== null) {
      setFailure({ message, retry: () => void run(id, fn) });
      return false;
    }
    return true;
  }, []);

  const clear = useCallback(() => setFailure(null), []);
  return { busy, failure, run, clear };
}

export function ActionError({ action }: { action: Action }) {
  if (!action.failure) return null;
  return (
    <ErrorBanner
      message={action.failure.message}
      onRetry={action.failure.retry}
      onDismiss={action.clear}
      busy={action.busy !== null}
    />
  );
}

// ---------------------------------------------------------------------------
// Chat hand-off ("Draft a message", "Plan it")
// ---------------------------------------------------------------------------

export type ChatState = "idle" | "sending" | "sent" | "unavailable";

/** Sends a prompt into the conversation and tracks whether the host accepted it. */
export function useChatPrompt(bridge: HostBridge) {
  const [state, setState] = useState<ChatState>("idle");
  const [prompt, setPrompt] = useState("");
  const sending = useRef(false);

  const send = useCallback(
    async (text: string) => {
      if (sending.current) return;
      sending.current = true;
      setPrompt(text);
      setState("sending");
      const ok = await bridge.sendMessage(text);
      sending.current = false;
      setState(ok ? "sent" : "unavailable");
    },
    [bridge],
  );

  return { state, prompt, send };
}

export function ChatStatus({ state, prompt }: { state: ChatState; prompt: string }) {
  if (state === "sent") {
    return (
      <p className="hint hint--ok" role="status">
        <span aria-hidden="true">💬</span> Sent to the chat. Heldly will pick it up there.
      </p>
    );
  }
  if (state === "unavailable") {
    return (
      <p className="hint" role="status">
        Couldn't post to the chat from here. Ask Heldly directly: “{prompt}”
      </p>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Clipboard (the iframe is sandboxed, so the async API may be blocked)
// ---------------------------------------------------------------------------

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.setAttribute("aria-hidden", "true");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** "a, b , ,B" → ["a", "b"] (trimmed, de-duplicated case-insensitively). */
export function splitInterests(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,\n]/)) {
    const item = raw.trim().replace(/\s+/g, " ");
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Validation message for a list of interests, or null when it is acceptable. */
export function interestsError(items: string[]): string | null {
  if (items.length > LIMITS.interestCount) return `Up to ${LIMITS.interestCount} interests, please.`;
  if (items.some((i) => Array.from(i).length > LIMITS.interestLength)) {
    return `Each interest can be at most ${LIMITS.interestLength} characters.`;
  }
  return null;
}

export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

export function EmptyNote({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty empty--inline">
      <div className="empty__art" aria-hidden="true">
        {icon}
      </div>
      <p className="empty__title">{title}</p>
      {children && <p className="muted small">{children}</p>}
    </div>
  );
}

export function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h3 className="section-title">
      <span>{children}</span>
      {count !== undefined && <span className="count">{count}</span>}
    </h3>
  );
}
