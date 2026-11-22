// Invite: one big QR code that a friend scans to connect. Scanning opens /i/{code} -> /app/join.

import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { errorMessage } from "../errors";
import QrCode from "../QrCode";
import { type Invite as InviteData } from "../types";
import { CopyButton, ErrorState, Skeleton } from "../ui";
import "./join.css";

export default function Invite() {
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const create = () => {
    setError(null);
    api.personalInvite().then(setInvite, (e) => setError(errorMessage(e)));
  };
  useEffect(() => {
    if (started.current) return; // load once, even under StrictMode
    started.current = true;
    create();
  }, []);

  return (
    <div className="page jn">
      <h1 id="page-title" className="jn__title">Scan to connect.</h1>
      {error ? (
        <ErrorState message={error} onRetry={create} />
      ) : invite ? (
        <>
          <figure className="jn__qr">
            <QrCode rows={invite.qr} label="QR code: scan to connect with me on Venn" />
          </figure>
          <div className="jn__actions">
            <CopyButton text={invite.link} label="Copy link" />
          </div>
          <p className="jn__quiet">Your QR. It stays the same, so save it or show it anytime.</p>
        </>
      ) : (
        <Skeleton rows={3} />
      )}
    </div>
  );
}
