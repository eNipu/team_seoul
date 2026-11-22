// Guided "add Venn to ChatGPT" page: every step is one tap, the page notices when it worked.
//
// ChatGPT steps verified 2026-11-22 (OpenAI web search over OpenAI's own docs):
//   https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
//   https://developers.openai.com/api/docs/guides/custom-mcp-server
// Current flow: chatgpt.com/plugins -> "+" -> "Add custom MCP server" -> Name (required),
// Description (optional), Connection > Server URL, Authentication = OAuth -> tick
// "I understand and want to continue" -> "Create as a plugin" -> install it; in a chat type "@".
// Developer mode is NOT needed for this flow. The old path (Settings > Apps > Advanced > Developer
// mode > Create, #settings/Connectors) is legacy and unstable, so it is only a fallback note.
// Custom MCP servers are web-only (not on mobile). Business: workspace admins/owners create them.
// Success is detected server-side: `chatgpt_connected` on GET /me flips when ChatGPT's OAuth token
// first reaches the MCP server.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { BrandMark, Icon } from "../icons";
import { Link } from "../router";
import { useSession } from "../session";
import { copyText } from "../ui";

export const DEFAULT_MCP_URL = "https://app.joinvennai.com/mcp";
export const CHATGPT_PLUGINS_URL = "https://chatgpt.com/plugins";
export const CHATGPT_TEST_URL = "https://chatgpt.com/?q=Open%20Venn";
export const VENN_NAME = "Venn";
export const VENN_DESCRIPTION = "Venn keeps you close to your partner and friends, from inside ChatGPT.";
const POLL_MS = 3000;

/** Phones and narrow screens: ChatGPT only adds custom MCP servers on the web. */
function useNarrow(): boolean {
  const query = "(max-width: 700px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/** Polls the account until ChatGPT's OAuth token has reached Venn. */
function useConnected(enabled: boolean): boolean {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled || connected) return;
    let live = true;
    const check = () => {
      api
        .getMe()
        .then((me) => live && me.chatgpt_connected && setConnected(true))
        .catch(() => undefined);
    };
    check();
    const timer = window.setInterval(check, POLL_MS);
    window.addEventListener("focus", check);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [enabled, connected]);
  return connected;
}

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="cx-row">
      <div className="cx-row__text">
        <span className="cx-row__label">{label}</span>
        <span className={mono ? "cx-row__value cx-row__value--mono" : "cx-row__value"}>{value}</span>
      </div>
      <button
        type="button"
        className="cx-copy"
        aria-label={`Copy ${label}`}
        data-copied={state === "copied" ? "" : undefined}
        onClick={async () => {
          const ok = await copyText(value);
          setState(ok ? "copied" : "failed");
          if (timer.current !== null) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setState("idle"), 2200);
        }}
      >
        <Icon name={state === "copied" ? "check" : "copy"} size={16} />
        <span role="status">{state === "copied" ? "Copied" : state === "failed" ? "Copy by hand" : "Copy"}</span>
      </button>
    </div>
  );
}

function Step({
  n,
  active,
  done,
  title,
  children,
}: {
  n: number;
  active: boolean;
  done: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="cx-step" data-active={active} data-done={done}>
      <span className="cx-step__num" aria-hidden="true">
        {done ? "✓" : n}
      </span>
      <div className="cx-step__body">
        <h2>{title}</h2>
        {children}
      </div>
    </li>
  );
}

/** Quoted name of the exact ChatGPT control to press. */
function Pick({ children }: { children: React.ReactNode }) {
  return <kbd className="cx-pick">{children}</kbd>;
}

function Done() {
  return (
    <section className="cx-done" aria-live="polite">
      <h1 id="page-title" tabIndex={-1}>
        Venn is in <mark>your ChatGPT.</mark>
      </h1>
      <a className="btn btn--primary btn--pill" href={CHATGPT_TEST_URL} target="_blank" rel="noopener noreferrer">
        Open ChatGPT
      </a>
      <p className="cx-note">In any chat, type @Venn to talk to it.</p>
    </section>
  );
}

