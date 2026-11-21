// Shared building blocks: data loading, feedback (toasts, confirm), forms, small pieces.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { errorMessage } from "./errors";
import { Icon, Illustration, type IconName, type IllustrationName } from "./icons";
import { Link } from "./router";
import QrCode from "./QrCode";
import { buildCalendarUrl, nextSaturdayAt11 } from "./calendar";
import { LIMITS, friendPath, type FriendSummary } from "./types";

/* ------------------------------------------------------------ data loading */

export interface Async<D> {
  data: D | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (next: D | ((prev: D) => D)) => void;
}

/** Loads on mount and whenever `deps` change; `reload` refetches without blanking the screen. */
export function useAsync<D>(fn: () => Promise<D>, deps: unknown[]): Async<D> {
  const [state, setState] = useState<{ data: D | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const depKey = JSON.stringify(deps);
  const lastKey = useRef(depKey);

  useEffect(() => {
    let live = true;
    const fresh = lastKey.current !== depKey;
    lastKey.current = depKey;
    setState((s) => ({ data: fresh ? null : s.data, error: null, loading: true }));
    fnRef.current().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (e) => live && setState((s) => ({ data: s.data, error: errorMessage(e), loading: false })),
    );
    return () => {
      live = false;
    };
  }, [depKey, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((next: D | ((prev: D) => D)) => {
    setState((s) => {
      if (s.data === null && typeof next === "function") return s;
      const data = typeof next === "function" ? (next as (prev: D) => D)(s.data as D) : next;
      return { ...s, data };
    });
  }, []);
  return { ...state, reload, setData };
}

/** Runs one action at a time and keeps its error for inline display. */
export function useAction(): {
  busy: boolean;
  error: string | null;
  clear: () => void;
  run: (fn: () => Promise<void>) => Promise<boolean>;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, error, clear: useCallback(() => setError(null), []), run };
}

/* ----------------------------------------------------------------- toasts */

interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error";
}

