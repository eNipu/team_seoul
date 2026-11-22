import { useEffect, useRef, useState } from "react";
import { formatDate, isObj, plural, type InviteViewData } from "../types";
import { ActionError, copyText, useAction, type ViewProps } from "./common";

import "./onboarding.css";
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

  async function copy(what: Exclude<Copied, null>, override?: string) {
    const value = override ?? (what === "code" ? data.code : what === "link" ? data.link : data.share_text || data.code);
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
      const res = await bridge.callTool("venn_revoke_invite", { code: data.code });
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.revoked !== true) return "Venn couldn't revoke this code.";
      setRevoked(true);
      setConfirming(false);
      setManual(null);
      return null;
    });
  }

  const expires = formatDate(data.expires_at);
  const busy = action.busy !== null;

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  async function send() {
    const msg = data.share_text || data.code;
    // share_text normally already carries the link; add it only when it doesn't.
    const text = data.link && !msg.includes(data.link) ? `${msg} ${data.link}` : msg;
    if (canShare) {
      try { await navigator.share({ text }); return; } catch { /* fall back to copy */ }
    }
    await copy("message", text);
  }

  if (revoked) {
    return (
      <section className="onb">
        <h2 className="onb__title">Invite cancelled.</h2>
      </section>
    );
  }

  // The QR is the invite: a friend scans it and lands on the join page. One button shares the same link.
  return (
    <section className="onb onb--invite">
      <h2 className="onb__title">Scan to connect.</h2>
      {data.qr.length > 0 && (
        <figure className="qr qr--hero">
          <QrCode rows={data.qr} label="QR code that opens your Venn invite link" />
        </figure>
      )}
      <ActionError action={action} />
      <button type="button" className="onb__cta" onClick={() => void send()}>
        {copied === "message" ? "Copied. Now send it" : "Share invite"}
      </button>
      <span className="sr-only" role="status">{copied ? "Copied to clipboard" : ""}</span>
      {manual !== null && (
        <label className="field manual-copy">
          <span className="field__label">Press Ctrl/Cmd+C to copy</span>
          <textarea ref={manualRef} readOnly rows={manual.length > 40 ? 4 : 1} value={manual} onFocus={(e) => e.target.select()} />
        </label>
      )}
      <details className="onb__more">
        <summary>Code or cancel</summary>
        <div className="onb__more-body">
          <button type="button" className="btn btn--small" onClick={() => void copy("code")}>{copied === "code" ? "Copied" : `Code ${data.code}`}</button>
          {expires && <p className="muted small">Expires {expires}{data.max_uses > 0 ? ` · ${plural(data.max_uses, "use", "uses")}` : ""}</p>}
          {confirming ? (
            <div className="confirm" role="group" aria-label="Confirm cancel">
              <span className="small">Cancel this invite?</span>
              <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={revoke}>{busy ? "Cancelling…" : "Cancel invite"}</button>
              <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setConfirming(false)}>Keep it</button>
            </div>
          ) : (
            <button type="button" className="btn btn--danger-quiet btn--small" onClick={() => setConfirming(true)}>Cancel invite</button>
          )}
          {data.note && <p className="muted small">{data.note}</p>}
        </div>
      </details>
    </section>
  );
}
