import { useId, useMemo, useState, type FormEvent } from "react";
import type { HostBridge } from "../mcp/client";
import { buildCalendarUrl, nextSaturdayAt11, parseLocalInputValue, toLocalInputValue } from "../calendar";

interface Props {
  bridge: HostBridge;
  /** Event title, already including the friend name(s). */
  title: string;
  details: string;
  onClose: () => void;
}

type State = "idle" | "opening" | "opened" | "blocked";

/** Inline date-time picker that opens a prefilled Google Calendar event. Heldly never creates the event itself. */
export default function CalendarPicker({ bridge, title, details, onClose }: Props) {
  const id = useId();
  const [value, setValue] = useState(() => toLocalInputValue(nextSaturdayAt11()));
  const [state, setState] = useState<State>("idle");
  const start = useMemo(() => parseLocalInputValue(value), [value]);
  const url = start ? buildCalendarUrl({ title, details, start }) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!url || state === "opening") return;
    setState("opening");
    setState((await bridge.openLink(url)) ? "opened" : "blocked");
  }

  return (
    <form className="calendar" onSubmit={submit}>
      <label className="field" htmlFor={`${id}-when`}>
        <span className="field__label">When?</span>
        <input
          id={`${id}-when`}
          type="datetime-local"
          value={value}
          required
          onChange={(e) => {
            setValue(e.target.value);
            setState("idle");
          }}
        />
      </label>
      <p className="muted small">Two hours, as “{title}”. You can change everything in Google Calendar before saving.</p>
      <div className="actions actions--compact">
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          Close
        </button>
        <button type="submit" className="btn btn--primary btn--small" disabled={!url || state === "opening"}>
          {state === "opening" ? "Opening…" : "Open in Google Calendar"}
        </button>
      </div>
      {state === "opened" && (
        <p className="hint hint--ok" role="status">
          <span aria-hidden="true">📅</span> Opened Google Calendar. Save the event there to keep it.
        </p>
      )}
      {state === "blocked" && url && (
        <p className="hint" role="status">
          Couldn't open the link from here.{" "}
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open Google Calendar
          </a>
        </p>
      )}
    </form>
  );
}