const ToastContext = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <Icon name={t.tone === "ok" ? "check-circle" : "alert"} size={18} />
            <span>{t.text}</span>
            <button
              type="button"
              className="toast__close"
              aria-label="Dismiss"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------------------------------------------------------------- dialogs */

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** A modal on the native <dialog>: focus is trapped, Escape closes, focus returns on close. */
export function Dialog({ title, onClose, children, wide }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    return () => {
      if (el?.open) el.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog--wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog__body">
        <header className="dialog__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

interface ConfirmProps {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onClose }: ConfirmProps) {
  const action = useAction();
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="dialog__text">{body}</div>
      <InlineError message={action.error} />
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onClose} disabled={action.busy}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${danger ? "btn--danger" : "btn--primary"}`}
          disabled={action.busy}
          onClick={async () => {
            if (await action.run(onConfirm)) onClose();
          }}
        >
          {action.busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

/* ----------------------------------------------------------- small pieces */

function hueFor(name: string): number {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 360;
  return h;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const a = Array.from(parts[0])[0] ?? "";
  const b = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (a + b).toUpperCase();
}

export function Avatar({ name, size }: { name: string; size?: "small" | "large" | "xl" }) {
  // Only the hue is set inline; saturation and lightness come from themed variables.
  const style = { "--avatar-hue": String(hueFor(name)) } as CSSProperties;
  return (
    <span className={`avatar ${size ? `avatar--${size}` : ""}`} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export type TagTone = "neutral" | "brand" | "info" | "success" | "warn";

export function Tag({ tone = "neutral", icon, children }: { tone?: TagTone; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`tag tag--${tone}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

/** "On Venn" for connections, "Your note" for private notes; never by colour alone. */
export function KindTag({ onVenn }: { onVenn: boolean }) {
  return onVenn ? (
    <Tag tone="brand" icon="users">
      On Venn
    </Tag>
  ) : (
    <Tag icon="note">Your note</Tag>
  );
}

export function Chips({ items, tone }: { items: string[]; tone?: "shared" }) {
  if (items.length === 0) return null;
  return (
    <ul className="chips">
      {items.map((i) => (
        <li key={i} className={`chip ${tone ? `chip--${tone}` : ""}`}>
          {i}
        </li>
      ))}
    </ul>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="inline-error" role="alert">
      <Icon name="alert" size={16} />
      <span>{message}</span>
    </p>
  );
}

export function Notice({ icon = "info", tone, children }: { icon?: IconName; tone?: "quiet"; children: ReactNode }) {
  return (
    <div className={`notice ${tone ? `notice--${tone}` : ""}`}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  lead,
  actions,
  back,
}: {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header className="page-head">
      {back && (
        <Link to={back.to} className="back-link">
          <Icon name="arrow-left" size={16} />
          {back.label}
        </Link>
      )}
      <div className="page-head__row">
        <div className="page-head__text">
          <h1 tabIndex={-1} id="page-title">
            {title}
          </h1>
          {lead && <p className="lead">{lead}</p>}
        </div>
        {actions && <div className="page-head__actions">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({
  title,
  icon,
  action,
  children,
  className = "",
  id,
}: {
  title?: string;
  icon?: IconName;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || action) && (
        <header className="card__head">
          {title && (
            <h2>
              {icon && <Icon name={icon} size={18} />}
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ rows = 3, kind = "rows" }: { rows?: number; kind?: "rows" | "cards" | "page" }) {
  return (
    <div className={`skeleton skeleton--${kind}`} aria-busy="true" aria-label="Loading">
      {kind === "page" && <div className="skeleton__title" />}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton__row">
          <span className="skeleton__dot" />
          <span className="skeleton__lines">
            <span className="skeleton__line" />
            <span className="skeleton__line skeleton__line--short" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon">
        <Icon name="alert" size={24} />
      </span>
      <h2>That didn't load</h2>
      <p>{message}</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function EmptyState({
  illustration,
  title,
  children,
  actions,
}: {
  illustration?: IllustrationName;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="state">
      {illustration && <Illustration name={illustration} size="md" />}
      <h2>{title}</h2>
      {children && <div className="state__text">{children}</div>}
      {actions && <div className="state__actions">{actions}</div>}
    </div>
  );
}

/** Standard loading / error / content switch for a page section. */
export function Loaded<D>({
  state,
  skeleton,
  children,
}: {
  state: Async<D>;
  skeleton?: ReactNode;
  children: (data: D) => ReactNode;
}) {
  if (state.data !== null) {
    return (
      <>
        {state.error && <InlineError message={state.error} />}
        {children(state.data)}
      </>
    );
  }
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  return <>{skeleton ?? <Skeleton />}</>;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (insecure context, denied permission): fall back.
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    el.remove();
    return ok;
  }
}

export function CopyButton({
  text,
  label = "Copy",
  className = "btn btn--small",
  icon = true,
}: {
  text: string;
  label?: string;
  className?: string;
  icon?: boolean;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? "done" : "failed");
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setState("idle"), 2200);
      }}
    >
      {icon && <Icon name={state === "done" ? "check" : "copy"} size={16} />}
      <span aria-live="polite">
        {state === "done" ? "Copied" : state === "failed" ? "Select and copy it by hand" : label}
      </span>
    </button>
  );
}

/** A read-only value with a Copy button (links, codes, the MCP URL). */
export function CopyField({
  label,
  value,
  mono = true,
  copyLabel = "Copy",
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyLabel?: string;
}) {
  const id = useId();
  return (
    <div className="copy-field">
      <label htmlFor={id}>{label}</label>
      <div className="copy-field__row">
        <input
          id={id}
          readOnly
          value={value}
          className={mono ? "mono" : ""}
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton text={value} label={copyLabel} className="btn" />
      </div>
    </div>
  );
}

export function QrBlock({ rows, label, caption }: { rows: string[]; label: string; caption: string }) {
  if (rows.length === 0) return null;
  return (
    <figure className="qr">
      <QrCode rows={rows} label={label} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/** Opens a prefilled Google Calendar event in a new tab; nothing is created until it is saved there. */
export function CalendarLink({
  title,
  details,
  start,
  small = true,
}: {
  title: string;
  details: string;
  start?: Date | null;
  small?: boolean;
}) {
  const url = buildCalendarUrl({ title, details, start: start ?? nextSaturdayAt11() });
  return (
    <a className={`btn ${small ? "btn--small" : ""}`} href={url} target="_blank" rel="noopener noreferrer">
      <Icon name="calendar" size={16} />
      Add to calendar
      <span className="sr-only"> (opens Google Calendar in a new tab)</span>
    </a>
  );
}

/* ------------------------------------------------------------------ forms */

export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = hint || error ? hintId : undefined;
  return (
    <div className={`field ${error ? "field--error" : ""}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="field__optional"> · optional</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {(hint || error) && (
        <p className="field__hint" id={hintId}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** Type, then Enter or comma, to add a chip. Backspace on an empty field removes the last one. */
export function ChipsInput({
  label,
  values,
  onChange,
  placeholder,
  hint,
  max = LIMITS.interestCount,
  maxLength = LIMITS.interestLength,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
  max?: number;
  maxLength?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...values];
    for (const p of parts) {
      if (next.length >= max) break;
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p.slice(0, maxLength));
    }
    onChange(next);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      if (draft.trim()) {
        e.preventDefault();
        add(draft);
      } else if (e.key === ",") e.preventDefault();
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        <span className="field__optional"> · optional</span>
      </label>
      <div className="chips-input">
        {values.map((v) => (
          <span key={v} className="chip chip--removable">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={values.length === 0 ? placeholder : ""}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => add(draft)}
          aria-describedby={`${id}-hint`}
          enterKeyHint="done"
        />
      </div>
      <p className="field__hint" id={`${id}-hint`}>
        {hint ?? "Press Enter or a comma after each one."}
      </p>
    </div>
  );
}

/** Checkboxes for picking friends, with an optional cap. */
export function FriendPicker({
  friends,
  selected,
  onChange,
  max,
  legend,
}: {
  friends: FriendSummary[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  legend: string;
}) {
  const full = max !== undefined && selected.length >= max;
  return (
    <fieldset className="picker">
      <legend>{legend}</legend>
      {friends.length === 0 ? (
        <p className="muted">
          No one in your circle yet. <Link to="/people">Add a person</Link> first.
        </p>
      ) : (
        <div className="picker__grid">
          {friends.map((f) => {
            const key = `${f.kind}:${f.id}`;
            const on = selected.includes(key);
            return (
              <label key={key} className={`pick ${on ? "pick--on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && full}
                  onChange={() => onChange(on ? selected.filter((k) => k !== key) : [...selected, key])}
                />
                <Avatar name={f.display_name} size="small" />
                <span className="pick__name">{f.display_name}</span>
              </label>
            );
          })}
        </div>
      )}
      {max !== undefined && (
        <p className="field__hint">
          {selected.length} of {max} chosen
        </p>
      )}
    </fieldset>
  );
}

export function splitKey(key: string): { kind: "connection" | "person"; id: string } {
  const i = key.indexOf(":");
  return { kind: key.slice(0, i) === "connection" ? "connection" : "person", id: key.slice(i + 1) };
}

export function FriendLink({ kind, id, name }: { kind: "connection" | "person"; id: string; name: string }) {
  return (
    <Link to={friendPath(kind, id)} className="friend-link">
      {name}
    </Link>
  );
}

export function preventSubmit(fn: () => void) {
  return (e: FormEvent) => {
    e.preventDefault();
    fn();
  };
}
