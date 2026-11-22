// Import from a LinkedIn export, a session, or a fictional demo network.

import { useMemo, useRef, useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { plural, type LinkedInConnections, type LinkedInImport, type PeopleImport } from "../types";
import { Avatar, Field, InlineError, Notice, Tag, useAction } from "../ui";
import { ImportReview } from "./ImportReview";

const MAX_COOKIE_CHARS = 20000;

const MAX_FILE_BYTES = 4_000_000;

const METHODS = { file: "Export file", cookies: "Session cookies", demo: "Demo connections" } as const;
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
        intro={<Notice tone="quiet">These profiles are fictional. Any you add will be marked as samples.</Notice>}
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
          Choose up to {max} to import. No one is added yet.
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
        {!list.details_available && (
          <Notice tone="quiet">
            People are imported with their name and LinkedIn headline. Company, location and skills need an Apify
            token on this server.
          </Notice>
        )}
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
    <div className="tabs" role="group" aria-label="How to import">
      {(Object.keys(METHODS) as Method[]).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={way === t}
          disabled={action.busy}
          className={`tabs__tab ${way === t ? "tabs__tab--on" : ""}`}
          onClick={() => {
            setWay(t);
            action.clear();
          }}
        >
          {METHODS[t]}
        </button>
      ))}
    </div>
  );

  if (way === "demo") {
    return (
      <div className="stack">
        {tabs}
        <p className="dialog__text">
          Try the import with 100 fictional, AI-generated LinkedIn-style profiles. No LinkedIn account, cookies,
          or export file needed.
        </p>
        <Notice tone="quiet">
          Review who to add before saving. On Home, <strong>Remove sample data</strong> clears these profiles along
          with any other sample data.
        </Notice>
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
            onClick={() => void action.run(async () => setPreview({ kind: "demo", data: await api.linkedinDemoPreview() }))}
          >
            {action.busy ? "Loading…" : "Review 100 demo connections"}
          </button>
        </div>
      </div>
    );
  }

  if (way === "file") {
    return (
      <div className="stack">
        {tabs}
        <p className="dialog__text">
          LinkedIn can send you your connections as a file. This is the way LinkedIn allows, and it needs no
          cookies.
        </p>
        <ol className="steps">
          <li>
            On LinkedIn: <strong>Settings &amp; Privacy → Data privacy → Get a copy of your data</strong>.
          </li>
          <li>
            Pick <strong>Connections</strong> and request the archive. It arrives by email, usually within
            minutes.
          </li>
          <li>
            Upload the <code>Connections.csv</code> from it here.
          </li>
        </ol>
        <Field label="Connections.csv" hint="The file is read in your browser and sent to Venn as text.">
          {(p) => (
            <input
              {...p}
              type="file"
              accept=".csv,text/csv"
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
          )}
        </Field>
        {action.busy && <p className="muted">Reading {fileName}…</p>}
        <Notice tone="quiet">
          Nothing is added until you pick who to import and confirm. Email addresses in the file are ignored.
        </Notice>
        <InlineError message={action.error} />
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onCancel} disabled={action.busy}>
            Cancel
          </button>
        </div>
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
      {tabs}
      <p className="dialog__text">
        Venn reads your connection list with your LinkedIn session, then you choose who to import.
      </p>
      <ol className="steps">
        <li>Sign in to LinkedIn in this browser.</li>
        <li>
          Copy <strong>all</strong> LinkedIn cookies with a cookie-export extension such as “Copy Cookies”.
          LinkedIn ties <code>li_at</code> to the other cookies of the same browser, so a partial copy is
          usually signed out at once.
        </li>
        <li>Paste them below.</li>
      </ol>
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
        These cookies give full access to your LinkedIn account. Venn uses them once to read your connection list
        and does not store them. LinkedIn's terms don't allow automated access: it usually signs the session out
        after the first pages, so expect your most recent connections only, and to be signed out of LinkedIn. The
        export file is the reliable way.
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
    </form>
  );
}
