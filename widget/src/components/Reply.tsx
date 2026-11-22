import { useId, useRef, useState } from "react";
import { isObj, type Reply, type ReplyViewData, type SavedRepliesViewData } from "../types";
import { ActionError, CopyButton, useAction, type ViewProps } from "./common";
import { Icon } from "./icons";

const REPLY_LABEL = { advice: "Advice", checklist: "Next steps", draft: "Message draft" };

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
    </div>
  );
}

export default function ReplyCard({ data, bridge }: ViewProps<ReplyViewData>) {
  const heading = useId();
  const action = useAction();
  const [saved, setSaved] = useState(false);
  const { reply } = data;

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
      <ActionError action={action} />
      <footer className="reply__footer">
        {saved ? (
          <p role="status" className="reply__saved"><Icon name="check-circle" size={18} /> Saved to your private Venn account</p>
        ) : (
          <button type="button" className="btn btn--primary" onClick={save} disabled={action.busy !== null}>
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
