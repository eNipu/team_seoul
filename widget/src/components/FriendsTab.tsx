import { useId, useState, type FormEvent } from "react";
import type { HostBridge } from "../mcp/client";
import {
  LIMITS,
  formatDate,
  formatRelative,
  friendArg,
  groupArgs,
  hasId,
  parsePerson,
  parseRespondConnection,
  parseView,
  type Connection,
  type DashboardViewData,
  type FriendKind,
  type PendingRequest,
  type Person,
} from "../types";
import { Avatar, ChatStatus, SectionTitle, Spinner, useChatPrompt, type Action, type Nav } from "./common";
import { SearchIcon } from "./PeopleSearch";
import PersonForm, { type PersonValues } from "./PersonForm";

interface Props {
  connections: Connection[];
  people: Person[];
  pending: PendingRequest[];
  bridge: HostBridge;
  nav: Nav;
  action: Action;
  onConnections: (next: Connection[]) => void;
  onPeople: (next: Person[]) => void;
  onPending: (next: PendingRequest[]) => void;
  onDashboard: (d: DashboardViewData) => void;
}

export default function FriendsTab(props: Props) {
  const { connections, people, pending, bridge, nav, action } = props;
  const searchId = useId();
  const chat = useChatPrompt(bridge);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  /** `null` = not picking; otherwise the `${kind}:${id}` keys chosen for a group hangout. */
  const [group, setGroup] = useState<string[] | null>(null);
  const busy = action.busy !== null;
  const picking = group !== null;
  const friendCount = connections.length + people.length;
  const groupFull = picking && group.length >= LIMITS.groupMax;

  function search(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    void action.run("search", () => nav.openView("venn_find_people", { query: q }));
  }

  function togglePick(kind: FriendKind, id: string) {
    const k = `${kind}:${id}`;
    setGroup((g) => (g === null ? g : g.includes(k) ? g.filter((x) => x !== k) : g.length >= LIMITS.groupMax ? g : [...g, k]));
  }

  function planGroup() {
    if (group === null || group.length < LIMITS.groupMin) return;
    const friends = group.map((k) => {
      const cut = k.indexOf(":");
      return { kind: k.slice(0, cut) as FriendKind, id: k.slice(cut + 1) };
    });
    void action.run("group", async () => {
      const failure = await nav.openView("venn_plan_group", groupArgs(friends));
      if (failure === null) setGroup(null);
      return failure;
    });
  }

  const pickProps = (kind: FriendKind, id: string) =>
    picking
      ? { picked: group.includes(`${kind}:${id}`), pickDisabled: busy || (groupFull && !group.includes(`${kind}:${id}`)), onPick: () => togglePick(kind, id) }
      : {};

  function open(kind: FriendKind, id: string) {
    void action.run(`open-${kind}:${id}`, () => nav.openView("venn_view_friend", friendArg(kind, id)));
  }

  function respond(req: PendingRequest, accept: boolean) {
    void action.run(`${accept ? "accept" : "decline"}-${req.request_id}`, async () => {
      const res = await bridge.callTool("venn_respond_to_connection", { request_id: req.request_id, accept });
      if (!res.ok) return res.errorText;
      const result = parseRespondConnection(res.data);
      const rest = pending.filter((p) => p.request_id !== req.request_id);
      props.onPending(rest);
      if (result.status !== "ACCEPTED") return null;
      // Show the new friend: refresh the dashboard, or fall back to a minimal local entry.
      const fresh = await bridge.callTool("venn_show_dashboard", {});
      const parsed = fresh.ok ? parseView(fresh.data) : null;
      if (parsed && parsed.view === "dashboard") {
        props.onDashboard(parsed);
      } else if (result.connection_id) {
        props.onConnections([
          ...connections,
          {
            connection_id: result.connection_id,
            user_id: "",
            display_name: req.sender_display_name,
            since: new Date().toISOString(),
            last_interaction_at: null,
          },
        ]);
      }
      return null;
    });
  }

  function addPerson(values: PersonValues) {
    const args: Record<string, unknown> = { name: values.name };
    if (values.relationship) args.relationship = values.relationship;
    if (values.notes) args.notes = values.notes;
    if (values.interests.length > 0) args.interests = values.interests;
    void action.run("add-person", async () => {
      const res = await bridge.callTool("venn_add_person", args);
      if (!res.ok) return res.errorText;
      if (!hasId(res.data, "person_id")) return "Venn didn't confirm the new person. Try again.";
      props.onPeople([...people, parsePerson(res.data)]);
      setAdding(false);
      return null;
    });
  }

  return (
    <>
      <form className="search-form" role="search" onSubmit={search}>
        <label className="sr-only" htmlFor={searchId}>
          Search your circle
        </label>
        <div className="search">
          <SearchIcon />
          <input
            id={searchId}
            type="search"
            value={query}
            maxLength={LIMITS.searchQuery}
            placeholder="Who do I know who…"
            autoComplete="off"
            enterKeyHint="search"
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {query.trim() !== "" && (
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {action.busy === "search" ? "Searching…" : "Search"}
          </button>
        )}
      </form>

      <div className="button-row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void action.run("invite", () => nav.openView("venn_create_invite", {}))}
        >
          {action.busy === "invite" ? "Creating code…" : "Invite a friend"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void action.run("reconnect", () => nav.openView("venn_reconnection_suggestions", {}))}
        >
          {action.busy === "reconnect" ? "Looking…" : "Who should I reconnect with?"}
        </button>
      </div>

      <div className="quick-actions" role="group" aria-label="More things to do">
        <button
          type="button"
          className="quick-action"
          disabled={chat.state === "sending"}
          onClick={() => void chat.send(IMPORT_PROMPT)}
        >
          <span aria-hidden="true">📥</span>
          {chat.state === "sending" ? "Asking…" : "Import friends"}
        </button>
        {connections.length > 0 && (
          <button
            type="button"
            className="quick-action"
            disabled={busy}
            onClick={() => void action.run("quiz", () => nav.openView("venn_start_quiz", {}))}
          >
            <span aria-hidden="true">🎲</span>
            {action.busy === "quiz" ? "Loading…" : "Play a quiz"}
          </button>
        )}
        {friendCount >= LIMITS.groupMin && (
          <button
            type="button"
            className="quick-action"
            disabled={busy}
            aria-pressed={picking}
            onClick={() => setGroup(picking ? null : [])}
          >
            <span aria-hidden="true">🧑‍🤝‍🧑</span>
            Plan a group hangout
          </button>
        )}
      </div>
      <ChatStatus state={chat.state} prompt={chat.prompt} />

      {picking && (
        <div className="group-bar">
          <span className="group-bar__text" role="status">
            {group.length === 0
              ? `Pick ${LIMITS.groupMin} to ${LIMITS.groupMax} friends below`
              : `${group.length} picked${groupFull ? ` (the most for one plan)` : group.length < LIMITS.groupMin ? " · pick one more" : ""}`}
          </span>
          <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setGroup(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--small"
            disabled={busy || group.length < LIMITS.groupMin}
            onClick={planGroup}
          >
            {action.busy === "group" ? "Planning…" : "Plan hangout"}
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <SectionTitle count={pending.length}>Pending requests</SectionTitle>
          <ul className="list list--tight">
            {pending.map((r) => (
              <li key={r.request_id} className="card request-card">
                <div className="person-head">
                  <Avatar name={r.sender_display_name} />
                  <div className="person-head__body">
                    <strong>{r.sender_display_name}</strong>
                    <span className="muted small">
                      Wants to connect{r.created_at ? ` · ${formatDate(r.created_at)}` : ""}
                    </span>
                  </div>
                </div>
                <div className="card__actions card__actions--end">
                  <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => respond(r, false)}>
                    {action.busy === `decline-${r.request_id}` ? "Declining…" : "Decline"}
                  </button>
                  <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => respond(r, true)}>
                    {action.busy === `accept-${r.request_id}` ? "Accepting…" : "Accept"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle count={connections.length}>On Venn</SectionTitle>
      {connections.length === 0 ? (
        <p className="muted small">No connections yet. Invite a friend to get started.</p>
      ) : (
        <ul className="list list--tight">
          {connections.map((c) => (
            <FriendRow
              key={c.connection_id}
              name={c.display_name}
              detail={c.last_interaction_at ? `Last met ${formatRelative(c.last_interaction_at)}` : "No hangouts logged yet"}
              opening={action.busy === `open-connection:${c.connection_id}`}
              disabled={busy}
              onOpen={() => open("connection", c.connection_id)}
              {...pickProps("connection", c.connection_id)}
            />
          ))}
        </ul>
      )}

      <SectionTitle count={people.length}>Private notes</SectionTitle>
      <p className="muted small">Friends who aren't on Venn. Only you can see these.</p>
      {people.length > 0 && (
        <ul className="list list--tight">
          {people.map((p) => (
            <FriendRow
              key={p.person_id}
              name={p.name}
              detail={[p.relationship, p.last_interaction_at ? `Last met ${formatRelative(p.last_interaction_at)}` : "No hangouts logged yet"]
                .filter(Boolean)
                .join(" · ")}
              opening={action.busy === `open-person:${p.person_id}`}
              disabled={busy}
              onOpen={() => open("person", p.person_id)}
              {...pickProps("person", p.person_id)}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <div className="inline-form">
          <SectionTitle>Add a person</SectionTitle>
          <PersonForm
            submitLabel="Add person"
            busyLabel="Adding…"
            busy={action.busy === "add-person"}
            onSubmit={addPerson}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button type="button" className="btn btn--dashed btn--block" disabled={busy} onClick={() => setAdding(true)}>
          <span aria-hidden="true">+ </span>Add a person
        </button>
      )}
    </>
  );
}

const IMPORT_PROMPT =
  "I'd like to import my friends into Venn. I'll paste a list, upload a contacts file, or just tell you about them.";

interface RowProps {
  name: string;
  detail: string;
  opening: boolean;
  disabled: boolean;
  onOpen: () => void;
  /** Set while picking friends for a group hangout: the row becomes a checkbox. */
  picked?: boolean;
  pickDisabled?: boolean;
  onPick?: () => void;
}

function FriendRow({ name, detail, opening, disabled, onOpen, picked, pickDisabled, onPick }: RowProps) {
  if (onPick) {
    return (
      <li>
        <label className={`pick pick--row ${picked ? "pick--on" : ""}`}>
          <input type="checkbox" checked={picked === true} disabled={pickDisabled} onChange={onPick} />
          <Avatar name={name} />
          <span className="pick__body">
            <strong>{name}</strong>
            <span className="muted small">{detail}</span>
          </span>
        </label>
      </li>
    );
  }
  return (
    <li>
      <button type="button" className="friend-row" disabled={disabled} aria-label={`Open ${name}`} onClick={onOpen}>
        <Avatar name={name} />
        <span className="friend-row__body">
          <strong>{name}</strong>
          <span className="muted small">{detail}</span>
        </span>
        <span className="friend-row__open" aria-hidden="true">
          {opening ? <Spinner /> : "›"}
        </span>
      </button>
    </li>
  );
}
