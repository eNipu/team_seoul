import { useEffect, useState } from "react";
import type { HostBridge } from "../mcp/client";
import { firstName, friendArg, parseView, type FriendKind, type FriendViewData } from "../types";
import { ActionError, ChatFallback, ManualCopy, useAction, type Nav } from "./common";
import { IMPORT_CONTACTS_PROMPT } from "../memoryImport";
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


/** A friend's shared signal: what their AI shared (or, for a private note, what you wrote). */
export interface Signal {
  title: string;
  detail: string | null;
  source: string;
}

export interface FriendSignals {
  signal: Signal | null;
  shared: string[];
}

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

/** The first thing a friend shared, the overlap with you, from a friend view. */
export function signalsFrom(f: Pick<FriendViewData, "kind" | "display_name" | "shared_memories" | "notes" | "bio" | "shared_interests">): FriendSignals {
  const first = firstName(f.display_name);
  const m = f.kind === "connection" ? f.shared_memories[0] : undefined;
  let signal: Signal | null = null;
  if (m) signal = { title: m.title, detail: m.description || null, source: `Shared by ${possessive(first)} AI · via venn` };
  else if (f.notes) signal = { title: f.notes.split(/(?<=[.!?])\s+/)[0], detail: null, source: "From your notes · only you see this" };
  else if (f.bio) signal = { title: f.bio, detail: null, source: `${possessive(first)} profile · via venn` };
  return { signal, shared: f.shared_interests };
}

/** Loads a friend's signals with the read-only friend view. Null until loaded; empty on failure. */
export function useFriendSignals(bridge: HostBridge, kind: FriendKind, id: string): FriendSignals | null {
  const [state, setState] = useState<FriendSignals | null>(null);
  useEffect(() => {
    let active = true;
    setState(null);
    if (!id) return () => { active = false; };
    void bridge.callTool("venn_view_friend", friendArg(kind, id)).then((res) => {
      const v = res.ok ? parseView(res.data, res.meta) : null;
      if (active) setState(v?.view === "friend" ? signalsFrom(v) : { signal: null, shared: [] });
    }).catch(() => { if (active) setState({ signal: null, shared: [] }); });
    return () => { active = false; };
  }, [bridge, kind, id]);
  return state;
}

function lcFirst(t: string): string {
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

/** What ChatGPT says, in plain words: the friend's signal, the overlap, one suggestion. */
export function momentText(name: string, f: FriendSignals | null, idea?: string | null): string {
  const first = firstName(name);
  const sig = f?.signal;
  const what = sig ? (sig.detail ?? sig.title).replace(/[.!?…]+$/, "") : null;
  const parts = [what ? `Btw, ${first} ${lcFirst(what)}.` : `Btw, ${first} came up.`];
  const both = f?.shared[0];
  if (both) parts.push(`You're both into ${both.toLowerCase()}.`);
  parts.push("I think you should reconnect.");
  if (idea) parts.push(`Maybe ${lcFirst(idea.replace(/[.!?…]+$/, ""))}?`);
  return parts.join(" ");
}

/**
 * After onboarding there is nothing to manage here: ChatGPT itself messages the user when
 * something matters. One line, then two quiet links: the generic invite and the web app.
 */
export function QuietHome({ bridge, nav }: { bridge: HostBridge; nav: Nav }) {
  const action = useAction();
  const [importFallback, setImportFallback] = useState(false);
  async function importContacts() {
    let sent = false;
    try { sent = await bridge.sendMessage(IMPORT_CONTACTS_PROMPT); } catch { sent = false; }
    setImportFallback(!sent);
  }
  return (
    <section className="onb">
      <h2 className="onb__title">Venn will tell you here, in ChatGPT, when something matters.</h2>
      <ActionError action={action} />
      <div className="onb__row">
        <button type="button" className="onb__link" disabled={action.busy !== null} onClick={() => void importContacts()}>
          Import contacts
        </button>
        <button type="button" className="onb__link" disabled={action.busy !== null}
          onClick={() => void action.run("invite", () => nav.openView("venn_create_invite", {}))}>
          {action.busy === "invite" ? "Opening…" : "Invite someone"}
        </button>
        <OpenMyVenn bridge={bridge} />
      </div>
      {importFallback && <ChatFallback text={IMPORT_CONTACTS_PROMPT} />}
    </section>
  );
}
