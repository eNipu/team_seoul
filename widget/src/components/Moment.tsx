import { useEffect, useState, type ReactNode } from "react";
import type { HostBridge } from "../mcp/client";
import { firstName, friendArg, parseView, type FriendKind, type FriendViewData } from "../types";
import { ChatStatus, ManualCopy, useChatPrompt } from "./common";
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
 * The moment: ChatGPT telling you, in one message, who to reach out to and why.
 * One action, Say hi, which hands the message to the chat.
 */
export function ChatMoment({
  bridge,
  kind,
  id,
  name,
  idea,
  footer,
}: {
  bridge: HostBridge;
  kind: FriendKind;
  id: string;
  name: string;
  idea?: string | null;
  footer?: ReactNode;
}) {
  const signals = useFriendSignals(bridge, kind, id);
  const chat = useChatPrompt(bridge);
  const first = firstName(name);
  const text = momentText(name, signals, idea);
  return (
    <section className="onb moment-chat" aria-label="A message from Venn" aria-busy={signals === null}>
      <p className="onb__context">ChatGPT</p>
      {signals === null ? (
        <div className="onb__bubble onb__bubble--in"><p aria-label="Typing">…</p></div>
      ) : (
        <div className="onb__bubble onb__bubble--in">
          <p>{text}</p>
          {signals.signal && <small>{signals.signal.source}</small>}
        </div>
      )}
      <button type="button" className="onb__cta" disabled={signals === null || chat.state === "sending"}
        onClick={() => void chat.send(`Help me say hi to ${name}. Keep it short and warm, mention: ${text.replace(/^Btw, /, "")} I'll send it myself.`)}>
        {chat.state === "sending" ? "Asking…" : `Say hi to ${first}`}
      </button>
      <ChatStatus state={chat.state} prompt={chat.prompt} />
      {footer && <div className="onb__row">{footer}</div>}
    </section>
  );
}
