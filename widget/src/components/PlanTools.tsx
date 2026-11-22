import { useState, type ReactNode } from "react";
import type { HostBridge } from "../mcp/client";
import { LIMITS, formatDateTime, hasId, type ActivitySuggestion, type FriendKind } from "../types";
import { ActionError, useAction } from "./common";
import { Icon } from "./icons";
import CalendarPicker from "./CalendarPicker";
import "./cards.css";

export interface PlanFriend {
  kind: FriendKind;
  id: string;
}

interface Props {
  bridge: HostBridge;
  /** Plan title as saved: the idea itself, without the friend names. */
  title: string;
  details: string;
  /** Calendar event title, already including the friend name(s). */
  calendarTitle: string;
  /** The friend(s) this plan is with. */
  friends: PlanFriend[];
  /** Extra actions shown before "Add to calendar" (for example "Plan it"). */
  children?: ReactNode;
  /** Put "Add to calendar", "Save plan" and `more` behind one quiet disclosure. */
  quiet?: boolean;
  more?: ReactNode;
}

/**
 * The actions under a suggestion: "Add to calendar" (opens a prefilled Google Calendar
 * event) and "Save plan" (keeps the idea on the dashboard). A time chosen in the
 * calendar picker is saved with the plan.
 */
export function PlanTools({ bridge, title, details, calendarTitle, friends, children, quiet, more }: Props) {
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [pickedAt, setPickedAt] = useState<Date | null>(null);
  const [saved, setSaved] = useState<{ at: string | null } | null>(null);

  function save() {
    void action.run("save-plan", async () => {
      const members = friends.slice(0, LIMITS.planMembers);
      const connectionIds = members.filter((f) => f.kind === "connection").map((f) => f.id);
      const personIds = members.filter((f) => f.kind === "person").map((f) => f.id);
      const args: Record<string, unknown> = { title: title.slice(0, LIMITS.planTitle) };
      if (details.trim()) args.details = details.slice(0, LIMITS.planDetails);
      if (pickedAt) args.planned_for = pickedAt.toISOString();
      if (connectionIds.length > 0) args.connection_ids = connectionIds;
      if (personIds.length > 0) args.person_ids = personIds;
      const res = await bridge.callTool("venn_save_plan", args);
      if (!res.ok) return res.errorText;
      if (!hasId(res.data, "plan_id")) return "Venn couldn't save that plan.";
      setSaved({ at: pickedAt ? pickedAt.toISOString() : null });
      return null;
    });
  }

  const when = saved ? formatDateTime(saved.at) : "";
  const tools = (
    <>
      <button type="button" className="vc__link" aria-expanded={open} onClick={() => setOpen(!open)}>
        Add to calendar
      </button>
      {saved ? (
        <span className="vc__done" role="status">
          <Icon name="check" size={16} />
          Saved{when ? ` · ${when}` : ""}
        </span>
      ) : (
        <button type="button" className="vc__link" disabled={action.busy !== null} onClick={save}>
          {action.busy ? "Saving…" : pickedAt ? `Save for ${formatDateTime(pickedAt.toISOString())}` : "Save idea"}
        </button>
      )}
    </>
  );

  return (
    <>
      {quiet ? (
        <>
          {children}
          <details className="vc__more">
            <summary>Save it for later</summary>
            <div className="vc__actions">{tools}{more}</div>
          </details>
        </>
      ) : (
        <div className="vc__actions">
          {children}
          {tools}
          {more}
        </div>
      )}
      {open && (
        <CalendarPicker
          bridge={bridge}
          title={calendarTitle}
          details={details}
          onPick={saved ? undefined : setPickedAt}
          onClose={() => setOpen(false)}
        />
      )}
      <ActionError action={action} />
    </>
  );
}

/** Title, description, grounding and next step of one suggestion. */
export function SuggestionBody({ s }: { s: ActivitySuggestion }) {
  return (
    <>
      <strong className="card__title">{s.title}</strong>
      {s.description && <p>{s.description}</p>}
      {s.grounded_in.length > 0 && <p className="muted small">Based on: {s.grounded_in.join(", ")}</p>}
      {s.suggested_action && (
        <p className="next-step">
          <Icon name="arrow-right" size={16} />
          <span>{s.suggested_action}</span>
        </p>
      )}
    </>
  );
}

/**
 * Ideas as a short list: the first one open in the yellow moment card with its actions,
 * the rest one tap away. Keeps a card to one bright element and one set of buttons.
 */
export function IdeaList({ ideas, actions }: { ideas: ActivitySuggestion[]; actions: (s: ActivitySuggestion, index: number) => ReactNode }) {
  const [top, ...rest] = ideas;
  if (!top) return null;
  return (
    <>
      <div className="vc__moment">
        <strong className="vc__item-title">{top.title}</strong>
        {top.description && <p style={{ fontWeight: 500 }}>{top.description}</p>}
      </div>
      {actions(top, 0)}
      {rest.length > 0 && (
        <ul className="vc__items" aria-label="More ideas">
          {rest.map((s, j) => (
            <li key={j + 1}>
              <details className="vc__more">
                <summary className="vc__item-title" style={{ color: "var(--text)" }}>{s.title}</summary>
                <div className="vc__more-body">
                  {s.description && <p className="vc__body">{s.description}</p>}
                  {s.suggested_action && <p className="vc__muted">{s.suggested_action}</p>}
                  {actions(s, j + 1)}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
