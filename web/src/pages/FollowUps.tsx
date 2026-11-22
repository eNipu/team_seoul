// Every open follow-up, oldest first, grouped by friend.

import { useMemo, useState } from "react";
import { api } from "../api";
import { Link } from "../router";
import { LIMITS, formatDate, friendPath, type FollowUpItem, type FriendKind } from "../types";
import { Avatar, EmptyState, Field, InlineError, Loaded, PageHeader, Skeleton, splitKey, useAction, useAsync, useToast } from "../ui";
import { TickButton } from "./shared";
import "./tools.css";

interface Group {
  kind: FriendKind;
  id: string;
  name: string;
  items: FollowUpItem[];
}

function AddFollowUp({ onAdded }: { onAdded: () => void }) {
  const friends = useAsync(() => api.listFriends(), []);
  const [who, setWho] = useState("");
  const [text, setText] = useState("");
  const act = useAction();
  const toast = useToast();
  const list = friends.data ?? [];
  return (
    <details className="tl__more">
      <summary>Add a follow-up</summary>
      {friends.data && list.length === 0 ? (
        <p>
          Follow-ups belong to a person. <Link to="/people" query={{ new: "1" }}>Add a person</Link> first.
        </p>
      ) : (
        <form
          className="tl__form"
          onSubmit={(e) => {
            e.preventDefault();
            const t = text.trim();
            if (!who || !t) return;
            const { kind, id } = splitKey(who);
            void act.run(async () => {
              await api.addFollowUp(kind, id, t);
              setText("");
              toast("Follow-up added.");
              onAdded();
            });
          }}
        >
          <Field label="Who">
            {(p) => (
              <select {...p} value={who} onChange={(e) => setWho(e.target.value)} required>
                <option value="">Choose a friend</option>
                {list.map((f) => (
                  <option key={`${f.kind}:${f.id}`} value={`${f.kind}:${f.id}`}>
                    {f.display_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="What to ask">
            {(p) => (
              <input
                {...p}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={LIMITS.followUp}
                placeholder="Ask how the move went"
                required
              />
            )}
          </Field>
          <div><button type="submit" className="btn btn--primary" disabled={act.busy || !who || !text.trim()}>
            {act.busy ? "Adding…" : "Add"}
          </button></div>
        </form>
      )}
      <InlineError message={act.error ?? friends.error} />
    </details>
  );
}

export default function FollowUps() {
  const followUps = useAsync(() => api.listFollowUps(), []);
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const out: Group[] = [];
    // The list is oldest first; groups keep the order of each friend's oldest item.
    for (const f of followUps.data ?? []) {
      let g = out.find((x) => x.kind === f.kind && x.id === f.id);
      if (!g) {
        g = { kind: f.kind, id: f.id, name: f.display_name, items: [] };
        out.push(g);
      }
      g.items.push(f);
    }
    return out;
  }, [followUps.data]);

  return (
    <div className="page tl">
      <PageHeader title="Follow-ups" />
      <Loaded state={followUps} skeleton={<Skeleton rows={4} />}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState illustration="done" title="You're all caught up" />
          ) : (
            <ul className="tl__list">
              {groups.map((g, i) => (
                <li key={`${g.kind}:${g.id}`} className={`tl__card ${i === 0 ? "tl__moment" : ""}`}>
                  <div className="tl__who">
                    <Avatar name={g.name} size="small" />
                    <h2>
                      <Link to={friendPath(g.kind, g.id)}>{g.name}</Link>
                    </h2>
                  </div>
                  <ul className="tl__items">
                    {g.items.map((f) => (
                      <li key={f.follow_up_id}>
                        <TickButton
                          label={`Mark done: ${f.text}`}
                          busy={busyId === f.follow_up_id}
                          onClick={async () => {
                            setBusyId(f.follow_up_id);
                            try {
                              await api.completeFollowUp(f.follow_up_id);
                              toast("Follow-up done.");
                              followUps.reload();
                            } catch (e) {
                              toast(e instanceof Error ? e.message : "That didn't work.", "error");
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        />
                        <span title={`Added ${formatDate(f.created_at)}`}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )
        }
      </Loaded>
      <AddFollowUp onAdded={followUps.reload} />
    </div>
  );
}
