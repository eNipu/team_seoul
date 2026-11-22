import { useId, useState, type FormEvent } from "react";
import {
  CATEGORY_LABELS,
  LIMITS,
  friendArg,
  hasId,
  isObj,
  parseLogInteraction,
  parsePerson,
  type FriendViewData,
  type Interaction,
} from "../types";
import { OpenMyVenn, momentText, signalsFrom } from "./Moment";
import { ActionError, ChatStatus, SectionTitle, useAction, useChatPrompt, type ViewProps } from "./common";
import { CategoryIcon, Icon, Illustration } from "./icons";
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
  const [, setInteractions] = useState<Interaction[]>(data.recent_interactions);
  const [, setLastAt] = useState<string | null>(data.last_interaction_at);
  const [activity, setActivity] = useState("");
  const [justLogged, setJustLogged] = useState(false);
  const [gone, setGone] = useState(false);

  const busy = action.busy !== null;
  const shared = new Set(data.shared_interests.map((s) => s.toLowerCase()));

  function ideas() {
    void action.run("ideas", () => nav.openView("venn_suggest_activity", arg));
  }

  function prep() {
    void action.run("prep", () => nav.openView("venn_meetup_brief", arg));
  }

  function compare() {
    void action.run("compare", () => nav.openView("venn_compare", arg));
  }

  function ask() {
    void action.run("ask", () => nav.openView("venn_create_question_link", { person_id: data.id }));
  }

  function quiz() {
    void action.run("quiz", () => nav.openView("venn_start_quiz", { connection_id: data.id }));
  }

  function logHangout(e: FormEvent) {
    e.preventDefault();
    const what = activity.trim();
    void action.run("log", async () => {
      const res = await bridge.callTool("venn_log_interaction", what ? { ...arg, activity: what } : arg);
      if (!res.ok) return res.errorText;
      const result = parseLogInteraction(res.data);
      if (!result.recorded) return "Venn couldn't log that.";
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
      const res = await bridge.callTool("venn_update_person", { person_id: data.id, ...patch });
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
        ? await bridge.callTool("venn_delete_person", { person_id: data.id })
        : await bridge.callTool("venn_remove_connection", { connection_id: data.id });
      if (!res.ok) return res.errorText;
      const confirmed = isObj(res.data) && (isPerson ? res.data.deleted === true : res.data.removed === true);
      if (!confirmed) return isPerson ? "Venn couldn't delete this note." : "Venn couldn't remove this connection.";
      if (nav.canGoBack) nav.back();
      else setGone(true);
      return null;
    });
  }

  if (gone) {
    return (
      <section className="panel empty">
        <Illustration name="done" />
        <p className="empty__title">{isPerson ? "Deleted" : "Connection removed"}</p>
        <p className="muted">
          {isPerson
            ? `Your private note about ${details.name} is gone.`
            : `You and ${details.name} are no longer connected on Venn.`}
        </p>
      </section>
    );
  }

  // Interests first, then any shared interest the server listed separately.
  const listed = new Set(details.interests.map((i) => i.toLowerCase()));
  const chips = [...details.interests, ...(isPerson ? [] : data.shared_interests.filter((s) => !listed.has(s.toLowerCase())))];

  const signals = signalsFrom({ ...data, display_name: details.name, notes: details.notes });
  const moment = momentText(details.name, signals);

  return (
    <section className="onb friend">
      <h2 className="sr-only">{details.name}</h2>
      <p className="onb__context">ChatGPT</p>
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
          <div className="onb__bubble onb__bubble--in">
            <p>{moment}</p>
            {signals.signal && <small>{signals.signal.source}</small>}
          </div>
          <button type="button" className="onb__cta" disabled={chat.state === "sending"}
            onClick={() => void chat.send(`Help me say hi to ${details.name}. Keep it short and warm, mention: ${moment.replace(/^Btw, /, "")} I'll send it myself.`)}>
            {chat.state === "sending" ? "Asking…" : `Say hi to ${details.name.split(/\s+/)[0]}`}
          </button>
          {justLogged && <p className="onb__done" role="status">Logged.</p>}
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
          <div className="onb__row">
            <OpenMyVenn bridge={bridge} />
            <details className="onb__more">
              <summary>More</summary>
              <div className="onb__more-body">
            <button type="button" className="btn btn--block" disabled={busy} onClick={ideas}>
              {action.busy === "ideas" ? "Loading…" : "Plan something"}
            </button>
            <button type="button" className="btn btn--block" disabled={busy} aria-expanded={mode === "log"}
              onClick={() => setMode(mode === "log" ? "view" : "log")}>
              We met up
            </button>
            <button type="button" className="btn btn--block" disabled={busy} onClick={prep}>
              {action.busy === "prep" ? "Loading…" : "Prep for a meetup"}
            </button>
            <button type="button" className="btn btn--block" disabled={busy} onClick={compare}>
              {action.busy === "compare" ? "Loading…" : "Common ground"}
            </button>
            {isPerson ? (
              <button type="button" className="btn btn--block" disabled={busy} onClick={ask}>
                {action.busy === "ask" ? "Creating…" : "Ask them a few questions"}
              </button>
            ) : (
              <button type="button" className="btn btn--block" disabled={busy} onClick={quiz}>
                {action.busy === "quiz" ? "Loading…" : "Quiz"}
              </button>
            )}
          <ChatStatus state={chat.state} prompt={chat.prompt} />


          <SectionTitle>Interests</SectionTitle>
          {chips.length > 0 ? (
            <>
              <div className="chips">
                {chips.map((it, i) => {
                  const isShared = shared.has(it.toLowerCase());
                  return (
                    <span key={`${it}-${i}`} className={`chip ${isShared ? "chip--shared" : "chip--plain"}`}>
                      {isShared && <Icon name="star" size={12} />}
                      {isShared && <span className="sr-only">Shared: </span>}
                      {it}
                    </span>
                  );
                })}
              </div>
              {chips.some((c) => shared.has(c.toLowerCase())) && (
                <p className="muted small legend">
                  <Icon name="star" size={14} /> Interests you have in common
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
                      <CategoryIcon category={m.category} />
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
                    <Icon name="pencil" size={16} />
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
              </div>
            </details>
          </div>
        </>
      )}
    </section>
  );
}
