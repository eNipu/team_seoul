import { useState } from "react";
import type { HostBridge } from "../mcp/client";
import {
  CATEGORY_LABELS,
  VISIBILITY_LABELS,
  formatDate,
  parseDeleteMemory,
  parseRespondConnection,
  type Connection,
  type DashboardViewData,
  type Memory,
  type PendingRequest,
} from "../types";
import ConnectionCard from "./ConnectionCard";
import ErrorBanner from "./ErrorBanner";

interface Props {
  data: DashboardViewData;
  bridge: HostBridge;
}

type Tab = "profile" | "memories" | "connections";

interface FailedAction {
  message: string;
  retry: () => void;
}

export default function Dashboard({ data, bridge }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [memories, setMemories] = useState<Memory[]>(data.memories);
  const [connections, setConnections] = useState<Connection[]>(data.connections);
  const [pending, setPending] = useState<PendingRequest[]>(data.pending_requests);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<FailedAction | null>(null);
  const [inviteState, setInviteState] = useState<"idle" | "sending" | "sent" | "unavailable">("idle");

  // Profile count may exceed the listed memories; subtract local deletions.
  const memoryCount = Math.max(memories.length, data.profile.memory_count - (data.memories.length - memories.length));

  async function deleteMemory(memoryId: string) {
    setBusyId(memoryId);
    setFailure(null);
    const res = await bridge.callTool("heldly_delete_memory", { memory_id: memoryId });
    setBusyId(null);
    if (!res.ok) {
      setFailure({ message: res.errorText, retry: () => void deleteMemory(memoryId) });
      return;
    }
    const result = parseDeleteMemory(res.data);
    const removedId = result.memory_id || memoryId;
    setMemories((ms) => ms.filter((m) => m.memory_id !== removedId));
    setConfirmDelete(null);
  }

  async function respond(req: PendingRequest, accept: boolean) {
    setBusyId(req.request_id);
    setFailure(null);
    const res = await bridge.callTool("heldly_respond_to_connection", { request_id: req.request_id, accept });
    setBusyId(null);
    if (!res.ok) {
      setFailure({ message: res.errorText, retry: () => void respond(req, accept) });
      return;
    }
    const result = parseRespondConnection(res.data);
    setPending((ps) => ps.filter((p) => p.request_id !== req.request_id));
    if (result.status === "ACCEPTED") {
      const today = new Date().toISOString();
      setConnections((cs) => [
        ...cs,
        {
          connection_id: result.connection_id ?? `pending-${req.request_id}`,
          user_id: "",
          display_name: req.sender_display_name,
          since: today,
          last_interaction_at: null,
        },
      ]);
    }
  }

  async function invite() {
    setInviteState("sending");
    const sent = await bridge.sendMessage("Create a Heldly invite code so a friend can connect with me.");
    setInviteState(sent ? "sent" : "unavailable");
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "profile", label: "Profile" },
    { id: "memories", label: "Memories", count: memories.length },
    { id: "connections", label: "Connections", count: connections.length + pending.length },
  ];

  return (
    <section className="panel">
      <nav className="tabs" role="tablist" aria-label="Dashboard sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? "tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count !== undefined && <span className="tab__count">{t.count}</span>}
          </button>
        ))}
      </nav>

      {failure && (
        <ErrorBanner
          message={failure.message}
          onRetry={failure.retry}
          onDismiss={() => setFailure(null)}
          busy={busyId !== null}
        />
      )}

      {tab === "profile" && (
        <div className="tab-panel" role="tabpanel">
          <div className="profile-head">
            <span className="avatar avatar--large" aria-hidden="true">
              {(data.profile.display_name.trim()[0] ?? "?").toUpperCase()}
            </span>
            <div>
              <h2>{data.profile.display_name}</h2>
              <p className="muted small">
                {memoryCount} {memoryCount === 1 ? "memory" : "memories"} · {connections.length}{" "}
                {connections.length === 1 ? "connection" : "connections"}
              </p>
            </div>
          </div>
          {data.profile.bio ? <p>{data.profile.bio}</p> : <p className="muted">No bio yet.</p>}

          <h3>Social goals</h3>
          {data.profile.social_goals.length > 0 ? (
            <ul className="goals">
              {data.profile.social_goals.map((g, i) => (
                <li key={`${g}-${i}`}>{g}</li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Tell Heldly what kind of connections you're looking for.</p>
          )}

          <h3>Interests</h3>
          {data.profile.interests.length > 0 ? (
            <div className="chips">
              {data.profile.interests.map((it, i) => (
                <span key={`${it}-${i}`} className="chip">
                  {it}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted small">No interests yet.</p>
          )}
        </div>
      )}

      {tab === "memories" && (
        <div className="tab-panel" role="tabpanel">
          {memories.length === 0 ? (
            <p className="muted">No saved memories yet. Ask Heldly to remember something about you.</p>
          ) : (
            <ul className="list">
              {memories.map((m) => (
                <li key={m.memory_id} className="card">
                  <div className="row row--between row--wrap">
                    <span className={`badge badge--cat-${m.category.toLowerCase()}`}>{CATEGORY_LABELS[m.category]}</span>
                    <span className={`badge badge--vis-${m.visibility.toLowerCase()}`}>{VISIBILITY_LABELS[m.visibility]}</span>
                  </div>
                  <strong className="card__title">{m.title}</strong>
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
                  <div className="row row--between">
                    <span className="muted small">{formatDate(m.created_at)}</span>
                    {confirmDelete === m.memory_id ? (
                      <div className="confirm">
                        <span className="small">Delete this memory?</span>
                        <button
                          type="button"
                          className="btn btn--danger btn--small"
                          disabled={busyId === m.memory_id}
                          onClick={() => void deleteMemory(m.memory_id)}
                        >
                          {busyId === m.memory_id ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          disabled={busyId === m.memory_id}
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        disabled={busyId !== null}
                        onClick={() => setConfirmDelete(m.memory_id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "connections" && (
        <div className="tab-panel" role="tabpanel">
          <div className="invite">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void invite()}
              disabled={inviteState === "sending"}
            >
              {inviteState === "sending" ? "Asking Heldly…" : "Invite a friend"}
            </button>
            {inviteState === "sent" && <span className="small muted">Heldly is creating an invite code in the chat.</span>}
            {inviteState === "unavailable" && (
              <span className="small muted">Ask Heldly in the chat: "Create an invite code for a friend."</span>
            )}
          </div>

          {pending.length > 0 && (
            <>
              <h3>Pending requests</h3>
              <ul className="list">
                {pending.map((r) => (
                  <li key={r.request_id} className="card request-card">
                    <div>
                      <strong>{r.sender_display_name}</strong>
                      <span className="muted small"> wants to connect · {formatDate(r.created_at)}</span>
                    </div>
                    <div className="actions actions--compact">
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        disabled={busyId !== null}
                        onClick={() => void respond(r, false)}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary btn--small"
                        disabled={busyId !== null}
                        onClick={() => void respond(r, true)}
                      >
                        {busyId === r.request_id ? "…" : "Accept"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3>Connections</h3>
          {connections.length === 0 ? (
            <p className="muted small">No connections yet. Invite a friend to get started.</p>
          ) : (
            <ul className="list">
              {connections.map((c) => (
                <ConnectionCard key={c.connection_id} connection={c} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
