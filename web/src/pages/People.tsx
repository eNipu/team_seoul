// People: connections and your private notes in one list.

import { useMemo, useState } from "react";
import { api } from "../api";
import { Icon } from "../icons";
import { Link, navigate, useLocation } from "../router";
import {
  LIMITS,
  daysSince,
  formatLastSeen,
  friendPath,
  plural,
  type FriendSummary,
  type PeopleImport,
  type PersonInput,
} from "../types";
import {
  Avatar,
  Chips,
  Dialog,
  EmptyState,
  Field,
  InlineError,
  KindTag,
  Loaded,
  Notice,
  PageHeader,
  Skeleton,
  Tag,
  useAction,
  useAsync,
  useToast,
} from "../ui";
import { PersonForm } from "./shared";

type Sort = "name" | "seen";

const IMPORT_EXAMPLE = `Maya Chen, college roommate, photography; pottery
Daniel Okafor, colleague, board games
Sofia Rossi`;

/** One person per line: `Name, relationship, interest; interest`. */
export function parseImportLines(text: string): PersonInput[] {
  const out: PersonInput[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [name, relationship, ...rest] = line.split(",").map((p) => p.trim());
    if (!name) continue;
    const person: PersonInput = { name: name.slice(0, LIMITS.personName) };
    if (relationship) person.relationship = relationship.slice(0, LIMITS.relationship);
    const interests = rest
      .join(",")
      .split(/[;,]/)
      .map((i) => i.trim().slice(0, LIMITS.interestLength))
      .filter(Boolean)
      .slice(0, LIMITS.interestCount);
    if (interests.length) person.interests = interests;
    out.push(person);
  }
  return out;
}

