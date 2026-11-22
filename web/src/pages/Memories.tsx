// Memories: what Venn has saved about you, the same here and in ChatGPT.

import { useEffect, useMemo, useState } from "react";
import { api, DEMO } from "../api";
import { CategoryIcon, Icon, type IconName } from "../icons";
import { Link, navigate, useLocation } from "../router";
import {
  CATEGORY_GROUP_LABELS,
  CATEGORY_LABELS,
  LIMITS,
  MEMORY_CATEGORIES,
  VISIBILITIES,
  VISIBILITY_HINTS,
  VISIBILITY_LABELS,
  formatDate,
  plural,
  type FriendSummary,
  type Memory,
  type MemoryCategory,
  type Visibility,
} from "../types";
import {
  ChipsInput,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  InlineError,
  Loaded,
  Notice,
  PageHeader,
  Skeleton,
  Tag,
  useAction,
  useAsync,
  useToast,
} from "../ui";

const VISIBILITY_ICON: Record<Visibility, IconName> = {
  PRIVATE: "lock",
  SHARED_WITH_CONNECTIONS: "users",
  PUBLIC_PROFILE: "user",
};

function VisibilityField({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <fieldset className="radios">
      <legend>Who can see it</legend>
      {VISIBILITIES.map((v) => (
        <label key={v} className={`radio ${value === v ? "radio--on" : ""}`}>
          <input type="radio" name="visibility" checked={value === v} onChange={() => onChange(v)} />
          <span>
            <strong>{VISIBILITY_LABELS[v]}</strong>
            <span className="muted small">{VISIBILITY_HINTS[v]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** True when a typed name already matches someone (full name or first name). */
function inCircle(name: string, friends: FriendSummary[]): boolean {
  const n = name.trim().toLowerCase();
  return friends.some((f) => {
    const full = f.display_name.trim().toLowerCase();
    return full === n || full.split(/\s+/)[0] === n;
  });
}

function AddMemoryForm({ onSaved, onCancel }: { onSaved: (title: string, added: string[]) => void; onCancel: () => void }) {
  const friends = useAsync(() => api.listFriends(), []);
  const [category, setCategory] = useState<MemoryCategory>("INTEREST");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
  const action = useAction();

  const list = friends.data ?? [];
  const people = useMemo(() => {
    const out: string[] = [];
    for (const n of [...picked, ...typed]) if (!out.some((o) => o.toLowerCase() === n.toLowerCase())) out.push(n);
    return out;
  }, [picked, typed]);
  const newNames = friends.data ? typed.filter((n) => !inCircle(n, list)) : [];

  const submit = () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Give it a short title.";
    if (!description.trim()) next.description = "Say what Venn should remember.";
    setErrors(next);
    if (next.title || next.description) return;
    void action.run(async () => {
      const result = await api.createMemory({
        category,
        title: title.trim(),
        description: description.trim(),
        tags,
        visibility,
        people,
      });
      onSaved(
        result.memory.title,
        result.people_added.map((p) => p.name),
      );
    });
  };

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Kind of memory">
        {(p) => (
          <select {...p} value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)}>
            {MEMORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Title" error={errors.title ?? null}>
        {(p) => (
          <input
            {...p}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.memoryTitle}
            placeholder="Photo walks with Maya"
            autoFocus
          />
        )}
      </Field>
      <Field label="What to remember" error={errors.description ?? null}>
        {(p) => (
          <textarea
            {...p}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LIMITS.memoryDescription}
            placeholder="Maya and I used to take photo walks around the old town."
          />
        )}
      </Field>
      <ChipsInput
        label="Tags"
        values={tags}
        onChange={setTags}
        max={LIMITS.tagCount}
        placeholder="photography, walking…"
        hint="Words you might search for later. Press Enter or a comma after each one."
      />
      <fieldset className="picker">
        <legend>Who is this about?</legend>
        {list.length > 0 && (
          <div className="picker__chips">
            {list.map((f) => {
              const on = picked.includes(f.display_name);
              return (
                <label key={`${f.kind}:${f.id}`} className={`pick-chip ${on ? "pick-chip--on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setPicked(on ? picked.filter((n) => n !== f.display_name) : [...picked, f.display_name])
                    }
                  />
                  {on && <Icon name="check" size={14} />}
                  {f.display_name}
                </label>
              );
            })}
          </div>
        )}
        <ChipsInput
          label="Someone else"
          values={typed}
          onChange={setTyped}
          max={6}
          maxLength={LIMITS.personName}
          placeholder="Type a name"
          hint="Type a name and press Enter. People who aren't in your circle yet are added to it."
        />
      </fieldset>
      <VisibilityField value={visibility} onChange={setVisibility} />

      <section className="preview" aria-live="polite">
        <h3>
          <Icon name="shield" size={16} />
          This is exactly what will be saved to Venn
        </h3>
        <dl>
          <dt>Kind</dt>
          <dd>{CATEGORY_LABELS[category]}</dd>
          <dt>Title</dt>
          <dd>{title.trim() || <span className="muted">Not written yet</span>}</dd>
          <dt>Memory</dt>
          <dd>{description.trim() || <span className="muted">Not written yet</span>}</dd>
          {tags.length > 0 && (
            <>
              <dt>Tags</dt>
              <dd>{tags.join(", ")}</dd>
            </>
          )}
          {people.length > 0 && (
            <>
              <dt>About</dt>
              <dd>{people.join(", ")}</dd>
            </>
          )}
          <dt>Visible to</dt>
          <dd>
            {VISIBILITY_LABELS[visibility]} — {VISIBILITY_HINTS[visibility]}
          </dd>
        </dl>
        {newNames.map((n) => (
          <p key={n} className="preview__also">
            <Icon name="user-plus" size={16} />
            Also adds {n} to your people
          </p>
        ))}
      </section>

      <InlineError message={action.error} />
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={action.busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={action.busy}>
          {action.busy ? "Saving…" : "Save to Venn"}
        </button>
      </div>
    </form>
  );
}

function EditMemoryForm({ memory, onSaved, onCancel }: { memory: Memory; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(memory.title);
  const [description, setDescription] = useState(memory.description);
  const [visibility, setVisibility] = useState<Visibility>(memory.visibility);
  const action = useAction();
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) return;
        void action.run(async () => {
          await api.updateMemory(memory.memory_id, { title: title.trim(), description: description.trim(), visibility });
          onSaved();
        });
      }}
    >
      <Field label="Title">
        {(p) => <input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.memoryTitle} required />}
      </Field>
      <Field label="What to remember">
        {(p) => (
          <textarea
            {...p}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LIMITS.memoryDescription}
            required
          />
        )}
      </Field>
      <VisibilityField value={visibility} onChange={setVisibility} />
      <InlineError message={action.error} />
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={action.busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={action.busy || !title.trim() || !description.trim()}>
          {action.busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function MemoryCard({
  memory,
  onEdit,
  onDelete,
}: {
  memory: Memory;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <li className="memory">
      <CategoryIcon category={memory.category} />
      <div className="memory__main">
        <div className="memory__head">
          <h3>{memory.title}</h3>
          {(onEdit || onDelete) && (
            <div className="memory__actions">
              {onEdit && (
                <button type="button" className="icon-btn" aria-label={`Edit “${memory.title}”`} onClick={onEdit}>
                  <Icon name="pencil" size={18} />
                </button>
              )}
              {onDelete && (
                <button type="button" className="icon-btn" aria-label={`Delete “${memory.title}”`} onClick={onDelete}>
                  <Icon name="trash" size={18} />
                </button>
              )}
            </div>
          )}
        </div>
        <p>{memory.description}</p>
        <div className="memory__meta">
          <Tag icon={VISIBILITY_ICON[memory.visibility]} tone={memory.visibility === "PRIVATE" ? "neutral" : "warn"}>
            {VISIBILITY_LABELS[memory.visibility]}
          </Tag>
          {memory.source === "chatgpt_memory" && (
            <Tag tone="info" icon="chat">
              From ChatGPT
            </Tag>
          )}
          {memory.source === "sample" && <Tag tone="info">Preview</Tag>}
          {memory.people.map((p) => (
            <Tag key={p} icon="user">
              {p}
            </Tag>
          ))}
          {memory.tags.map((t) => (
            <span key={t} className="hash">
              #{t}
            </span>
          ))}
          <span className="muted small">
            {CATEGORY_LABELS[memory.category]} · {formatDate(memory.created_at)}
          </span>
        </div>
      </div>
    </li>
  );
}

const importPrompt = "Use Venn to import my ChatGPT memories. Show the memory import card so I can choose what to review before saving.";

export default function Memories() {
  const loc = useLocation();
  const q = loc.query.get("q") ?? "";
  const memories = useAsync(() => api.listMemories(q ? { q } : {}), [q]);
  const toast = useToast();
  const [draft, setDraft] = useState(q);
  const [category, setCategory] = useState<MemoryCategory | "ALL">("ALL");
  const [editing, setEditing] = useState<Memory | null>(null);
  const [deleting, setDeleting] = useState<Memory | null>(null);
  const adding = loc.query.get("new") === "1";
  const importing = loc.query.get("import") === "1";
  const { reload } = memories;
  useEffect(() => {
    if (!importing || DEMO) return;
    const refreshWhenVisible = () => { if (!document.hidden) reload(); };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [importing, reload]);
  const close = () => loc.query.get("from") === "setup"
    ? navigate("/", {}, { replace: true })
    : navigate("/memories", q ? { q } : {}, { replace: true });
  useEffect(() => setDraft(q), [q]);

  const counts = useMemo(() => {
    const c = new Map<MemoryCategory, number>();
    for (const m of memories.data ?? []) c.set(m.category, (c.get(m.category) ?? 0) + 1);
    return c;
  }, [memories.data]);
  const present = MEMORY_CATEGORIES.filter((c) => counts.has(c));
  const active = category !== "ALL" && counts.has(category) ? category : "ALL";

  return (
    <div className="page">
      <PageHeader
        title="Memories"
        lead="What Venn has saved about you and your friendships."
        actions={
          <>
          <Link to="/memories" query={{ import: "1", q: q || undefined }} className="btn">Import from ChatGPT</Link>
          <Link to="/memories" query={{ new: "1", q: q || undefined }} className="btn btn--primary">
            <Icon name="plus" size={18} />
            Add a memory
          </Link>
          </>
        }
      />
      <Notice icon="info">
        This is what Venn has saved. It's the same in ChatGPT and here. Your ChatGPT chats and ChatGPT's own memory are not
        synced — only what you approved or typed in.
      </Notice>

      <form
        className="toolbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate("/memories", draft.trim() ? { q: draft.trim() } : {});
        }}
      >
        <label className="filter">
          <Icon name="search" size={18} />
          <span className="sr-only">Search your memories</span>
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search your memories"
            maxLength={LIMITS.searchQuery}
          />
        </label>
        <button type="submit" className="btn">
          Search
        </button>
        {q && (
          <button type="button" className="btn" onClick={() => navigate("/memories")}>
            Clear
          </button>
        )}
      </form>

      <Loaded state={memories} skeleton={<Skeleton rows={4} />}>
        {(list) => {
          if (list.length === 0) {
            return q ? (
              <EmptyState
                illustration="search"
                title={`No memories match “${q}”`}
                actions={
                  <button type="button" className="btn" onClick={() => navigate("/memories")}>
                    Show all memories
                  </button>
                }
              >
                <p>Try a single word, such as an interest or a friend's name.</p>
              </EmptyState>
            ) : (
              <EmptyState
                illustration="memories"
                title="Nothing saved yet"
                actions={
                  <Link to="/memories" query={{ new: "1" }} className="btn btn--primary">
                    Add your first memory
                  </Link>
                }
              >
                <p>Save an interest, a preference or a memory with a friend. It stays private unless you choose otherwise.</p>
              </EmptyState>
            );
          }
          const groups = (active === "ALL" ? present : [active]).map((c) => ({
            category: c,
            items: list.filter((m) => m.category === c),
          }));
          return (
            <>
              <div className="filters" role="group" aria-label="Filter by kind">
                <button type="button" className="filter-chip" aria-pressed={active === "ALL"} onClick={() => setCategory("ALL")}>
                  All <span>{list.length}</span>
                </button>
                {present.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="filter-chip"
                    aria-pressed={active === c}
                    onClick={() => setCategory(c)}
                  >
                    {CATEGORY_GROUP_LABELS[c]} <span>{counts.get(c)}</span>
                  </button>
                ))}
              </div>
              {q && (
                <p className="count" aria-live="polite">
                  {plural(list.length, "memory", "memories")} matching “{q}”
                </p>
              )}
              {groups.map((g) => (
                <section key={g.category} className="memory-group">
                  <h2>{CATEGORY_GROUP_LABELS[g.category]}</h2>
                  <ul className="memories card card--flush">
                    {g.items.map((m) => (
                      <MemoryCard key={m.memory_id} memory={m} onEdit={() => setEditing(m)} onDelete={() => setDeleting(m)} />
                    ))}
                  </ul>
                </section>
              ))}
            </>
          );
        }}
      </Loaded>

      {importing && (
        <Dialog title="Import from ChatGPT" onClose={close}>
          {DEMO ? <p>This demo uses sample data. Sign in to Venn outside demo mode to import your own memories.</p> : (
            <>
              <p>Your website account can’t read private chats. Open ChatGPT with Venn connected to this same Venn account.</p>
              <p>If the prompt isn’t filled in, send this message:</p>
              <blockquote>{importPrompt}</blockquote>
              <p>Choose the topics to preview, then approve the memories you want to keep. ChatGPT can only suggest what it remembers; nothing is synced automatically.</p>
              <a className="btn btn--primary" href={`https://chatgpt.com/?q=${encodeURIComponent(importPrompt)}`} target="_blank" rel="noopener noreferrer">Open ChatGPT in a new tab</a>
              <p>After saving in ChatGPT, return here to see your approved memories.</p>
              <button type="button" className="btn" onClick={() => { setCategory("ALL"); navigate("/memories", {}, { replace: true }); reload(); }}>Show my memories</button>
            </>
          )}
        </Dialog>
      )}
      {adding && (
        <Dialog title="Add a memory" onClose={close} wide>
          <AddMemoryForm
            onCancel={close}
            onSaved={(title, added) => {
              toast(
                added.length
                  ? `Saved “${title}”. Also added ${added.join(", ")} to your people.`
                  : `Saved “${title}” to Venn.`,
              );
              close();
              memories.reload();
            }}
          />
        </Dialog>
      )}
      {editing && (
        <Dialog title="Edit memory" onClose={() => setEditing(null)}>
          <EditMemoryForm
            memory={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              toast("Memory updated.");
              memories.reload();
            }}
          />
        </Dialog>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this memory?"
          body={
            <p>
              “{deleting.title}” will be removed from Venn, here and in ChatGPT. This can't be undone.
            </p>
          }
          confirmLabel="Delete memory"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteMemory(deleting.memory_id);
            toast("Memory deleted.");
            memories.reload();
          }}
        />
      )}
    </div>
  );
}
