import { useEffect, useRef, useState } from "react";
import { formatDate, isObj, plural, type InviteViewData } from "../types";
import { ActionError, copyText, useAction, type ViewProps } from "./common";
import { Icon, Illustration } from "./icons";
import QrCode from "./QrCode";

type Copied = "code" | "message" | "link" | null;

export default function Invite({ data, bridge }: ViewProps<InviteViewData>) {
  const action = useAction();
  const [copied, setCopied] = useState<Copied>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const manualRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Clipboard blocked: select the text so Ctrl/Cmd+C works right away.
  useEffect(() => {
    if (manual === null) return;
    manualRef.current?.focus();
    manualRef.current?.select();
  }, [manual]);

  async function copy(what: Exclude<Copied, null>) {
    const value = what === "code" ? data.code : what === "link" ? data.link : data.share_text || data.code;
    const ok = await copyText(value);
    window.clearTimeout(timer.current);
    if (ok) {
      setManual(null);
      setCopied(what);
      timer.current = window.setTimeout(() => setCopied(null), 2000);
    } else {
      setCopied(null);
      setManual(value);
    }
  }

  function revoke() {
    void action.run("revoke", async () => {
      const res = await bridge.callTool("heldly_revoke_invite", { code: data.code });
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.revoked !== true) return "Heldly couldn't revoke this code.";
      setRevoked(true);
      setConfirming(false);
      setManual(null);
      return null;
    });
  }

  const expires = formatDate(data.expires_at);
  const busy = action.busy !== null;

  return (
    <section className="panel">
      <div className="hero hero--row">
        <Illustration name="invite" size="sm" />
        <div>
          <h2>Invite a friend</h2>
          <p className="muted small">Share this code with someone you'd like to connect with on Heldly.</p>
        </div>
      </div>

      <ActionError action={action} />

      <div className={`ticket ${revoked ? "ticket--revoked" : ""}`}>
        <span className="ticket__label">{revoked ? "Revoked code" : "Invite code"}</span>
        <span className="ticket__code" aria-label={`Invite code ${data.code}`}>
          {data.code || "—"}
        </span>
        {revoked ? (
          <span className="ticket__meta text-danger" role="status">
            This code no longer works
          </span>
        ) : (
          <span className="ticket__meta">
            {expires && <span>Expires {expires}</span>}
            {expires && data.max_uses > 0 && <span aria-hidden="true"> · </span>}
            {data.max_uses > 0 && <span>Can be used {plural(data.max_uses, "time", "times")}</span>}
          </span>
        )}
      </div>

      {!revoked && data.qr.length > 0 && (
        <figure className="qr">
          <QrCode rows={data.qr} label="QR code that opens your Heldly invite link" />
          <figcaption className="qr__caption">Scan to connect</figcaption>
        </figure>
      )}

      {!revoked && (
        <>
          <div className="button-row">
            <button type="button" className="btn btn--primary" onClick={() => void copy("code")}>
              <Icon name={copied === "code" ? "check" : "copy"} size={18} />
              {copied === "code" ? "Copied" : "Copy code"}
            </button>
            <button type="button" className="btn" onClick={() => void copy("message")}>
              <Icon name={copied === "message" ? "check" : "chat"} size={18} />
              {copied === "message" ? "Copied" : "Copy invite message"}
            </button>
            {data.link && (
              <button type="button" className="btn" onClick={() => void copy("link")}>
                <Icon name={copied === "link" ? "check" : "link"} size={18} />
                {copied === "link" ? "Copied" : "Copy link"}
              </button>
            )}
          </div>
          <span className="sr-only" role="status">
            {copied ? "Copied to clipboard" : ""}
          </span>

          {manual !== null && (
            <label className="field manual-copy">
              <span className="field__label">Press Ctrl/Cmd+C to copy</span>
              <textarea ref={manualRef} readOnly rows={manual.length > 40 ? 4 : 1} value={manual} onFocus={(e) => e.target.select()} />
            </label>
          )}

          {data.share_text && manual === null && <p className="quote">{data.share_text}</p>}
        </>
      )}

      {data.note && <p className="muted small">{data.note}</p>}

      {!revoked && (
        <div className="footer-actions">
          {confirming ? (
            <div className="confirm" role="group" aria-label="Confirm revoke">
              <span className="small">Revoke this code? It will stop working right away.</span>
              <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={revoke}>
                {busy ? "Revoking…" : "Revoke"}
              </button>
              <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--danger-quiet btn--small" onClick={() => setConfirming(true)}>
              Revoke code
            </button>
          )}
        </div>
      )}
    </section>
  );
}