function ImportFlow({ onDone, onCancel }: { onDone: (count: number) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PeopleImport | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const action = useAction();
  const parsed = useMemo(() => parseImportLines(text), [text]);
  const tooMany = parsed.length > LIMITS.importPeople;

  if (preview) {
    const selectable = preview.candidates.filter((c) => !c.already_added);
    return (
      <div className="stack">
        <p className="dialog__text">
          Check who to add. Nothing is added until you confirm.
          {preview.skipped > 0 && ` ${plural(preview.skipped, "line was", "lines were")} skipped.`}
        </p>
        <ul className="review">
          {preview.candidates.map((c) => {
            const on = checked.includes(c.index);
            return (
              <li key={c.index}>
                <label className={`review__row ${c.already_added ? "review__row--off" : ""}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={c.already_added}
                    onChange={() => setChecked(on ? checked.filter((i) => i !== c.index) : [...checked, c.index])}
                  />
                  <Avatar name={c.name} size="small" />
                  <span className="review__text">
                    <strong>{c.name}</strong>
                    <span className="muted small">
                      {[c.relationship, c.interests.join(", ")].filter(Boolean).join(" · ") || "No details"}
                    </span>
                  </span>
                  {c.already_added && <Tag icon="check">Already in your people</Tag>}
                </label>
              </li>
            );
          })}
        </ul>
        <InlineError message={action.error} />
        <div className="dialog__actions">
          <button type="button" className="btn" disabled={action.busy} onClick={() => setPreview(null)}>
            Back
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={action.busy || checked.length === 0}
            onClick={() =>
              void action.run(async () => {
                const people = await api.importPeople(preview.import_id, [...checked].sort((a, b) => a - b));
                onDone(people.length);
              })
            }
          >
            {action.busy
              ? "Adding…"
              : checked.length === 0
                ? selectable.length === 0
                  ? "Everyone is already added"
                  : "Choose at least one"
                : `Add ${plural(checked.length, "person", "people")}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed.length === 0 || tooMany) return;
        void action.run(async () => {
          const result = await api.previewImport(parsed, "website");
          setPreview(result);
          setChecked(result.candidates.filter((c) => !c.already_added).map((c) => c.index));
        });
      }}
    >
      <Field
        label="One person per line"
        hint={
          <>
            Format: <code>Name, relationship, interest; interest</code>. Only the name is required. Up to{" "}
            {LIMITS.importPeople} people at a time.
          </>
        }
        error={tooMany ? `That's ${parsed.length} people; import up to ${LIMITS.importPeople} at a time.` : null}
      >
        {(p) => (
          <textarea
            {...p}
            className="mono"
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={IMPORT_EXAMPLE}
            autoFocus
          />
        )}
      </Field>
      <div className="example">
        <p className="example__label">Example</p>
        <pre>{IMPORT_EXAMPLE}</pre>
        <button type="button" className="btn btn--small" onClick={() => setText(IMPORT_EXAMPLE)}>
          Use this example
        </button>
      </div>
      <Notice icon="shield" tone="quiet">
        You'll review the list before anything is added. Venn doesn't read your contacts.
      </Notice>
      <InlineError message={action.error} />
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={action.busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={action.busy || parsed.length === 0 || tooMany}>
          {action.busy ? "Checking…" : parsed.length ? `Review ${plural(parsed.length, "person", "people")}` : "Review"}
        </button>
      </div>
    </form>
  );
}

function PersonRow({ f }: { f: FriendSummary }) {
  return (
    <li>
      <Link to={friendPath(f.kind, f.id)} className="person-row">
        <Avatar name={f.display_name} />
        <span className="person-row__main">
          <span className="person-row__name">
            <strong>{f.display_name}</strong>
            <KindTag onVenn={f.on_venn} />
            {f.is_sample && <Tag tone="info">Sample</Tag>}
          </span>
          <span className="muted small">
            {[f.relationship, formatLastSeen(f.last_interaction_at)].filter(Boolean).join(" · ")}
          </span>
          <Chips items={f.interests.slice(0, 4)} />
        </span>
        <span className="person-row__side">
          {f.open_follow_ups > 0 && (
            <Tag tone="warn" icon="flag">
              {plural(f.open_follow_ups, "follow-up", "follow-ups")}
            </Tag>
          )}
          <Icon name="chevron-right" size={18} />
        </span>
      </Link>
    </li>
  );
}

export default function People() {
  const loc = useLocation();
  const friends = useAsync(() => api.listFriends(), []);
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const dialog = loc.query.get("new") === "1" ? "add" : loc.query.get("import") === "1" ? "import" : null;
  const close = () => navigate("/people", {}, { replace: true });

  const shown = useMemo(() => {
    const list = friends.data ?? [];
    const q = filter.trim().toLowerCase();
    const hit = q
      ? list.filter((f) =>
          [f.display_name, f.relationship ?? "", ...f.interests].some((s) => s.toLowerCase().includes(q)),
        )
      : list;
    return [...hit].sort((a, b) => {
      if (sort === "seen") {
        // Longest since seen first; people never seen come first of all.
        const da = daysSince(a.last_interaction_at) ?? Number.POSITIVE_INFINITY;
        const db = daysSince(b.last_interaction_at) ?? Number.POSITIVE_INFINITY;
        if (da !== db) return db - da;
      }
      return a.display_name.localeCompare(b.display_name);
    });
  }, [friends.data, filter, sort]);

  return (
    <div className="page">
      <PageHeader
        title="People"
        lead="Everyone in your circle: friends on Venn and the private notes you keep."
        actions={
          <>
            <Link to="/people" query={{ import: "1" }} className="btn">
              <Icon name="import" size={18} />
              Import a list
            </Link>
            <Link to="/people" query={{ new: "1" }} className="btn btn--primary">
              <Icon name="user-plus" size={18} />
              Add a person
            </Link>
          </>
        }
      />
      <Loaded state={friends} skeleton={<Skeleton rows={5} />}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              illustration="friends"
              title="No one here yet"
              actions={
                <>
                  <Link to="/people" query={{ new: "1" }} className="btn btn--primary">
                    Add your first person
                  </Link>
                  <Link to="/people" query={{ import: "1" }} className="btn">
                    Import a list
                  </Link>
                </>
              }
            >
              <p>Add someone you'd like to stay close to. They don't need a Venn account.</p>
            </EmptyState>
          ) : (
            <>
              <div className="toolbar">
                <label className="filter">
                  <Icon name="search" size={18} />
                  <span className="sr-only">Filter people</span>
                  <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter by name, relationship or interest"
                  />
                </label>
                <label className="select">
                  <span>Sort</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value === "seen" ? "seen" : "name")}>
                    <option value="name">Name</option>
                    <option value="seen">Longest since seen</option>
                  </select>
                </label>
              </div>
              <p className="count" aria-live="polite">
                {filter.trim()
                  ? `${shown.length} of ${plural(list.length, "person", "people")}`
                  : plural(list.length, "person", "people")}
              </p>
              {shown.length === 0 ? (
                <div className="card">
                  <p className="muted">
                    No one matches “{filter.trim()}”.{" "}
                    <button type="button" className="link-btn" onClick={() => setFilter("")}>
                      Clear the filter
                    </button>
                  </p>
                </div>
              ) : (
                <ul className="people card card--flush">
                  {shown.map((f) => (
                    <PersonRow key={`${f.kind}:${f.id}`} f={f} />
                  ))}
                </ul>
              )}
            </>
          )
        }
      </Loaded>

      {dialog === "add" && (
        <Dialog title="Add a person" onClose={close}>
          <PersonForm
            onCancel={close}
            onSaved={(p) => {
              toast(`${p.name} added to your people.`);
              close();
              friends.reload();
            }}
          />
        </Dialog>
      )}
      {dialog === "import" && (
        <Dialog title="Import a list" onClose={close} wide>
          <ImportFlow
            onCancel={close}
            onDone={(n) => {
              toast(`Added ${plural(n, "person", "people")}.`);
              close();
              friends.reload();
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
