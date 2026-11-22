import { useId, useRef, useState } from "react";
import { isObj, type Reply, type ReplyViewData, type SavedRepliesViewData } from "../types";
import { ActionError, ChatFallback, ChatStatus, CopyButton, useAction, useChatPrompt, type ViewProps } from "./common";
import { Icon } from "./icons";

const REPLY_LABEL = {
  advice: "Advice",
  nudge: "Suggestion",
  checklist: "Next steps",
  draft: "Message draft",
  discussion: "Discussion",
  thread: "Thread",
};

function ReplyContent({ reply }: { reply: Reply }) {
  const [copyFailed, setCopyFailed] = useState(false);
  if (reply.kind === "draft") {
    return (
      <div className="reply__content">
        <blockquote className="reply__draft"><p>{reply.body}</p></blockquote>
        <CopyButton text={reply.body} className="btn" onBlocked={() => setCopyFailed(true)} />
        {copyFailed && <p role="status" className="muted small">Select the message to copy it.</p>}
      </div>
    );
  }
  return (
    <div className="reply__content">
      <p className="reply__body">{reply.body}</p>
      {reply.kind === "checklist" && (
        <ol className="reply__steps">
          {reply.steps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
      )}
      {reply.kind === "thread" && (
        <ol className="reply__thread" role="list">
          {reply.entries.map((entry, index) => (
            <li key={index}>
              <h3>{entry.title}</h3>
              <p>{entry.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Discussion({ title, question, bridge }: Pick<ViewProps<ReplyViewData>, "bridge"> & { title: string; question: string }) {
  const field = useId();
  const [answer, setAnswer] = useState("");
  const chat = useChatPrompt(bridge);
  const sending = chat.state === "sending";

  return (
    <form className="reply__discussion" onSubmit={(event) => {
      event.preventDefault();
      if (answer.trim()) void chat.send(`Venn, let's return to “${title}”. My answer: ${answer.trim()}`);
    }}>
      <label htmlFor={field}>{question}</label>
      <textarea id={field} rows={3} maxLength={800} placeholder="Write your answer" value={answer}
        onChange={(event) => setAnswer(event.target.value)} disabled={sending || chat.state === "sent"} />
      {chat.state === "sent" ? (
        <ChatStatus state={chat.state} prompt={chat.prompt} />
      ) : (
        <button className="btn btn--primary" type="submit" disabled={sending || !answer.trim()}>
          {sending ? "Posting…" : "Reply in ChatGPT"} <Icon name="arrow-right" size={17} />
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
      <div className="actions">
        {chat.state !== "unavailable" && (
          <>
            <button type="button" className="btn btn--primary" disabled={sending}
              onClick={() => void chat.send(`Draft a short invite for this proposal: “${title}”. I’ll send it myself.`)}>
              Draft an invite
            </button>
            <button type="button" className="btn" disabled={sending}
              onClick={() => void chat.send(`Make it a group thing. Keep the original person and activity: “${title}”.`)}>
              Make it a group
            </button>
          </>
        )}
        <button type="button" className="btn" disabled={sending} onClick={dismiss}>Maybe later</button>
      </div>
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
    return <p role="status" className="panel muted">Suggestion dismissed.</p>;
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
    <section className="panel reply" aria-labelledby={heading}>
      <header className="reply__header">
        <p className="muted small">{REPLY_LABEL[reply.kind]}</p>
        <h2 id={heading}>{reply.title}</h2>
      </header>
      <ReplyContent reply={reply} />
      {reply.kind === "discussion" && <Discussion title={reply.title} question={reply.question} bridge={bridge} />}
      <ActionError action={action} />
      <footer className="reply__footer">
        {reply.kind === "nudge" ? (
          <NudgeActions title={reply.title} bridge={bridge} dismiss={() => setDismissed(true)} />
        ) : saved ? (
          <p role="status" className="reply__saved"><Icon name="check-circle" size={18} /> Saved to your private Venn account</p>
        ) : (
          <button type="button" className={reply.kind === "discussion" ? "btn" : "btn btn--primary"}
            onClick={save} disabled={action.busy !== null}>
            <Icon name="bookmark" size={18} /> {action.busy ? "Saving…" : "Save privately"}
          </button>
        )}
      </footer>
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
    <section className="panel reply">
      <h2 ref={heading} tabIndex={-1}>Saved replies</h2>
      <ActionError action={action} />
      {replies.length === 0 && <p className="muted">Replies you save privately in Venn will appear here.</p>}
      {replies.map(({ reply_id, reply }) => (
        <details className="card saved-reply" key={reply_id}>
          <summary><strong>{reply.title}</strong><span className="muted small">{REPLY_LABEL[reply.kind]}</span></summary>
          <ReplyContent reply={reply} />
          {reply.kind === "discussion" && <p className="reply__saved-question">{reply.question}</p>}
          <div className="actions">
            <button type="button" className="btn btn--danger" disabled={action.busy !== null}
              onClick={() => confirming === reply_id ? remove(reply_id) : setConfirming(reply_id)}>
              {confirming === reply_id ? "Delete reply" : "Delete"}
            </button>
            {confirming === reply_id && (
              <button type="button" className="btn" disabled={action.busy !== null} onClick={() => { setConfirming(null); action.clear(); }}>
                Cancel
              </button>
            )}
          </div>
        </details>
      ))}
    </section>
  );
}
