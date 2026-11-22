// Small shared building blocks used by every view.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { HostBridge } from "../mcp/client";
import { LIMITS } from "../types";
import ErrorBanner from "./ErrorBanner";
import { Icon, Illustration, type IllustrationName } from "./icons";

/** In-widget navigation, provided by App. */
export interface Nav {
  /** Call a view-returning tool and push its view. Resolves to an error message, or null on success. */
  openView(tool: string, args: Record<string, unknown>): Promise<string | null>;
  /** Like openView, but swaps the current view in place (no new Back step). */
  replaceView(tool: string, args: Record<string, unknown>): Promise<string | null>;
  /** Open the dashboard on a given tab. Resolves like openView. */
  openDashboard(tab: "profile" | "memories" | "friends"): Promise<string | null>;
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
      let ok = false;
      try {
        ok = await bridge.sendMessage(text);
      } catch {
        ok = false;
      }
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
        <Icon name="chat" size={16} /> Sent to the chat. Venn will pick it up there.
      </p>
    );
  }
  if (state === "unavailable") {
    return (
      <p className="hint" role="status">
        Couldn't post to the chat from here. Ask Venn directly: “{prompt}”
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

/** Inline empty state: a spot illustration, a title and one line of guidance. */
export function EmptyNote({ art, title, children }: { art: IllustrationName; title: string; children?: ReactNode }) {
  return (
    <div className="empty empty--inline">
      <Illustration name={art} size="sm" />
      <p className="empty__title">{title}</p>
      {children && <p className="muted small">{children}</p>}
    </div>
  );
}

/** "Copy" button with a short-lived "Copied" state. Reports a blocked clipboard through `onBlocked`. */
export function CopyButton({ text, className = "btn btn--small", onBlocked }: { text: string; className?: string; onBlocked?: () => void }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    const ok = await copyText(text);
    window.clearTimeout(timer.current);
    setCopied(ok);
    if (ok) timer.current = window.setTimeout(() => setCopied(false), 2000);
    else onBlocked?.();
  }

  return (
    <>
      <button type="button" className={className} onClick={() => void copy()}>
        <Icon name={copied ? "check" : "copy"} size={16} />
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" role="status">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}

/**
 * Shown when the host refused a chat message: the text itself, ready to copy.
 * The text sits in a read-only field so it can still be selected when the clipboard is blocked.
 */
export function ChatFallback({ text }: { text: string }) {
  const field = useRef<HTMLInputElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  return (
    <div className="fallback" role="status">
      <label className="fallback__label">
        <span className="small">{blocked ? "Press Ctrl/Cmd+C to copy, then paste it in the chat." : "Couldn't post to the chat from here. Paste this in the chat:"}</span>
        <input ref={field} className="fallback__text" readOnly value={text} onFocus={(e) => e.target.select()} />
      </label>
      <CopyButton
        text={text}
        onBlocked={() => {
          setBlocked(true);
          field.current?.focus();
          field.current?.select();
        }}
      />
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

/**
 * Small ring gauge with its value written in the middle. Decorative: callers
 * state the same value in text next to it. Only ever fed real payload numbers.
 */
export function Ring({ ratio, label, size = 52 }: { ratio: number; label: string; size?: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return (
    <span className="ring-gauge" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" width={size} height={size} focusable="false">
        <circle className="ring-gauge__track" cx="24" cy="24" r={r} />
        <circle
          className="ring-gauge__value"
          cx="24"
          cy="24"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="ring-gauge__label">{label}</span>
    </span>
  );
}

/**
 * Copy several different texts from one view. `copied` names the button that last
 * succeeded (for a short "Copied" state); `manual` holds the text to select by hand
 * when the clipboard is blocked.
 */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(async (id: string, text: string) => {
    const ok = await copyText(text);
    window.clearTimeout(timer.current);
    if (ok) {
      setManual(null);
      setCopied(id);
      timer.current = window.setTimeout(() => setCopied(null), 2000);
    } else {
      setCopied(null);
      setManual(text);
    }
  }, []);

  return { copied, manual, copy };
}

/** Read-only field with the text selected, for when the clipboard is blocked. */
export function ManualCopy({ text }: { text: string }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [text]);
  return (
    <label className="field manual-copy">
      <span className="field__label">Press Ctrl/Cmd+C to copy</span>
      <textarea ref={ref} readOnly rows={text.length > 40 ? 4 : 1} value={text} onFocus={(e) => e.target.select()} />
    </label>
  );
}


/** The people a memory is about, as small chips. Renders nothing for an empty list. */
export function PeopleChips({ people, label = "About" }: { people: string[]; label?: string }) {
  if (people.length === 0) return null;
  return (
    <div className="chips people-chips">
      <span className="people-chips__label">{label}:</span>
      {people.map((name, i) => (
        <span key={`${name}-${i}`} className="chip chip--small chip--person">
          <Icon name="user" size={12} />
          {name}
        </span>
      ))}
    </div>
  );
}
