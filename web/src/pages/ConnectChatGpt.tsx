// Guided 1-click workflow to connect Venn's MCP server inside ChatGPT.

import { useCallback, useEffect, useRef, useState } from "react";
import quickstartUrl from "../../../docs/Venn-Quickstart.pdf?url";
import { api } from "../api";
import { BrandMark, Icon } from "../icons";
import { Link } from "../router";
import { useSession } from "../session";
import { Card, PageHeader, copyText, useAsync } from "../ui";

export const DEFAULT_MCP_URL = "https://app.joinvennai.com/mcp";
export const CHATGPT_CONNECTORS_URL = "https://chatgpt.com/#settings/Connectors";
export const CHATGPT_PLUGINS_URL = "https://chatgpt.com/plugins";
/** Set once the guided setup is finished here; Home then offers "Invite someone" instead. */
export const CHATGPT_FLAG = "venn.chatgpt.connected";
export const CHATGPT_TEST_URL = "https://chatgpt.com/?q=Open%20Venn";

let lastAnnouncement = "";

function useCopyStatus() {
  const [state, setState] = useState<{ status: "idle" | "copied" | "failed"; text: string }>({
    status: "idle",
    text: "",
  });
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const report = useCallback((ok: boolean, okText = "Copied") => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    let message = ok ? okText : "Copy failed";
    if (message === lastAnnouncement) message += "\u00A0";
    lastAnnouncement = message;
    setState({ status: ok ? "copied" : "failed", text: message });
    timer.current = window.setTimeout(() => {
      setState({ status: "idle", text: "" });
    }, 2400);
  }, []);

  return { state, report };
}

function AccessibleCopyButton({
  value,
  label,
  ariaLabel,
  className = "btn btn--small",
}: {
  value: string;
  label: string;
  ariaLabel: string;
  className?: string;
}) {
  const { state, report } = useCopyStatus();
  return (
    <span className="connect-copy">
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        data-copied={state.status === "copied" ? "" : undefined}
        data-failed={state.status === "failed" ? "" : undefined}
        onClick={async () => {
          const ok = await copyText(value);
          report(ok);
        }}
      >
        <Icon name={state.status === "copied" ? "check" : "copy"} size={16} />
        <span>{state.status === "copied" ? "Copied" : label}</span>
      </button>
      <span className="connect-copy__tip" role="status" data-show={state.status !== "idle" ? "true" : "false"}>
        {state.text}
      </span>
    </span>
  );
}

