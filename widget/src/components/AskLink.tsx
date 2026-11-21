import { useState } from "react";
import { firstName, formatDate, isObj, plural, type AskLinkViewData } from "../types";
import { ActionError, ManualCopy, useAction, useCopy, type ViewProps } from "./common";
import { Icon, Illustration } from "./icons";
import QrCode from "./QrCode";

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
    <section className="panel">
      <div className="hero hero--row">
        <Illustration name="chat" size="sm" />
        <div>
          <p className="eyebrow">Question link</p>
          <h2>{who ? `Ask ${who} a few questions` : "Ask a friend a few questions"}</h2>
          <p className="muted small">Send this link yourself. {who ?? "Your friend"} answers in a browser, in about a minute.</p>
        </div>
      </div>

      <ActionError action={action} />

      <div className={`ticket ticket--link ${revoked ? "ticket--revoked" : ""}`}>
        <span className="ticket__label">{revoked ? "Revoked link" : data.for_name ? `Link for ${data.for_name}` : "Link for a friend"}</span>
        <span className="ticket__link">{data.link}</span>
        {revoked ? (
          <span className="ticket__meta text-danger" role="status">
            This link no longer works
          </span>
        ) : (
          <span className="ticket__meta">
            {expires && <span>Expires {expires}</span>}
            {expires && data.max_responses > 0 && <span aria-hidden="true"> · </span>}
            {data.max_responses > 0 && <span>Takes up to {plural(data.max_responses, "response", "responses")}</span>}
          </span>
        )}
      </div>

      {!revoked && data.qr.length > 0 && (
        <figure className="qr">
          <QrCode rows={data.qr} label="QR code that opens your question link" />
          <figcaption className="qr__caption">Scan to answer</figcaption>
        </figure>
      )}

      {!revoked && (
        <>
          <div className="button-row">
            <button type="button" className="btn btn--primary" onClick={() => void copy("link", data.link)}>
              <Icon name={copied === "link" ? "check" : "link"} size={18} />
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
            <button type="button" className="btn" onClick={() => void copy("message", data.share_text || data.link)}>
              <Icon name={copied === "message" ? "check" : "copy"} size={18} />
              {copied === "message" ? "Copied" : "Copy message"}
            </button>
          </div>
          <span className="sr-only" role="status">
            {copied ? "Copied to clipboard" : ""}
          </span>
          {manual !== null && <ManualCopy text={manual} />}
          {data.share_text && manual === null && <p className="quote">{data.share_text}</p>}
        </>
      )}

      {data.questions.length > 0 && (
        <div className="asked">
          <h3 className="section-title">
            <span>What {who ?? "your friend"} will be asked</span>
            <span className="count">{data.questions.length}</span>
          </h3>
          <ol className="asked__list">
            {data.questions.map((q, i) => (
              <li key={i}>
                <span className="asked__num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="trust">
        <Icon name="shield" size={18} />
        <span>{ASK_PROMISE}</span>
      </p>
      {data.note && data.note.trim() !== ASK_PROMISE && <p className="muted small">{data.note}</p>}

      <div className="footer-actions">
        {!revoked && confirming ? (
          <div className="confirm">
            <span className="small">Revoke this link? It will stop working right away.</span>
            <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={revoke}>
              {action.busy === "revoke" ? "Revoking…" : "Revoke"}
            </button>
            <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              disabled={busy}
              onClick={() => void action.run("answers", () => nav.openView("venn_review_answers", {}))}
            >
              <Icon name="inbox" size={16} />
              {action.busy === "answers" ? "Opening…" : "See answers"}
            </button>
            {!revoked && (
              <button type="button" className="btn btn--danger-quiet btn--small" disabled={busy} onClick={() => setConfirming(true)}>
                Revoke link
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
