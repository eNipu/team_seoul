"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MCP_URL = "https://app.joinvennai.com/mcp";
const CHATGPT_CONNECTORS_URL = "https://chatgpt.com/#settings/Connectors";
const CHATGPT_PLUGINS_URL = "https://chatgpt.com/plugins";
const CHATGPT_TEST_URL = "https://chatgpt.com/?q=Open%20Venn";
const MY_VENN_URL = "https://app.joinvennai.com/app/";

let lastAnnouncement = "";

function legacyCopy(text: string): boolean {
  const field = Object.assign(document.createElement("textarea"), { value: text });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
  }
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to synchronous execCommand fallback when Clipboard API is unavailable or denied.
  }
  try {
    return legacyCopy(text);
  } catch {
    return false;
  }
}

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

function CopyChip({
  value,
  label,
  ariaLabel,
  id,
}: {
  value: string;
  label: string;
  ariaLabel: string;
  id: string;
}) {
  const { state, report } = useCopyStatus();

  async function onCopy() {
    const ok = await writeClipboard(value);
    report(ok);
  }

  return (
    <span className="connect-copy">
      <button
        type="button"
        className="btn btn--small connect-copy__btn"
        aria-label={ariaLabel}
        aria-describedby={id}
        data-copied={state.status === "copied" ? "" : undefined}
        data-failed={state.status === "failed" ? "" : undefined}
        onClick={() => void onCopy()}
      >
        {state.status === "copied" ? "Copied" : label}
      </button>
      <span id={id} className="connect-copy__tip" role="status" data-show={state.status !== "idle" ? "true" : "false"}>
        {state.text}
      </span>
    </span>
  );
}

