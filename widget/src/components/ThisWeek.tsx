import { useState } from "react";
import { firstName, friendArg, isObj, parseLogInteraction, type ThisWeekViewData, type WeekAction, type WeekActionType } from "../types";
import type { HostBridge } from "../mcp/client";
import { ActionError, Avatar, ChatStatus, EmptyNote, ManualCopy, useAction, useChatPrompt, useCopy, type Nav, type ViewProps } from "./common";
import { Icon, type IconName } from "./icons";
import { PlanTools, SuggestionBody } from "./PlanTools";

const TYPE_META: Record<WeekActionType, { icon: IconName; label: string }> = {
  reach_out: { icon: "send", label: "Reach out" },
  follow_up: { icon: "flag", label: "Follow up" },
  plan: { icon: "calendar", label: "Make a plan" },
};

export const PROMISE = "Venn never sends anything for you.";

function Row({ a, bridge, nav }: { a: WeekAction; bridge: HostBridge; nav: Nav }) {
  const action = useAction();
  const chat = useChatPrompt(bridge);
  const { copied, manual, copy } = useCopy();
  const [followUpDone, setFollowUpDone] = useState(false);
  const [logged, setLogged] = useState<string | null>(null);
  const first = firstName(a.display_name);
  const arg = friendArg(a.kind, a.id);
  const meta = TYPE_META[a.type];
  const busy = action.busy !== null;

  function completeFollowUp(id: string) {
    void action.run("follow-up", async () => {
      const res = await bridge.callTool("venn_complete_follow_up", { follow_up_id: id });
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.done !== true) return "Venn couldn't mark that as done.";
      setFollowUpDone(true);
      return null;
    });
  }

  function log(label: string, activity: string) {
    void action.run(`log-${activity}`, async () => {
      const res = await bridge.callTool("venn_log_interaction", { ...arg, activity });
      if (!res.ok) return res.errorText;
      if (!parseLogInteraction(res.data).recorded) return "Venn couldn't log that.";
      setLogged(label);
      return null;
    });
  }

  return (
    <li className={`card week-row week-row--${a.type}`}>
      <div className="week-row__head">
        <span className="week-row__type">
          <Icon name={meta.icon} size={14} />
          {meta.label}
        </span>
        <div className="week-row__who">
          <Avatar name={a.display_name} />
          <div className="week-row__text">
            <strong className="card__title">{a.title || `${meta.label}: ${first}`}</strong>
            <span className="muted small">
              {a.display_name}
              {a.reason ? ` · ${a.reason}` : ""}
            </span>
          </div>
        </div>
      </div>

      {a.draft_message && (
        <div className="draft">
          <span className="draft__label">A message you could send</span>
          <blockquote className="draft__text">{a.draft_message}</blockquote>
          <div className="card__actions">
            <button type="button" className="btn btn--primary btn--small" onClick={() => void copy("draft", a.draft_message ?? "")}>
              <Icon name={copied === "draft" ? "check" : "copy"} size={16} />
              {copied === "draft" ? "Copied" : "Copy message"}
            </button>
            {chat.state !== "unavailable" && (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                disabled={chat.state === "sending"}
                onClick={() => void chat.send(`Rewrite this message to ${first} in my voice, keep it short: “${a.draft_message}”`)}
              >
                <Icon name="chat" size={16} />
                {chat.state === "sending" ? "Asking…" : "Ask ChatGPT to rewrite"}
              </button>
            )}
          </div>
          <span className="sr-only" role="status">
            {copied === "draft" ? "Message copied to clipboard" : ""}
          </span>
          {manual !== null && <ManualCopy text={manual} />}
          <ChatStatus state={chat.state} prompt={chat.prompt} />
        </div>
      )}

      {a.follow_up &&
        (followUpDone ? (
          <p className="logged-row" role="status">
            <Icon name="check" size={16} /> Follow-up done
          </p>
        ) : (
          <div className="week-follow">
            <p className="week-follow__text">
              <Icon name="flag" size={16} />
              <span>{a.follow_up.text}</span>
            </p>
            <button type="button" className="btn btn--small" disabled={busy} onClick={() => completeFollowUp(a.follow_up!.follow_up_id)}>
              <Icon name="check" size={16} />
              {action.busy === "follow-up" ? "Saving…" : "Done"}
            </button>
          </div>
        ))}

      {a.suggestion && (
        <div className="week-idea">
          <SuggestionBody s={a.suggestion} />
          <PlanTools
            bridge={bridge}
            title={a.suggestion.title}
            details={a.suggestion.description}
            calendarTitle={`${a.suggestion.title} with ${a.display_name}`}
            friends={[{ kind: a.kind, id: a.id }]}
          />
        </div>
      )}

      <ActionError action={action} />

      <div className="week-row__foot">
        {logged ? (
          <span className="saved-plan" role="status">
            <Icon name="check" size={16} />
            Logged: {logged.toLowerCase()}
          </span>
        ) : (
          <>
            <button type="button" className="quick-action" disabled={busy} onClick={() => log("We talked", "Talked")}>
              <Icon name="chat" size={16} />
              {action.busy === "log-Talked" ? "Logging…" : "We talked"}
            </button>
            <button type="button" className="quick-action" disabled={busy} onClick={() => log("We met up", "Met up")}>
              <Icon name="users" size={16} />
              {action.busy === "log-Met up" ? "Logging…" : "We met up"}
            </button>
          </>
        )}
        <button
          type="button"
          className="btn btn--ghost btn--small week-row__open"
          disabled={busy}
          onClick={() => void action.run("open", () => nav.openView("venn_view_friend", arg))}
        >
          {action.busy === "open" ? "Opening…" : `Open ${first}`}
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </li>
  );
}

export default function ThisWeek({ data, bridge, nav }: ViewProps<ThisWeekViewData>) {
  const action = useAction();
  const busy = action.busy !== null;

  function trySample() {
    void action.run("sample", async () => {
      const res = await bridge.callTool("venn_load_sample_circle", {});
      if (!res.ok) return res.errorText;
      return nav.replaceView("venn_this_week", {});
    });
  }

  return (
    <section className="panel">
      <div className="hero hero--row">
        <span className="week-badge" aria-hidden="true">
          <Icon name="calendar-check" size={26} />
        </span>
        <div>
          <p className="eyebrow">This week</p>
          <h2>{data.actions.length > 0 ? "Small things that keep you close" : "Nothing to do this week"}</h2>
        </div>
      </div>

      <ActionError action={action} />

      {data.actions.length === 0 ? (
        <>
          <EmptyNote art="friends" title="No suggestions yet">
            {data.empty_reason || "Add a few people and Venn will suggest who to reach out to."}
          </EmptyNote>
          <div className="button-row">
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void action.run("add", () => nav.openDashboard("friends"))}
            >
              <Icon name="user-plus" size={18} />
              {action.busy === "add" ? "Opening…" : "Add people"}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={trySample}>
              <Icon name="sparkle" size={18} />
              {action.busy === "sample" ? "Loading starter circle…" : "Explore a starter circle"}
            </button>
          </div>
          <p className="muted small">The starter circle uses fictional people, not your contacts.</p>
        </>
      ) : (
        <ul className="list">
          {data.actions.map((a, i) => (
            <Row key={`${a.type}:${a.kind}:${a.id}:${i}`} a={a} bridge={bridge} nav={nav} />
          ))}
        </ul>
      )}

      <p className="trust">
        <Icon name="shield" size={18} />
        <span>{PROMISE}</span>
      </p>
      {data.note && data.note.trim() !== PROMISE && <p className="muted small">{data.note}</p>}
    </section>
  );
}
