import { useState, type ReactNode } from "react";
import type { HostBridge } from "../mcp/client";
import { firstName, friendArg, isObj, parseLogInteraction, type WeekAction } from "../types";
import { ActionError, ChatStatus, ManualCopy, useAction, useChatPrompt, useCopy, type Nav } from "./common";
import { PlanTools } from "./PlanTools";
import "./onboarding.css";

/** The web app: a side path for seeing and editing everything. Never a required step. */
export const WEB_APP_URL = "https://joinvennai.com/app/";

/** Ends a headline like the founder's lines: short, with a full stop. */
export function sentence(text: string): string {
  const t = text.trim();
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

/** One quiet "Open my Venn" link. Falls back to showing the address when the host blocks links. */
export function OpenMyVenn({ bridge }: { bridge: HostBridge }) {
  const [blocked, setBlocked] = useState(false);
  return (
    <>
      <button type="button" className="onb__link" onClick={() => void bridge.openLink(WEB_APP_URL).then((ok) => setBlocked(!ok))}>
        Open my Venn
      </button>
      {blocked && <ManualCopy text={WEB_APP_URL} />}
    </>
  );
}

/**
 * The proactive card: who to reach out to now, why, and one action.
 * Everything else about the moment (log, rewrite, open, plan tools) sits behind "More".
 */
export function MomentCard({
  a,
  bridge,
  nav,
  onNext,
  nextLabel = "Not now",
  footer,
  eyebrow,
}: {
  a: WeekAction;
  bridge: HostBridge;
  nav: Nav;
  onNext?: () => void;
  nextLabel?: string;
  footer?: ReactNode;
  eyebrow?: string;
}) {
  const action = useAction();
  const chat = useChatPrompt(bridge);
  const { copied, manual, copy } = useCopy();
  const [followUpDone, setFollowUpDone] = useState(false);
  const [logged, setLogged] = useState<string | null>(null);
  const first = firstName(a.display_name);
  const arg = friendArg(a.kind, a.id);
  const busy = action.busy !== null;
  const message = a.draft_message ?? (a.follow_up && !followUpDone ? a.follow_up.text : null);

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

  function planIt() {
    if (!a.suggestion) return;
    void chat.send(`Help me plan "${a.suggestion.title}" with ${a.display_name}. I will reach out myself.`);
  }

  return (
    <section className="onb" aria-label={`Venn suggests: ${a.title || first}`}>
      {eyebrow && <p className="onb__steps">{eyebrow}</p>}
      <h2 className="onb__title">{sentence(a.title || `Check in with ${first}`)}</h2>
      {a.reason && <p className="onb__body">{sentence(a.reason)}</p>}

      {message ? (
        <div className="onb__bubble" aria-label={a.draft_message ? "A message you could send" : "Something to ask"}>
          <p>{message}</p>
        </div>
      ) : a.suggestion ? (
        <div className="onb__moment">
          <p>{a.suggestion.title}</p>
          {a.suggestion.description && <small>{a.suggestion.description}</small>}
        </div>
      ) : null}

      <ActionError action={action} />
      {logged ? (
        <p className="onb__done" role="status">Logged: {logged.toLowerCase()}.</p>
      ) : message ? (
        <button type="button" className="onb__cta" onClick={() => void copy("msg", message)}>
          {copied === "msg" ? "Copied. Now send it" : a.draft_message ? "Copy message" : `Copy question for ${first}`}
        </button>
      ) : a.suggestion ? (
        <button type="button" className="onb__cta" disabled={chat.state === "sending"} onClick={planIt}>
          {chat.state === "sending" ? "Asking…" : `Plan it with ${first}`}
        </button>
      ) : (
        <button type="button" className="onb__cta" disabled={busy}
          onClick={() => void action.run("open", () => nav.openView("venn_view_friend", arg))}>
          {action.busy === "open" ? "Opening…" : `Open ${first}`}
        </button>
      )}
      <span className="sr-only" role="status">{copied ? "Copied to clipboard" : ""}</span>
      {manual !== null && <ManualCopy text={manual} />}
      <ChatStatus state={chat.state} prompt={chat.prompt} />

      <div className="onb__row">
        {onNext ? <button type="button" className="onb__link" onClick={onNext}>{nextLabel}</button> : <span />}
        <details className="onb__more">
          <summary>More</summary>
          <div className="onb__more-body">
            {!logged && (
              <>
                <button type="button" className="btn btn--block" disabled={busy} onClick={() => log("We talked", "Talked")}>
                  {action.busy === "log-Talked" ? "Logging…" : "We talked"}
                </button>
                <button type="button" className="btn btn--block" disabled={busy} onClick={() => log("We met up", "Met up")}>
                  {action.busy === "log-Met up" ? "Logging…" : "We met up"}
                </button>
              </>
            )}
            {a.follow_up && !followUpDone && (
              <button type="button" className="btn btn--block" disabled={busy} onClick={() => completeFollowUp(a.follow_up!.follow_up_id)}>
                {action.busy === "follow-up" ? "Saving…" : "I asked, mark done"}
              </button>
            )}
            {a.draft_message && chat.state !== "unavailable" && (
              <button type="button" className="btn btn--block" disabled={chat.state === "sending"}
                onClick={() => void chat.send(`Rewrite this message to ${first} in my voice, keep it short: “${a.draft_message}”`)}>
                {chat.state === "sending" ? "Asking…" : "Rewrite it in chat"}
              </button>
            )}
            {a.suggestion && (
              <PlanTools bridge={bridge} title={a.suggestion.title} details={a.suggestion.description}
                calendarTitle={`${a.suggestion.title} with ${a.display_name}`} friends={[{ kind: a.kind, id: a.id }]} />
            )}
            <button type="button" className="btn btn--ghost btn--block" disabled={busy}
              onClick={() => void action.run("open", () => nav.openView("venn_view_friend", arg))}>
              {action.busy === "open" ? "Opening…" : `Open ${first}`}
            </button>
            {footer}
          </div>
        </details>
      </div>
    </section>
  );
}
