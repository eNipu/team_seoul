import { useId, useState, type FormEvent } from "react";
import type { HostBridge } from "../mcp/client";
import {
  CATEGORY_GROUP_LABELS,
  CATEGORY_LABELS,
  LIMITS,
  MEMORY_CATEGORIES,
  VISIBILITIES,
  VISIBILITY_LABELS,
  VISIBILITY_SHORT,
  formatDate,
  hasId,
  parseDeleteMemory,
  parseMemory,
  plural,
  type Memory,
  type Visibility,
} from "../types";
import { EmptyNote, PeopleChips, SampleTag, SectionTitle, type Action, type Nav } from "./common";
import { CategoryIcon, Icon } from "./icons";

interface Props {
  memories: Memory[];
  bridge: HostBridge;
  nav: Nav;
  action: Action;
  onChange: (next: Memory[]) => void;
}

function matches(m: Memory, q: string): boolean {
  const hay = [m.title, m.description, ...m.tags, CATEGORY_LABELS[m.category], CATEGORY_GROUP_LABELS[m.category]]
    .join("\n")
    .toLowerCase();
  return q.split(/\s+/).every((word) => hay.includes(word));
}

export default function MemoriesTab({ memories, bridge, nav, action, onChange }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const pageSize = 6;
  const q = query.trim().toLowerCase();
  const visible = q ? memories.filter((m) => matches(m, q)) : memories;
  const pages = Math.ceil(visible.length / pageSize);
  const currentPage = Math.max(0, Math.min(page, pages - 1));
  const slice = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const groups = MEMORY_CATEGORIES.map((c) => ({ category: c, items: slice.filter((m) => m.category === c) })).filter(
    (g) => g.items.length > 0,
  );
  const busy = action.busy !== null;

  function deleteMemory(memoryId: string) {
    void action.run(`delete-${memoryId}`, async () => {
      const res = await bridge.callTool("venn_delete_memory", { memory_id: memoryId });
      if (!res.ok) return res.errorText;
      const removedId = parseDeleteMemory(res.data).memory_id || memoryId;
      onChange(memories.filter((m) => m.memory_id !== removedId));
      setConfirmDelete(null);
      return null;
    });
  }

  function saveMemory(m: Memory, next: { title: string; description: string; visibility: Visibility }) {
    const patch: Record<string, unknown> = {};
    if (next.title !== m.title) patch.title = next.title;
    if (next.description !== m.description) patch.description = next.description;
    if (next.visibility !== m.visibility) patch.visibility = next.visibility;
    if (Object.keys(patch).length === 0) {
      setEditing(null);
      return;
    }
    void action.run(`edit-${m.memory_id}`, async () => {
      const res = await bridge.callTool("venn_update_memory", { memory_id: m.memory_id, ...patch });
      if (!res.ok) return res.errorText;
      const updated = hasId(res.data, "memory_id") ? { ...parseMemory(res.data), memory_id: m.memory_id } : { ...m, ...next };
      onChange(memories.map((x) => (x.memory_id === m.memory_id ? updated : x)));
      setEditing(null);
      return null;
    });
  }

  const importedCount = memories.filter((m) => m.source === "chatgpt_memory").length;
  const sources = (
    <section className="sources" aria-label="Sources">
      <SectionTitle>Sources</SectionTitle>
      <div className="source-row">
        <span className="source-row__icon" aria-hidden="true">
          <Icon name="chat" />
        </span>
        <div className="source-row__body">
          <strong>ChatGPT memory</strong>
          <span className="muted small">{importedCount > 0 ? `${importedCount} imported` : "Not imported yet"}</span>
        </div>
        <button
          type="button"
          className="btn btn--small"
          disabled={busy}
          onClick={() => void action.run("import-chatgpt", () => nav.openView("venn_import_chatgpt_memory", {}))}
        >
          <Icon name="import" size={16} />
          {action.busy === "import-chatgpt" ? "Opening…" : importedCount > 0 ? "Import more" : "Import from ChatGPT"}
        </button>
      </div>
    </section>
  );

  if (memories.length === 0) {
    return (
      <>
        {sources}
        <EmptyNote art="memories" title="No memories yet">
          Tell Venn something about yourself in the chat. Nothing is saved until you approve it.
        </EmptyNote>
      </>
    );
  }

  return (
    <>
      {sources}
      <div className="search">
        <label className="sr-only" htmlFor={`${id}-search`}>
          Search memories
        </label>
        <span className="search__icon" aria-hidden="true">
          <Icon name="search" size={18} />
        </span>
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          placeholder="Search memories"
          autoComplete="off"
          onChange={(e) => { setPage(0); setQuery(e.target.value); }}
        />
      </div>
      {q && (
        <p className="muted small" role="status">
          {plural(visible.length, "match", "matches")} of {memories.length}
        </p>
      )}

      {pages > 1 && <nav className="button-row" aria-label="Saved memory pages">
        <button type="button" className="btn" disabled={busy || currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
        <span role="status" className="small muted">Page {currentPage + 1} of {pages}</span>
        <button type="button" className="btn" disabled={busy || currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button>
      </nav>}
      {groups.length === 0 ? (
        <EmptyNote art="search" title="No matches">
          Nothing matches “{query.trim()}”.{" "}
          <button type="button" className="link" onClick={() => setQuery("")}>
            Clear search
          </button>
        </EmptyNote>
      ) : (
        groups.map((g) => (
          <section key={g.category} className="group" aria-label={CATEGORY_GROUP_LABELS[g.category]}>
            <h3 className="group__title">
              <CategoryIcon category={g.category} />
              <span>{CATEGORY_GROUP_LABELS[g.category]}</span>
              <span className="count">{g.items.length}</span>
            </h3>
            <ul className="list list--tight">
              {g.items.map((m) => (
                <li key={m.memory_id} className={`card card--cat cat--${m.category.toLowerCase()}`}>
                  {editing === m.memory_id ? (
                    <MemoryForm
                      memory={m}
                      busy={action.busy === `edit-${m.memory_id}`}
                      onSave={(next) => saveMemory(m, next)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <div className="card__head">
                        <strong className="card__title">{m.title}</strong>
                        <span className={`badge badge--vis-${m.visibility.toLowerCase()}`} title={VISIBILITY_LABELS[m.visibility]}>
                          {VISIBILITY_SHORT[m.visibility]}
                        </span>
                      </div>
                      {m.description && <p className="muted small">{m.description}</p>}
                      {m.tags.length > 0 && (
                        <div className="chips">
                          {m.tags.map((t, i) => (
                            <span key={`${t}-${i}`} className="chip chip--small">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                      <PeopleChips people={m.people} />
                      {confirmDelete === m.memory_id ? (
                        <div className="confirm" role="group" aria-label="Confirm delete">
                          <span className="small">Delete this memory?</span>
                          <button
                            type="button"
                            className="btn btn--danger btn--small"
                            disabled={busy}
                            onClick={() => deleteMemory(m.memory_id)}
                          >
                            {action.busy === `delete-${m.memory_id}` ? "Deleting…" : "Delete"}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--small"
                            disabled={busy}
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="card__foot">
                          <span className="card__foot-meta">
                            <span className="muted small">{formatDate(m.created_at)}</span>
                            {m.source === "chatgpt_memory" && (
                              <span className="badge">
                                <Icon name="chat" size={12} />
                                From ChatGPT
                              </span>
                            )}
                            {m.source === "sample" && <SampleTag />}
                          </span>
                          <div className="card__foot-actions">
                            <button
                              type="button"
                              className="btn btn--ghost btn--small"
                              disabled={busy}
                              aria-label={`Edit ${m.title}`}
                              onClick={() => {
                                setConfirmDelete(null);
                                setEditing(m.memory_id);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger-quiet btn--small"
                              disabled={busy}
                              aria-label={`Delete ${m.title}`}
                              onClick={() => setConfirmDelete(m.memory_id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

interface FormProps {
  memory: Memory;
  busy: boolean;
  onSave: (next: { title: string; description: string; visibility: Visibility }) => void;
  onCancel: () => void;
}

function MemoryForm({ memory, busy, onSave, onCancel }: FormProps) {
  const id = useId();
  const [title, setTitle] = useState(memory.title);
  const [description, setDescription] = useState(memory.description);
  const [visibility, setVisibility] = useState<Visibility>(memory.visibility);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || title.trim() === "") return;
    onSave({ title: title.trim(), description: description.trim(), visibility });
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field" htmlFor={`${id}-title`}>
        <span className="field__label">Title</span>
        <input
          id={`${id}-title`}
          type="text"
          value={title}
          maxLength={LIMITS.memoryTitle}
          required
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="field" htmlFor={`${id}-desc`}>
        <span className="field__label">Description</span>
        <textarea
          id={`${id}-desc`}
          rows={2}
          value={description}
          maxLength={LIMITS.memoryDescription}
          disabled={busy}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="field" htmlFor={`${id}-vis`}>
        <span className="field__label">Who can see this</span>
        <select id={`${id}-vis`} value={visibility} disabled={busy} onChange={(e) => setVisibility(e.target.value as Visibility)}>
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {VISIBILITY_LABELS[v]}
            </option>
          ))}
        </select>
      </label>
      <div className="actions actions--compact">
        <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary btn--small" disabled={busy || title.trim() === ""}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
