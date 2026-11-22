import { useState } from "react";
import { firstName, formatDate, isObj, plural, type AskLinkViewData } from "../types";
import { ActionError, ManualCopy, useAction, useCopy, type ViewProps } from "./common";
import { Icon } from "./icons";
import QrCode from "./QrCode";
import "./cards.css";

export const ASK_PROMISE = "Your friend needs no account. Their answers wait for your review; nothing is saved until you approve it.";

export default function AskLink({ data, bridge, nav }: ViewProps<AskLinkViewData>) {
  const action = useAction();
  const { copied, manual, copy } = useCopy();
  const [revoked, setRevoked] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const expires = formatDate(data.expires_at);
  const busy = action.busy !== null;
  const who = data.for_name ? firstName(data.for_name) : null;

  function revoke() {
    void action.run("revoke", async () => {
      const res = await bridge.callTool("venn_revoke_question_link", { link_id: data.link_id });
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.revoked !== true) return "Venn couldn't revoke this link.";
      setRevoked(true);
      setConfirming(false);
      return null;
    });
  }

  return (
    <section className="vc">
      <h2 className="vc__title">{who ? `Ask ${who} a few questions` : "Ask a friend a few questions"}</h2>
      <p className="vc__muted">
        {revoked ? (
          <span className="text-danger" role="status">This link no longer works.</span>
        ) : (
          <>Send it yourself. {who ?? "Your friend"} answers in a minute, no account needed.</>
        )}
      </p>

      <ActionError action={action} />

      {!revoked && (
        <>
          {data.share_text && manual === null && (
            <blockquote className="vc__moment vc__moment--bubble"><p>{data.share_text}</p></blockquote>
          )}
          {manual !== null && <ManualCopy text={manual} />}
          <button type="button" className="vc__cta" onClick={() => void copy("message", data.share_text || data.link)}>
            <Icon name={copied === "message" ? "check" : "copy"} size={18} />
            {copied === "message" ? "Copied" : data.share_text ? "Copy message" : "Copy link"}
          </button>
          <span className="sr-only" role="status">
            {copied ? "Copied to clipboard" : ""}
          </span>
        </>
      )}

      <details className="vc__more">
        <summary>QR code and questions</summary>
        <div className="vc__more-body">
          <p className="vc__link-text">{data.link}</p>
          {!revoked && data.share_text && (
            <button type="button" className="vc__link" onClick={() => void copy("link", data.link)}>
              {copied === "link" ? "Link copied" : "Copy just the link"}
            </button>
          )}
          {!revoked && (expires || data.max_responses > 0) && (
            <p className="vc__muted">
              {expires && <>Expires {expires}</>}
              {expires && data.max_responses > 0 && " · "}
              {data.max_responses > 0 && <>up to {plural(data.max_responses, "response", "responses")}</>}
            </p>
          )}
          {!revoked && data.qr.length > 0 && (
            <figure className="qr" style={{ margin: 0 }}>
              <QrCode rows={data.qr} label="QR code that opens your question link" />
              <figcaption className="qr__caption">Scan to answer</figcaption>
            </figure>
          )}
          {data.questions.length > 0 && (
            <ol className="vc__steps" aria-label={`What ${who ?? "your friend"} will be asked`}>
              {data.questions.map((q, i) => (
                <li key={i}><span>{q}</span></li>
              ))}
            </ol>
          )}
          <p className="vc__muted">{ASK_PROMISE}</p>
          {data.note && data.note.trim() !== ASK_PROMISE && <p className="vc__muted">{data.note}</p>}
          <div className="vc__actions">
            {!revoked && confirming ? (
              <>
                <span className="vc__muted">Revoke? It stops working right away.</span>
                <button type="button" className="vc__link vc__link--danger" disabled={busy} onClick={revoke}>
                  {action.busy === "revoke" ? "Revoking…" : "Revoke"}
                </button>
                <button type="button" className="vc__link" disabled={busy} onClick={() => setConfirming(false)}>
                  Keep it
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="vc__link"
                  disabled={busy}
                  onClick={() => void action.run("answers", () => nav.openView("venn_review_answers", {}))}
                >
                  {action.busy === "answers" ? "Opening…" : "See answers"}
                </button>
                {!revoked && (
                  <button type="button" className="vc__link vc__link--danger" disabled={busy} onClick={() => setConfirming(true)}>
                    Revoke link
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