function ConnectWorkflowBody({
  mcpUrl,
  signedInName,
  signedInIdentity,
  googleSsoAvailable,
}: {
  mcpUrl: string;
  signedInName?: string | null;
  signedInIdentity?: string | null;
  googleSsoAvailable?: boolean;
}) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [completed, setCompleted] = useState<Record<1 | 2 | 3, boolean>>({ 1: false, 2: false, 3: false });
  const launch = useCopyStatus();

  async function copyAndOpenChatGpt() {
    const ok = await copyText(mcpUrl);
    launch.report(ok, "MCP URL copied. ChatGPT opened.");
    window.open(CHATGPT_CONNECTORS_URL, "_blank", "noopener,noreferrer");
    setCompleted((prev) => ({ ...prev, 1: true }));
    setActiveStep(2);
  }

  function markDone(step: 1 | 2 | 3) {
    if (step === 3) {
      try {
        window.localStorage.setItem(CHATGPT_FLAG, "1");
      } catch {
        /* private mode: Home just keeps offering the setup */
      }
    }
    setCompleted((prev) => ({ ...prev, [step]: true }));
    if (step < 3) setActiveStep((step + 1) as 2 | 3);
  }

  const doneCount = Number(completed[1]) + Number(completed[2]) + Number(completed[3]);

  return (
    <div className="stack-lg">
      <Card
        title="One-click setup"
        icon="sparkle"
        className="card--feature"
        action={<span className="connect-progress">{doneCount} of 3 done</span>}
      >
        <p>
          Click once to copy Venn’s MCP address and jump straight to ChatGPT’s connector settings in a new tab. Keep
          this page open beside ChatGPT to finish in under a minute.
        </p>

        {signedInName ? (
          <p className="connect-account-pill">
            <Icon name="check-circle" size={16} />
            <span>
              Signed in as <strong>{signedInName}</strong>
              {signedInIdentity ? ` (${signedInIdentity})` : ""} — ChatGPT will let you confirm in one click.
            </span>
          </p>
        ) : googleSsoAvailable ? (
          <p className="connect-account-pill">
            <Icon name="user" size={16} />
            <span>
              Tip:{" "}
              <a className="link" href="/auth/google/start?next=%2Fapp%2Fconnect">
                Sign in with Google first
              </a>{" "}
              so ChatGPT connects your account in one click.
            </span>
          </p>
        ) : null}

        <div className="row">
          <span className="connect-copy">
            <button
              type="button"
              className={activeStep === 3 ? "btn" : "btn btn--primary"}
              onClick={() => void copyAndOpenChatGpt()}
            >
              <Icon name="external" size={16} />
              <span>Copy MCP URL &amp; open ChatGPT</span>
            </button>
            <span className="connect-copy__tip" role="status" data-show={launch.state.status !== "idle" ? "true" : "false"}>
              {launch.state.text}
            </span>
          </span>
          <a className="btn" href={CHATGPT_PLUGINS_URL} target="_blank" rel="noopener noreferrer">
            Open ChatGPT Plugins
          </a>
          <a className="btn" href={quickstartUrl} target="_blank" rel="noopener">
            <Icon name="help" size={16} />
            <span>Quickstart PDF</span>
          </a>
        </div>

        <div className="connect-url-bar">
          <span className="small muted">MCP Server URL</span>
          <code className="mono connect-url-bar__code">{mcpUrl}</code>
          <AccessibleCopyButton value={mcpUrl} label="Copy URL" ariaLabel="Copy Venn MCP server URL" />
        </div>
      </Card>

      <ol className="connect-steps" aria-label="Steps to connect Venn in ChatGPT">
        <li className="card connect-step" data-active={activeStep === 1} data-done={completed[1]}>
          <div className="connect-step__head">
            <span className="connect-step__num" aria-hidden="true">
              {completed[1] ? "✓" : "1"}
            </span>
            <div>
              <h3>Open ChatGPT connector settings</h3>
              <p className="muted">
                The button above copies the URL and opens ChatGPT Connectors directly. On some plans, custom MCP servers
                appear under <strong>Plugins</strong>.
              </p>
            </div>
          </div>
          <details className="connect-tip">
            <summary>Don’t see “Create” or “Add custom MCP server”?</summary>
            <p className="muted small">
              In ChatGPT, open <strong>Settings → Apps &amp; Connectors → Advanced</strong> and turn on{" "}
              <strong>Developer mode</strong>. Custom MCP servers show up immediately after enabling it.
            </p>
          </details>
        </li>

        <li className="card connect-step" data-active={activeStep === 2} data-done={completed[2]}>
          <div className="connect-step__head">
            <span className="connect-step__num" aria-hidden="true">
              {completed[2] ? "✓" : "2"}
            </span>
            <div>
              <h3>Paste Venn’s details and pick OAuth</h3>
              <p className="muted">Fill in these three fields in ChatGPT. Leave Client ID and Secret blank.</p>
            </div>
          </div>
          <dl className="connect-kv">
            <div className="connect-kv__row">
              <dt>Name</dt>
              <dd>
                <code className="mono">Venn</code>
                <AccessibleCopyButton value="Venn" label="Copy" ariaLabel="Copy app name Venn" />
              </dd>
            </div>
            <div className="connect-kv__row">
              <dt>MCP Server URL</dt>
              <dd>
                <code className="mono">{mcpUrl}</code>
                <AccessibleCopyButton value={mcpUrl} label="Copy" ariaLabel="Copy Venn MCP server URL" />
              </dd>
            </div>
            <div className="connect-kv__row">
              <dt>Authentication</dt>
              <dd>
                <span>
                  <strong>OAuth</strong> <span className="muted small">(automatic — no keys needed)</span>
                </span>
              </dd>
            </div>
          </dl>
          <div className="row">
            <button type="button" className="btn btn--small" onClick={() => markDone(2)}>
              {completed[2] ? "Done — go to step 3" : "I added Venn in ChatGPT"}
            </button>
          </div>
        </li>

        <li className="card connect-step" data-active={activeStep === 3} data-done={completed[3]}>
          <div className="connect-step__head">
            <span className="connect-step__num" aria-hidden="true">
              {completed[3] ? "✓" : "3"}
            </span>
            <div>
              <h3>Sign in with Google &amp; test Venn</h3>
              <p className="muted">
                When ChatGPT asks you to connect, click{" "}
                <strong>{signedInName ? `Continue as ${signedInName}` : "Continue with Google"}</strong>. Your web app
                and ChatGPT share the exact same Venn account.
              </p>
            </div>
          </div>
          <div className="row">
            <a
              className={activeStep === 3 ? "btn btn--primary" : "btn"}
              href={CHATGPT_TEST_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => markDone(3)}
            >
              <Icon name="sparkle" size={16} />
              <span>Open ChatGPT &amp; say “Open Venn”</span>
            </a>
            {signedInName ? (
              <Link to="/" className="btn">
                Back to My Venn
              </Link>
            ) : (
              <Link to="/" className="btn">
                Sign in to My Venn
              </Link>
            )}
          </div>
        </li>
      </ol>
    </div>
  );
}

/** Signed-in Connect page inside the My Venn app shell. */
export default function ConnectChatGpt() {
  const { displayName, session } = useSession();
  const me = useAsync(api.getMe, []);
  const mcpUrl = me.data?.mcp_url || DEFAULT_MCP_URL;
  const identity =
    session.username && session.username.includes("@")
      ? session.username
      : session.username
        ? `@${session.username}`
        : null;

  return (
    <div className="page">
      <PageHeader
        title="Connect Venn to ChatGPT"
        lead="One click copies the MCP URL and opens ChatGPT connector settings so anyone can connect in under a minute."
      />
      <ConnectWorkflowBody
        mcpUrl={mcpUrl}
        signedInName={displayName}
        signedInIdentity={identity}
        googleSsoAvailable={session.google_sso_available}
      />
    </div>
  );
}

/** Public standalone Connect page at /app/connect when visited before signing in. */
export function PublicConnectChatGpt({ googleSsoAvailable }: { googleSsoAvailable: boolean }) {
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
      <PageHeader
        title="Connect Venn to ChatGPT"
        lead="One click copies the MCP URL and opens ChatGPT connector settings so anyone can connect in under a minute."
      />
      <ConnectWorkflowBody mcpUrl={mcpUrl} googleSsoAvailable={googleSsoAvailable} />
    </main>
  );
}
