import { useId, useState, type FormEvent } from "react";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  LIMITS,
  formatDate,
  formatRelative,
  friendArg,
  hasId,
  isObj,
  parseLogInteraction,
  parsePerson,
  type FriendViewData,
  type Interaction,
} from "../types";
import { ActionError, Avatar, ChatStatus, SectionTitle, useAction, useChatPrompt, type ViewProps } from "./common";
import PersonForm, { type PersonValues } from "./PersonForm";

type Mode = "view" | "log" | "edit" | "confirm-remove";

interface Details {
  name: string;
  relationship: string | null;
  notes: string | null;
  interests: string[];
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export default function Friend({ data, bridge, nav }: ViewProps<FriendViewData>) {
  const formId = useId();
  const action = useAction();
  const chat = useChatPrompt(bridge);
  const isPerson = data.kind === "person";
  const arg = friendArg(data.kind, data.id);

  const [mode, setMode] = useState<Mode>("view");
  const [details, setDetails] = useState<Details>({
    name: data.display_name,
    relationship: data.relationship,
    notes: data.notes,
    interests: data.interests,
  });
  const [interactions, setInteractions] = useState<Interaction[]>(data.recent_interactions);
  const [lastAt, setLastAt] = useState<string | null>(data.last_interaction_at);
  const [activity, setActivity] = useState("");
  const [justLogged, setJustLogged] = useState(false);
  const [gone, setGone] = useState(false);

  const busy = action.busy !== null;
  const shared = new Set(data.shared_interests.map((s) => s.toLowerCase()));

  function ideas() {
    void action.run("ideas", () => nav.openView("heldly_suggest_activity", arg));
  }

  function logHangout(e: FormEvent) {
    e.preventDefault();
    const what = activity.trim();
    void action.run("log", async () => {
      const res = await bridge.callTool("heldly_log_interaction", what ? { ...arg, activity: what } : arg);
      if (!res.ok) return res.errorText;
      const result = parseLogInteraction(res.data);
      if (!result.recorded) return "Heldly couldn't log that.";
      const at = result.last_interaction_at ?? new Date().toISOString();
      setInteractions((list) => [{ occurred_at: at, activity: what || null }, ...list]);
      setLastAt(at);
      setActivity("");
      setJustLogged(true);
      setMode("view");
      return null;
    });
  }

  function saveEdit(values: PersonValues) {
    // Send only what changed. Cleared optional fields are sent as "" / [].
    const patch: Record<string, unknown> = {};
    if (values.name !== details.name) patch.name = values.name;
    if (values.relationship !== (details.relationship ?? "")) patch.relationship = values.relationship;
    if (values.notes !== (details.notes ?? "")) patch.notes = values.notes;
    if (!sameList(values.interests, details.interests)) patch.interests = values.interests;
    if (Object.keys(patch).length === 0) {
      setMode("view");
      return;
    }
    void action.run("edit", async () => {
      const res = await bridge.callTool("heldly_update_person", { person_id: data.id, ...patch });
      if (!res.ok) return res.errorText;
      if (hasId(res.data, "person_id")) {
        const p = parsePerson(res.data);
        setDetails({ name: p.name, relationship: p.relationship, notes: p.notes, interests: p.interests });
      } else {
        setDetails({
          name: values.name,
          relationship: values.relationship || null,
          notes: values.notes || null,
          interests: values.interests,
        });
      }
      setMode("view");
      return null;
    });
  }

  function remove() {
    void action.run("remove", async () => {
      const res = isPerson
        ? await bridge.callTool("heldly_delete_person", { person_id: data.id })
        : await bridge.callTool("heldly_remove_connection", { connection_id: data.id });
      if (!res.ok) return res.errorText;
      const confirmed = isObj(res.data) && (isPerson ? res.data.deleted === true : res.data.removed === true);
      if (!confirmed) return isPerson ? "Heldly couldn't delete this note." : "Heldly couldn't remove this connection.";
      if (nav.canGoBack) nav.back();
      else setGone(true);
      return null;
    });
  }

  if (gone) {
    return (
      <section className="panel empty">
        <div className="empty__art" aria-hidden="true">{isPerson ? "🗑️" : "👋"}</div>
        <p className="empty__title">{isPerson ? "Deleted" : "Connection removed"}</p>
        <p className="muted">
          {isPerson
            ? `Your private note about ${details.name} is gone.`
            : `You and ${details.name} are no longer connected on Heldly.`}
        </p>
      </section>
    );
  }

  // Interests first, then any shared interest the server listed separately.
  const listed = new Set(details.interests.map((i) => i.toLowerCase()));
  const chips = [...details.interests, ...(isPerson ? [] : data.shared_interests.filter((s) => !listed.has(s.toLowerCase())))];

  return (
    <section className="panel">
      <div className="profile-head">
        <Avatar name={details.name} size="large" />
        <div className="profile-head__body">
          <h2>{details.name}</h2>
          <p className="muted small">
            {isPerson || !data.on_heldly
              ? "Private note · only you can see this"
              : data.since
                ? `On Heldly since ${formatDate(data.since)}`
                : "On Heldly"}
          </p>
          <div className="row row--wrap">
            {details.relationship && <span className="badge badge--note">{details.relationship}</span>}
            <span className="badge">{lastAt ? `Last met ${formatRelative(lastAt)}` : "No hangouts yet"}</span>
          </div>
        </div>
      </div>

      <ActionError action={action} />

      {mode === "edit" ? (
        <div className="inline-form">
          <SectionTitle>Edit {details.name}</SectionTitle>
          <PersonForm
            initial={{
              name: details.name,
              relationship: details.relationship ?? "",
              notes: details.notes ?? "",
              interests: details.interests,
            }}
            submitLabel="Save changes"
            busyLabel="Saving…"
            busy={action.busy === "edit"}
            onSubmit={saveEdit}
            onCancel={() => setMode("view")}
          />
        </div>
      ) : (
        <>
          {!isPerson && data.bio && <p>{data.bio}</p>}
          {isPerson && details.notes && (
            <div className="note-box">
              <span className="field__label">Your notes</span>
              <p>{details.notes}</p>
            </div>
          )}

          <div className="button-row">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={ideas}>
              {action.busy === "ideas" ? "Loading…" : "Get ideas"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              aria-expanded={mode === "log"}
              onClick={() => setMode(mode === "log" ? "view" : "log")}
            >
              Log a hangout
            </button>
            <button
              type="button"
              className="btn"
              disabled={chat.state === "sending"}
              onClick={() =>
                void chat.send(`Help me draft a short, warm message to reconnect with ${details.name}. I will send it myself.`)
              }
            >
              {chat.state === "sending" ? "Asking…" : "Draft a message"}
            </button>
          </div>
          <ChatStatus state={chat.state} prompt={chat.prompt} />

          {mode === "log" && (
            <form className="inline-form form" onSubmit={logHangout}>
              <label className="field" htmlFor={`${formId}-activity`}>
                <span className="field__label">What did you do? (optional)</span>
                <input
                  id={`${formId}-activity`}
                  type="text"
                  value={activity}
                  maxLength={LIMITS.activity}
                  placeholder="Coffee, a walk, a long call…"
                  autoComplete="off"
                  disabled={busy}
                  onChange={(e) => setActivity(e.target.value)}
                />
              </label>
              <div className="actions actions--compact">
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setMode("view")}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  {action.busy === "log" ? "Logging…" : "Log it"}
                </button>
              </div>
            </form>
          )}

          <SectionTitle>Interests</SectionTitle>
          {chips.length > 0 ? (
            <>
              <div className="chips">
                {chips.map((it, i) => {
                  const isShared = shared.has(it.toLowerCase());
                  return (
                    <span key={`${it}-${i}`} className={`chip ${isShared ? "chip--shared" : "chip--plain"}`}>
                      {isShared && <span className="sr-only">Shared: </span>}
                      {it}
                    </span>
                  );
                })}
              </div>
              {chips.some((c) => shared.has(c.toLowerCase())) && (
                <p className="muted small legend">
                  <span aria-hidden="true">★</span> Interests you have in common
                </p>
              )}
            </>
          ) : (
            <p className="muted small">
              {isPerson ? "No interests noted yet. Use Edit to add some." : `${details.name} hasn't shared any interests yet.`}
            </p>
          )}

          {!isPerson && (
            <>
              <SectionTitle count={data.shared_memories.length}>What {details.name} shares with you</SectionTitle>
              {data.shared_memories.length === 0 ? (
                <p className="muted small">Nothing shared yet.</p>
              ) : (
                <ul className="list list--tight">
                  {data.shared_memories.map((m, i) => (
                    <li key={i} className="shared-memory">
                      <span className={`cat-icon cat--${m.category.toLowerCase()}`} title={CATEGORY_LABELS[m.category]} aria-hidden="true">
                        {CATEGORY_ICONS[m.category]}
                      </span>
                      <div>
                        <strong>{m.title}</strong>
                        <span className="sr-only"> ({CATEGORY_LABELS[m.category]})</span>
                        {m.description && <p className="muted small">{m.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <SectionTitle count={interactions.length}>Recent hangouts</SectionTitle>
          {justLogged && (
            <p className="hint hint--ok" role="status">
              ✓ Hangout logged
            </p>
          )}
          {interactions.length === 0 ? (
            <p className="muted small">No hangouts logged yet</p>
          ) : (
            <ol className="timeline">
              {interactions.map((it, i) => (
                <li key={`${it.occurred_at}-${i}`} className="timeline__item">
                  <span className="timeline__what">{it.activity ?? "Spent time together"}</span>
                  <span className="muted small">{formatDate(it.occurred_at)}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="footer-actions">
            {mode === "confirm-remove" ? (
              <div className="confirm" role="group" aria-label="Confirm">
                <span className="small">
                  {isPerson
                    ? `Delete your note about ${details.name}? This can't be undone.`
                    : `Remove ${details.name} from your connections? You'll stop seeing what each other shares.`}
                </span>
                <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={remove}>
                  {action.busy === "remove" ? (isPerson ? "Deleting…" : "Removing…") : isPerson ? "Delete" : "Remove"}
                </button>
                <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setMode("view")}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                {isPerson && (
                  <button type="button" className="btn btn--small" disabled={busy} onClick={() => setMode("edit")}>
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--danger-quiet btn--small"
                  disabled={busy}
                  onClick={() => setMode("confirm-remove")}
                >
                  {isPerson ? "Delete" : "Remove connection"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