export default function ConnectWorkflow() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [completed, setCompleted] = useState<Record<1 | 2 | 3, boolean>>({ 1: false, 2: false, 3: false });
  const launchStatus = useCopyStatus();

  async function copyAndOpenChatGpt() {
    const ok = await writeClipboard(MCP_URL);
    launchStatus.report(ok, "URL copied. ChatGPT opened.");
    window.open(CHATGPT_CONNECTORS_URL, "_blank", "noopener,noreferrer");
    setCompleted((prev) => ({ ...prev, 1: true }));
    setActiveStep(2);
  }

  function markDone(step: 1 | 2 | 3) {
    setCompleted((prev) => ({ ...prev, [step]: true }));
    if (step < 3) setActiveStep((step + 1) as 2 | 3);
  }

  const doneCount = Number(completed[1]) + Number(completed[2]) + Number(completed[3]);

  return (
    <div className="connect-flow">
      <div className="connect-hero card">
        <div className="connect-hero__top">
          <span className="badge">1-click guided setup</span>
          <span className="connect-hero__progress" aria-live="polite">
            {doneCount} of 3 done
          </span>
        </div>
        <h2 className="connect-hero__title">Copy the link and jump straight to ChatGPT settings.</h2>
        <p className="connect-hero__lead">
          One click copies Venn’s MCP server address and opens ChatGPT’s connector settings in a new tab. Keep this page
          open beside it to finish in under a minute.
        </p>

        <div className="connect-hero__actions">
          <span className="connect-copy connect-copy--primary">
            <button
              type="button"
              className={activeStep === 3 ? "btn" : "btn btn--primary"}
              data-copied={launchStatus.state.status === "copied" ? "" : undefined}
              data-failed={launchStatus.state.status === "failed" ? "" : undefined}
              onClick={() => void copyAndOpenChatGpt()}
            >
              Copy MCP URL &amp; open ChatGPT
            </button>
            <span
              className="connect-copy__tip"
              role="status"
              data-show={launchStatus.state.status !== "idle" ? "true" : "false"}
            >
              {launchStatus.state.text}
            </span>
          </span>
          <a className="btn" href={MY_VENN_URL}>
            Sign in to My Venn first
          </a>
        </div>

        <div className="connect-url-row">
          <span className="connect-url-row__label">MCP Server URL</span>
          <code className="connect-url-row__value">{MCP_URL}</code>
          <CopyChip value={MCP_URL} label="Copy URL" ariaLabel="Copy Venn MCP server URL" id="connect-url-tip" />
        </div>
      </div>

      <ol className="connect-steps" aria-label="Steps to connect Venn in ChatGPT">
        <li className="connect-step card" data-active={activeStep === 1} data-done={completed[1]}>
          <div className="connect-step__head">
            <span className="connect-step__num" aria-hidden="true">
              {completed[1] ? "✓" : "1"}
            </span>
            <div>
              <h3>Open ChatGPT connector settings</h3>
              <p className="muted">
                Use the button above, or jump straight to ChatGPT Connectors (or Plugins on older plans) below.
              </p>
            </div>
          </div>
          <div className="connect-step__foot">
            <a className="btn btn--small" href={CHATGPT_CONNECTORS_URL} target="_blank" rel="noopener noreferrer">
              Open ChatGPT Connectors
            </a>
            <a className="btn btn--small" href={CHATGPT_PLUGINS_URL} target="_blank" rel="noopener noreferrer">
              Open ChatGPT Plugins
            </a>
          </div>
          <details className="connect-tip">
            <summary>Don’t see “Create” or “Add custom MCP server”?</summary>
            <p>
              In ChatGPT, open <strong>Settings → Apps &amp; Connectors → Advanced</strong> and switch on{" "}
              <strong>Developer mode</strong>. Custom MCP servers appear right away once Developer mode is enabled.
            </p>
          </details>
        </li>

        <li className="connect-step card" data-active={activeStep === 2} data-done={completed[2]}>
          <div className="connect-step__head">
            <span className="connect-step__num" aria-hidden="true">
              {completed[2] ? "✓" : "2"}
            </span>
            <div>
              <h3>Paste Venn’s details and choose OAuth</h3>
              <p className="muted">Enter these three fields in ChatGPT. Leave Client ID and Client Secret blank.</p>
            </div>
          </div>
          <dl className="connect-kv">
            <div className="connect-kv__row">
              <dt>Name</dt>
              <dd>
                <code>Venn</code>
                <CopyChip value="Venn" label="Copy" ariaLabel="Copy app name Venn" id="connect-name-tip" />
              </dd>
            </div>
            <div className="connect-kv__row">
              <dt>MCP Server URL</dt>
              <dd>
                <code>{MCP_URL}</code>
                <CopyChip value={MCP_URL} label="Copy" ariaLabel="Copy MCP server URL" id="connect-step2-url-tip" />
              </dd>
            </div>
            <div className="connect-kv__row">
              <dt>Authentication</dt>
              <dd>
                <span>
                  <strong>OAuth</strong> <span className="muted">(automatic—no keys required)</span>
                </span>
              </dd>
            </div>
          </dl>
          <div className="connect-step__foot">
            <button type="button" className="btn btn--small" onClick={() => markDone(2)}>
              {completed[2] ? "Done — go to step 3" : "I added Venn in ChatGPT"}
            </button>
          </div>
        </li>

        <li className="connect-step card" data-active={activeStep === 3} data-done={completed[3]}>
          <div className="connect-step__head">
            <span className="connect-step__num" aria-hidden="true">
              {completed[3] ? "✓" : "3"}
            </span>
            <div>
              <h3>Sign in with Google and test Venn</h3>
              <p className="muted">
                When ChatGPT asks you to connect, click <strong>Continue with Google</strong> (or{" "}
                <strong>Continue as your name</strong> if you already signed in to My Venn). Your web app and ChatGPT
                share the exact same account.
              </p>
            </div>
          </div>
          <div className="connect-step__foot">
            <a
              className={activeStep === 3 ? "btn btn--primary" : "btn"}
              href={CHATGPT_TEST_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => markDone(3)}
            >
              Open ChatGPT &amp; say “Open Venn”
            </a>
            <a className="btn" href={MY_VENN_URL}>
              Open My Venn
            </a>
          </div>
        </li>
      </ol>

      <p className="connect-promise">
        Private by default. Only what you approve is saved, and Venn never contacts anyone for you.
      </p>
    </div>
  );
}
