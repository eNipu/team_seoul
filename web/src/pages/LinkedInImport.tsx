// Import from a LinkedIn export, a session, or a fictional demo network.

import { useMemo, useRef, useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { plural, type LinkedInConnections, type LinkedInImport, type PeopleImport } from "../types";
import { Avatar, Field, InlineError, Notice, Tag, useAction } from "../ui";
import { ImportReview } from "./ImportReview";
import "./tools.css";

const MAX_COOKIE_CHARS = 20000;

const MAX_FILE_BYTES = 4_000_000;

const METHODS = { file: "Export file", cookies: "Session cookies", demo: "Built-in preview" } as const;
type Method = keyof typeof METHODS;
type Preview = { kind: "linkedin"; data: LinkedInImport } | { kind: "demo"; data: PeopleImport };

export function LinkedInFlow({
  onDone,
  onCancel,
}: {
  onDone: (count: number, kind: Preview["kind"]) => void;
  onCancel: () => void;
}) {
  const [way, setWay] = useState<Method>("file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [cookies, setCookies] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [list, setList] = useState<LinkedInConnections | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const action = useAction();
  const returnedFromDemo = useRef(false);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const all = list?.connections ?? [];
    return q ? all.filter((c) => `${c.name} ${c.headline ?? ""}`.toLowerCase().includes(q)) : all;
  }, [list, filter]);

  if (preview?.kind === "demo") {
    return (
      <ImportReview
        preview={preview.data}
        selectionTools
        onBack={() => {
          returnedFromDemo.current = true;
          setPreview(null);
        }}
        onDone={(count) => onDone(count, "demo")}
        intro={<Notice tone="quiet">Selected profiles are saved as private notes.</Notice>}
      />
    );
  }

  if (preview?.kind === "linkedin") {
    const data = preview.data;
    return (
      <ImportReview
        preview={data}
        onBack={() => setPreview(null)}
        onDone={(count) => onDone(count, "linkedin")}
        intro={
          data.details_error ? (
            <Notice icon="alert" tone="quiet">
              Profile details could not be fetched ({data.details_error}) These people have their LinkedIn headline
              only.
            </Notice>
          ) : list?.details_available && data.details_for < data.candidates.length ? (
            <Notice tone="quiet">
              Profile details were found for {data.details_for} of {data.candidates.length}. The others have their
              LinkedIn headline only.
            </Notice>
          ) : undefined
        }
      />
    );
  }

  if (list) {
    const max = list.max_import;
    const full = picked.length >= max;
    const overDetails = list.details_available && picked.length > list.max_details;
    return (
      <div className="stack">
        <p className="dialog__text">
          {list.total !== null && list.total > list.count
            ? `Showing your ${list.count} most recent connections of ${list.total}.`
            : `${plural(list.count, "connection", "connections")} found.`}{" "}
          Pick up to {max}.
        </p>
        {list.stopped && (
          <Notice icon="alert" tone="quiet">
            {list.stopped} For the full list, use your LinkedIn connections export file instead.
          </Notice>
        )}
        <label className="filter filter--wide">
          <Icon name="search" size={18} />
          <span className="sr-only">Filter connections</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or headline"
          />
        </label>
        {shown.length === 0 ? (
          <p className="muted">No connection matches “{filter.trim()}”.</p>
        ) : (
          <ul className="review">
            {shown.map((c) => {
              const key = c.public_identifier ?? c.name;
              const on = picked.includes(key);
              const off = c.already_added || (!on && full);
              return (
                <li key={key}>
                  <label className={`review__row ${off ? "review__row--off" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={off}
                      onChange={() => setPicked(on ? picked.filter((p) => p !== key) : [...picked, key])}
                    />
                    <Avatar name={c.name} size="small" />
                    <span className="review__text">
                      <strong>{c.name}</strong>
                      <span className="muted small">{c.headline ?? "No headline"}</span>
                    </span>
                    {c.already_added && <Tag icon="check">Already in your people</Tag>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="count" aria-live="polite">
          {picked.length} of {max} selected
          {overDetails && `. Profile details are fetched for the first ${list.max_details}.`}
        </p>
        <InlineError message={action.error} />
        <div className="dialog__actions">
          <button type="button" className="btn" disabled={action.busy} onClick={() => setList(null)}>
            Back
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={action.busy || picked.length === 0}
            onClick={() =>
              void action.run(async () => {
                const people = list.connections
                  .filter((c) => picked.includes(c.public_identifier ?? c.name))
                  .map((c) => ({ public_identifier: c.public_identifier, name: c.name, headline: c.headline }));
                setPreview({ kind: "linkedin", data: await api.linkedinPreview(people) });
              })
            }
          >
            {action.busy
              ? list.details_available
                ? "Fetching profiles… this can take a minute"
                : "Preparing…"
              : picked.length === 0
                ? "Choose at least one"
                : `Review ${plural(picked.length, "person", "people")}`}
          </button>
        </div>
      </div>
    );
  }

  const tabs = (
    <details className="tl__more" open={way !== "file"}>
      <summary>Other ways</summary>
      <div className="tl__row" role="group" aria-label="How to import">
        {(Object.keys(METHODS) as Method[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={way === t}
            disabled={action.busy || way === t}
            className="tl__link"
            onClick={() => {
              setWay(t);
              action.clear();
            }}
          >
            {METHODS[t]}
          </button>
        ))}
      </div>
    </details>
  );

  if (way === "demo") {
    return (
      <div className="stack">
        <p className="dialog__text">100 built-in LinkedIn-style profiles, marked as preview.</p>
        <InlineError message={action.error} />
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onCancel} disabled={action.busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={action.busy}
            ref={(button) => {
              if (button && returnedFromDemo.current) {
                returnedFromDemo.current = false;
                button.focus();
              }
            }}
            onClick={() =>
              void action.run(async () => setPreview({ kind: "demo", data: await api.demoPeoplePreview("linkedin") }))
            }
          >
            {action.busy ? "Loading…" : "Preview profiles"}
          </button>
        </div>
        {tabs}
      </div>
    );
  }

  if (way === "file") {
    return (
      <div className="stack">
        <p className="dialog__text">Upload your LinkedIn Connections.csv. You choose who to add.</p>
        <div>
          <label className="tl__cta">
            <input
              type="file"
              className="sr-only"
              accept=".csv,text/csv"
              disabled={action.busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                void action.run(async () => {
                  if (file.size > MAX_FILE_BYTES) throw new Error("That file is too large.");
                  const result = await api.linkedinExport(await file.text());
                  setPicked([]);
                  setFilter("");
                  setList(result);
                });
              }}
            />
            Choose Connections.csv
          </label>
        </div>
        <details className="tl__more">
          <summary>Where do I get it?</summary>
          <p className="dialog__text">
            <span>
              On LinkedIn: <strong>Settings → Data privacy → Get a copy of your data → Connections</strong>. It
              arrives by email.
            </span>
          </p>
        </details>
        {action.busy && <p className="muted">Reading {fileName}…</p>}
        <InlineError message={action.error} />
        {tabs}
      </div>
    );
  }

  const ready = cookies.trim().length > 0 && cookies.length <= MAX_COOKIE_CHARS && agreed;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        void action.run(async () => {
          const result = await api.linkedinConnections(cookies);
          setCookies(""); // not kept in the page once they have been used
          setPicked([]);
          setFilter("");
          setList(result);
        });
      }}
    >
      <p className="dialog__text">
        <span>
          Copy <strong>all</strong> your LinkedIn cookies with an extension such as “Copy Cookies” and paste them here.
        </span>
      </p>
      <Field
        label="LinkedIn cookies"
        hint={
          <>
            The extension's copied text, or <code>li_at=…; JSESSIONID=…</code>.
          </>
        }
        error={cookies.length > MAX_COOKIE_CHARS ? "That is too long to be LinkedIn cookies." : null}
      >
        {(p) => (
          <textarea
            {...p}
            className="mono"
            rows={4}
            value={cookies}
            onChange={(e) => setCookies(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
        )}
      </Field>
      <Notice icon="shield" tone="quiet">
        Cookies give full access to your account. Venn uses them once and doesn't store them. LinkedIn may sign you
        out and return only recent connections; the export file is more reliable.
      </Notice>
      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>This is my own LinkedIn account and I understand the risk.</span>
      </label>
      <InlineError message={action.error} />
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={action.busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={action.busy || !ready}>
          {action.busy ? "Reading your connections…" : "Get my connections"}
        </button>
      </div>
      {tabs}
    </form>
  );
}
