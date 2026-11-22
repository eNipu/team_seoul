import { useId, useRef, useState } from "react";
import { isObj, type Reply, type ReplyViewData, type SavedRepliesViewData } from "../types";
import { ActionError, ChatFallback, ChatStatus, CopyButton, useAction, useChatPrompt, type ViewProps } from "./common";
import { Icon } from "./icons";
import "./cards.css";

function ReplyContent({ reply }: { reply: Reply }) {
  const [copyFailed, setCopyFailed] = useState(false);
  if (reply.kind === "draft") {
    return (
      <>
        <blockquote className="vc__moment vc__moment--bubble"><p>{reply.body}</p></blockquote>
        <CopyButton text={reply.body} className="vc__cta" onBlocked={() => setCopyFailed(true)} />
        {copyFailed && <p role="status" className="vc__muted">Select the message to copy it.</p>}
      </>
    );
  }
  return (
    <>
      <p className="vc__body">{reply.body}</p>
      {reply.kind === "checklist" && (
        <ul className="vc__list">
          {reply.steps.map((step, index) => <li key={index}>{step}</li>)}
        </ul>
      )}
      {reply.kind === "thread" && (
        <div className="vc__list">
          {reply.entries.map((entry, index) => (
            <p key={index} className="vc__body" style={{ margin: 0 }}>
              <strong>{entry.title}.</strong> {entry.body}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

function Discussion({ title, question, bridge }: Pick<ViewProps<ReplyViewData>, "bridge"> & { title: string; question: string }) {
  const field = useId();
  const [answer, setAnswer] = useState("");
  const chat = useChatPrompt(bridge);
  const sending = chat.state === "sending";

  return (
    <form className="vc" style={{ padding: 0, border: 0, gap: 12 }} onSubmit={(event) => {
      event.preventDefault();
      if (answer.trim()) void chat.send(`Venn, let's return to “${title}”. My answer: ${answer.trim()}`);
    }}>
      <label htmlFor={field} className="vc__item-title">{question}</label>
      <textarea id={field} className="vc__input" rows={3} maxLength={800} placeholder="Write your answer" value={answer}
        onChange={(event) => setAnswer(event.target.value)} disabled={sending || chat.state === "sent"} />
      {chat.state === "sent" ? (
        <ChatStatus state={chat.state} prompt={chat.prompt} />
      ) : (
        <button className="vc__cta" type="submit" disabled={sending || !answer.trim()}>
          {sending ? "Posting…" : "Reply in ChatGPT"}
        </button>
      )}
      {chat.state === "unavailable" && <ChatFallback text={chat.prompt} />}
    </form>
  );
}

function NudgeActions({ title, bridge, dismiss }: Pick<ViewProps<ReplyViewData>, "bridge"> & { title: string; dismiss: () => void }) {
  const chat = useChatPrompt(bridge);
  const sending = chat.state === "sending";
  if (chat.state === "sent") return <ChatStatus state={chat.state} prompt={chat.prompt} />;
  return (
    <>
      {chat.state === "unavailable" && <ChatFallback text={chat.prompt} />}
      {chat.state !== "unavailable" && (
        <button type="button" className="vc__cta" disabled={sending}
          onClick={() => void chat.send(`Draft a short invite for this proposal: “${title}”. I’ll send it myself.`)}>
          {sending ? "Asking…" : "Draft an invite"}
        </button>
      )}
      {chat.state !== "unavailable" ? (
        <button type="button" className="vc__link vc__center" disabled={sending}
          onClick={() => void chat.send(`Make it a group thing. Keep the original person and activity: “${title}”.`)}>
          Make it a group
        </button>
      ) : (
        <button type="button" className="vc__link" onClick={dismiss}>Not now</button>
      )}
    </>
  );
}

export default function ReplyCard({ data, bridge }: ViewProps<ReplyViewData>) {
  const heading = useId();
  const action = useAction();
  const [saved, setSaved] = useState(false);
  const { reply } = data;
  const [dismissed, setDismissed] = useState(false);

  if (reply.kind === "nudge" && dismissed) {
    return <p role="status" className="vc vc__muted">Dismissed.</p>;
  }

  function save() {
    void action.run("save", async () => {
      const result = await bridge.callTool("venn_save_reply", { reply });
      if (!result.ok) return result.errorText;
      if (!isObj(result.data) || result.data.saved !== true) return "Venn couldn't confirm the save.";
      setSaved(true);
      return null;
    });
  }

  return (
    <section className="vc" aria-labelledby={heading}>
      <h2 id={heading} className="vc__title">{reply.title}</h2>
      <ReplyContent reply={reply} />
      {reply.kind === "discussion" && <Discussion title={reply.title} question={reply.question} bridge={bridge} />}
      <ActionError action={action} />
      {reply.kind === "nudge" ? (
        <NudgeActions title={reply.title} bridge={bridge} dismiss={() => setDismissed(true)} />
      ) : saved ? (
        <p role="status" className="vc__done"><Icon name="check-circle" size={18} /> Saved. Only you see it.</p>
      ) : (
        <button type="button" className="vc__link" onClick={save} disabled={action.busy !== null}>
          {action.busy ? "Saving…" : "Save privately"}
        </button>
      )}
    </section>
  );
}

export function SavedReplies({ data, bridge }: ViewProps<SavedRepliesViewData>) {
  const heading = useRef<HTMLHeadingElement>(null);
  const action = useAction();
  const [replies, setReplies] = useState(data.replies);
  const [confirming, setConfirming] = useState<string | null>(null);

  function remove(replyId: string) {
    void action.run(replyId, async () => {
      const result = await bridge.callTool("venn_delete_saved_reply", { reply_id: replyId });
      if (!result.ok && !result.errorText.startsWith("NOT_FOUND:")) return result.errorText;
      if (result.ok && (!isObj(result.data) || result.data.deleted !== true)) return "Venn couldn't confirm the deletion.";
      setReplies((current) => current.filter((entry) => entry.reply_id !== replyId));
      setConfirming(null);
      heading.current?.focus();
      return null;
    });
  }

  return (
    <section className="vc">
      <h2 ref={heading} tabIndex={-1} className="vc__title">Saved replies</h2>
      <ActionError action={action} />
      {replies.length === 0 && <p className="vc__muted">Replies you save show up here. Only you see them.</p>}
      <ul className="vc__items">
        {replies.map(({ reply_id, reply }) => (
          <li key={reply_id}>
            <details className="vc__more">
              <summary className="vc__item-title" style={{ color: "var(--text)" }}>{reply.title}</summary>
              <div className="vc__more-body">
                <ReplyContent reply={reply} />
                {reply.kind === "discussion" && <p className="vc__muted">{reply.question}</p>}
                <div className="vc__actions">
                  <button type="button" className="vc__link vc__link--danger" disabled={action.busy !== null}
                    onClick={() => confirming === reply_id ? remove(reply_id) : setConfirming(reply_id)}>
                    {confirming === reply_id ? "Delete for good" : "Delete"}
                  </button>
                  {confirming === reply_id && (
                    <button type="button" className="vc__link" disabled={action.busy !== null} onClick={() => { setConfirming(null); action.clear(); }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