function ConnectBody({ mcpUrl, signedIn }: { mcpUrl: string; signedIn: boolean }) {
  const narrow = useNarrow();
  const connected = useConnected(signedIn);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [urlCopied, setUrlCopied] = useState<boolean | null>(null);

  const openChatGpt = useCallback(async () => {
    // Copy first so the address is already on the clipboard when the form opens.
    setUrlCopied(await copyText(mcpUrl));
    window.open(CHATGPT_PLUGINS_URL, "_blank", "noopener,noreferrer");
    setStep(2);
  }, [mcpUrl]);

  if (connected) return <Done />;

  return (
    <div className="cx">
      <h1 id="page-title" tabIndex={-1}>
        Add Venn to <mark>ChatGPT.</mark>
      </h1>
      <p className="cx-lead">Three steps. We do the typing.</p>

      {narrow && (
        <div className="cx-desktop" role="note">
          <strong>ChatGPT adds this on the web, not in the phone app.</strong>
          <CopyRow label="This page" value={`${window.location.origin}/app/connect`} />
        </div>
      )}

      <ol className="cx-steps" aria-label="Add Venn to ChatGPT">
        <Step n={1} active={step === 1} done={step > 1} title="Open ChatGPT plugins">
          <p>
            Press <Pick>+</Pick> then <Pick>Add custom MCP server</Pick>.
          </p>
          <button type="button" className="btn btn--primary btn--pill" onClick={() => void openChatGpt()}>
            <Icon name="external" size={16} />
            <span>Open ChatGPT plugins</span>
          </button>
          {urlCopied !== null && (
            <p className="cx-ok" role="status">
              {urlCopied ? "Server URL copied. ChatGPT opened." : "ChatGPT opened. Copy the URL in step 2."}
            </p>
          )}
        </Step>

        <Step n={2} active={step === 2} done={step > 2} title="Paste Venn’s details">
          <p>
            Set <Pick>Authentication</Pick> to <Pick>OAuth</Pick>. Leave the rest as it is.
          </p>
          <div className="cx-rows">
            <CopyRow label="Name" value={VENN_NAME} mono={false} />
            <CopyRow label="Description" value={VENN_DESCRIPTION} mono={false} />
            <CopyRow label="Server URL" value={mcpUrl} />
          </div>
          <button type="button" className="btn btn--pill cx-next" onClick={() => setStep(3)}>
            I pasted them
          </button>
        </Step>

        <Step n={3} active={step === 3} done={false} title="Create it and sign in">
          <p>
            Tick <Pick>I understand and want to continue</Pick>, press <Pick>Create as a plugin</Pick>, then sign in
            with Google.
          </p>
          {signedIn ? (
            <p className="cx-wait" role="status">
              <span className="cx-wait__dot" aria-hidden="true" />
              Waiting for ChatGPT. This page updates by itself.
            </p>
          ) : (
            <Link to="/" className="btn btn--primary btn--pill">
              Sign in here first
            </Link>
          )}
        </Step>
      </ol>

      <details className="cx-fallback">
        <summary>Not seeing “Add custom MCP server”?</summary>
        <p>
          On Business workspaces only admins can add it. On older accounts open Settings, then Apps, turn on
          Developer mode under Advanced, and press Create.
        </p>
      </details>
    </div>
  );
}

/** Signed-in Connect page inside the My Venn app shell. */
export default function ConnectChatGpt() {
  const { session } = useSession();
  const [mcpUrl, setMcpUrl] = useState(DEFAULT_MCP_URL);
  useEffect(() => {
    api
      .getMe()
      .then((me) => me.mcp_url && setMcpUrl(me.mcp_url))
      .catch(() => undefined);
  }, []);
  return (
    <div className="page">
      <ConnectBody mcpUrl={mcpUrl} signedIn={session.signed_in} />
    </div>
  );
}

/** Public standalone Connect page at /app/connect when visited before signing in. */
export function PublicConnectChatGpt({ googleSsoAvailable: _google }: { googleSsoAvailable: boolean }) {
  const mcpUrl =
    typeof window !== "undefined" && window.location.origin.startsWith("http")
      ? `${window.location.origin}/mcp`
      : DEFAULT_MCP_URL;
  return (
    <main className="public-connect">
      <div className="public-connect__top">
        <Link to="/" className="brand">
          <BrandMark size={30} />
          <span>Venn</span>
        </Link>
        <Link to="/" className="btn btn--small">
          Sign in to My Venn
        </Link>
      </div>
      <ConnectBody mcpUrl={mcpUrl} signedIn={false} />
    </main>
  );
}
