import { useEffect, useRef, useState } from "react";
import { buildMemoryImportPrompt } from "../memoryImport";
import { plural, type MemoryImportViewData } from "../types";
import { ActionError, EmptyNote, copyText, useAction, type ViewProps } from "./common";
import { Icon, Illustration } from "./icons";
import "./memoryImportPicker.css";

type Phase = "choosing" | "sending" | "sent" | "manual";

export default function MemoryImport({ data, bridge, nav }: ViewProps<MemoryImportViewData>) {
  const action = useAction();
  const [picked, setPicked] = useState(() => new Set(data.areas.filter((a) => a.selected).map((a) => a.value)));
  const [phase, setPhase] = useState<Phase>("choosing");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectHint, setSelectHint] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const resultRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Move focus to the outcome so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (phase === "sent" || phase === "manual") resultRef.current?.focus();
  }, [phase]);

  const count = data.areas.filter((a) => picked.has(a.value)).length;
  const busy = phase === "sending" || action.busy !== null;

  function toggle(value: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function preview() {
    if (count === 0 || busy) return;
    const text = buildMemoryImportPrompt(data.areas, picked, data.max_items);
    setPrompt(text);
    setPhase("sending");
    let sent = false;
    try {
      sent = await bridge.sendMessage(text);
    } catch {
      sent = false;
    }
    if (sent && bridge.isMock) {
      setPhase("choosing");
      await action.run("preview", () => nav.openView("mock_prepare_memory_import", { areas: [...picked] }));
      return;
    }
    setPhase(sent ? "sent" : "manual");
  }

  function chooseAgain() {
    window.clearTimeout(timer.current);
    setCopied(false);
    setSelectHint(false);
    setPhase("choosing");
  }

  async function copy() {
    const ok = await copyText(prompt);
    window.clearTimeout(timer.current);
    if (ok) {
      setSelectHint(false);
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } else {
      // Clipboard blocked: select the text so Ctrl/Cmd+C works right away.
      setCopied(false);
      setSelectHint(true);
      promptRef.current?.focus();
      promptRef.current?.select();
    }
  }

  return (
    <section className="panel">
      <div className="hero">
        <Illustration name="import" />
        <h2>Import from ChatGPT</h2>
        <p className="muted small">
          Choose topics. ChatGPT will send matching drafts to Venn for review. Only what you import on the next card becomes a saved memory.
        </p>
      </div>
      {data.imported_count > 0 && (
        <p className="hint hint--ok">
          <Icon name="check" size={16} />
          <span>{plural(data.imported_count, "memory", "memories")} already imported from ChatGPT.</span>
        </p>
      )}

      <ActionError action={action} />
      {data.areas.length === 0 ? (
        <EmptyNote art="search" title="Nothing to choose from">
          Venn didn't offer any areas to import. Ask Venn to try again.
        </EmptyNote>
      ) : phase === "sent" ? (
        <div className="handoff handoff--ok">
          <h3 ref={resultRef} tabIndex={-1} role="status">
            <Icon name="chat" /> Looking for memories
          </h3>
          <p className="small">
            ChatGPT will open the import card if it finds anything. You don’t need to reply in chat.
          </p>
          <div className="button-row">
            <button type="button" className="btn" onClick={chooseAgain}>
              Choose again
            </button>
          </div>
        </div>
      ) : phase === "manual" ? (
        <div className="handoff">
          <h3 ref={resultRef} tabIndex={-1} role="status">
            Paste this into the chat to start.
          </h3>
          <label className="field manual-copy">
            <span className="field__label">{selectHint ? "Press Ctrl/Cmd+C to copy" : "Message for ChatGPT"}</span>
            <textarea ref={promptRef} className="handoff__prompt" readOnly rows={8} value={prompt} onFocus={(e) => e.target.select()} />
          </label>
          <div className="button-row">
            <button type="button" className="btn btn--primary" onClick={() => void copy()}>
              <Icon name={copied ? "check" : "copy"} size={18} />
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" className="btn" onClick={chooseAgain}>
              Choose again
            </button>
          </div>
          <span className="sr-only" role="status">
            {copied ? "Copied to clipboard" : ""}
          </span>
        </div>
      ) : (
        <>
          <fieldset className="area-picker" disabled={busy}>
            <legend className="section-title">Topics to preview</legend>
            <ul className="list pick-list memory-import-topics">
              {data.areas.map((a) => {
                const on = picked.has(a.value);
                return (
                  <li key={a.value}>
                    <label className={`pick ${on ? "pick--on" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(a.value)} />
                      <span className="pick__body">
                        <strong>{a.label}</strong>
                        {a.description && <span className="muted small">{a.description}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {data.always_excluded && (
            <p className="trust">
              <Icon name="shield" size={16} />
              <span>{data.always_excluded}</span>
            </p>
          )}

          <div className="sticky-bar">
            <button type="button" className="btn btn--primary btn--block" disabled={busy || count === 0} onClick={() => void preview()}>
              <Icon name="chat" size={18} />
              {busy ? "Finding memories…" : "Find memories"}
            </button>
          </div>
          {count === 0 && (
            <p className="muted small" role="status">
              Tick at least one area to continue.
            </p>
          )}
        </>
      )}
    </section>
  );
}
