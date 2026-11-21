// Import from LinkedIn: paste your session cookies, pick connections, review, add.

import { useMemo, useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { plural, type LinkedInConnections, type LinkedInImport } from "../types";
import { Avatar, Field, InlineError, Notice, Tag, useAction } from "../ui";
import { ImportReview } from "./ImportReview";

const MAX_COOKIE_CHARS = 20000;

export function LinkedInFlow({ onDone, onCancel }: { onDone: (count: number) => void; onCancel: () => void }) {
  const [cookies, setCookies] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [list, setList] = useState<LinkedInConnections | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [preview, setPreview] = useState<LinkedInImport | null>(null);
  const action = useAction();

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const all = list?.connections ?? [];
    return q ? all.filter((c) => `${c.name} ${c.headline ?? ""}`.toLowerCase().includes(q)) : all;
  }, [list, filter]);

  if (preview) {
    return (
      <ImportReview
        preview={preview}
        onBack={() => setPreview(null)}
        onDone={onDone}
        intro={
          preview.details_error ? (
            <Notice icon="alert" tone="quiet">
              Profile details could not be fetched ({preview.details_error}) These people have their LinkedIn
              headline only.
            </Notice>
          ) : list?.details_available && preview.details_for < preview.candidates.length ? (
            <Notice tone="quiet">
              Profile details were found for {preview.details_for} of {preview.candidates.length}. The others have
              their LinkedIn headline only.
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
              const on = picked.includes(c.public_identifier);
              const off = c.already_added || (!on && full);
              return (
                <li key={c.public_identifier}>
                  <label className={`review__row ${off ? "review__row--off" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={off}
                      onChange={() =>
                        setPicked(
                          on ? picked.filter((p) => p !== c.public_identifier) : [...picked, c.public_identifier],
                        )
                      }
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
                  .filter((c) => picked.includes(c.public_identifier))
                  .map((c) => ({ public_identifier: c.public_identifier, name: c.name, headline: c.headline }));
                setPreview(await api.linkedinPreview(people));
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
        Venn reads your connection list with your LinkedIn session, then you choose who to import.
      </p>
      <ol className="steps">
        <li>Sign in to LinkedIn in this browser.</li>
        <li>
          Copy your LinkedIn cookies with a cookie-export extension such as “Copy Cookies”, or copy the{" "}
          <code>li_at</code> and <code>JSESSIONID</code> values from your browser's developer tools.
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
        and does not store them. LinkedIn's terms don't allow automated access, and LinkedIn may restrict accounts
        that use it.
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
