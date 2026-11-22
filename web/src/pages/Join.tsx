// Join: where an invite link or QR lands (/app/join?code=…). Sign-in happens before this page
// (the session gate keeps the path and code). Redeems once, which connects both people at once,
// then offers the one next step: Venn in ChatGPT.

import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { ApiError, errorMessage } from "../errors";
import { Link, useLocation } from "../router";
import { firstName } from "../types";
import { Skeleton } from "../ui";
import "./join.css";

type State = { kind: "busy" } | { kind: "ok"; name: string } | { kind: "error"; message: string };

function plainError(e: unknown): string {
  if (e instanceof ApiError && e.code === "INVALID_REQUEST") return "This is your own invite. Share it with a friend.";
  if (e instanceof ApiError && e.status === 404) return "This invite has expired or was already used. Ask for a new one.";
  return errorMessage(e);
}

export default function Join() {
  const code = useLocation().query.get("code")?.trim() ?? "";
  const [state, setState] = useState<State>(code ? { kind: "busy" } : { kind: "error", message: "This link is missing its invite code." });
  const ran = useRef(false);
  useEffect(() => {
    if (!code || ran.current) return;
    ran.current = true; // redeem exactly once
    api.redeemInvite(code).then(
      (r) => setState({ kind: "ok", name: r.inviter_display_name }),
      (e) => setState({ kind: "error", message: plainError(e) }),
    );
  }, [code]);

  if (state.kind === "busy") {
    return <div className="page jn"><Skeleton rows={2} /></div>;
  }
  if (state.kind === "error") {
    return (
      <div className="page jn">
        <h1 id="page-title" className="jn__title jn__title--small">{state.message}</h1>
        <Link to="/" className="link-btn">Open my Venn</Link>
      </div>
    );
  }
  return (
    <div className="page jn">
      <h1 id="page-title" className="jn__title">
        You and <mark>{firstName(state.name) || state.name}</mark> are connected.
      </h1>
      <div className="jn__actions">
        <Link to="/connect" className="btn btn--primary btn--pill">Connect to ChatGPT</Link>
        <Link to="/" className="link-btn">Open my Venn</Link>
      </div>
    </div>
  );
}
