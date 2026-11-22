import { useId, useState, type FormEvent } from "react";
import type { HostBridge } from "../mcp/client";
import { LIMITS, hasId, isObj, parseFollowUp, type FollowUp } from "../types";
import { ActionError, Spinner, useAction } from "./common";
import "./cards.css";

interface Props {
  bridge: HostBridge;
  /** `{connection_id}` or `{person_id}` of the friend these belong to. */
  friend: Record<string, string>;
  name: string;
  initial: FollowUp[];
}

/** "Things to ask about": tick one off when you've asked, or jot a new one down. */
export default function FollowUps({ bridge, friend, name, initial }: Props) {
  const id = useId();
  const action = useAction();
  const [items, setItems] = useState<FollowUp[]>(initial);
  const [done, setDone] = useState<string[]>([]);
  const [text, setText] = useState("");
  const busy = action.busy !== null;

  function complete(item: FollowUp) {
    void action.run(`done-${item.follow_up_id}`, async () => {
      const res = await bridge.callTool("venn_complete_follow_up", { follow_up_id: item.follow_up_id });
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.done !== true) return "Venn couldn't tick that off.";
      setDone((d) => [...d, item.follow_up_id]);
      return null;
    });
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    void action.run("add", async () => {
      const res = await bridge.callTool("venn_add_follow_up", { ...friend, text: value });
      if (!res.ok) return res.errorText;
      if (!hasId(res.data, "follow_up_id")) return "Venn didn't confirm that. Try again.";
      setItems((list) => [...list, parseFollowUp(res.data)]);
      setText("");
      return null;
    });
  }

  return (
    <div className="vc__quiet" style={{ gap: 4 }}>
      <h3 className="vc__muted" style={{ fontWeight: 600 }}>Ask {name} about</h3>
      <ActionError action={action} />
      {items.length > 0 && (
        <ul className="vc__list">
          {items.map((item) => {
            const isDone = done.includes(item.follow_up_id);
            const pending = action.busy === `done-${item.follow_up_id}`;
            return (
              <li key={item.follow_up_id} className="vc__item-row">
                <span style={isDone ? { color: "var(--muted)" } : undefined}>{item.text}</span>
                {isDone ? (
                  <span className="vc__muted" role="status">Asked</span>
                ) : (
                  <button type="button" className="vc__link" disabled={busy} onClick={() => complete(item)}
                    aria-label={`Mark asked: ${item.text}`}>
                    {pending ? <Spinner /> : "Asked"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <form className="vc__field" onSubmit={add} style={{ marginTop: 4 }}>
        <label className="sr-only" htmlFor={`${id}-ask`}>
          Add something to ask {name}
        </label>
        <input
          id={`${id}-ask`}
          type="text"
          value={text}
          maxLength={LIMITS.followUp}
          placeholder={items.length === 0 ? `Something to ask ${name}` : "Add another"}
          autoComplete="off"
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="vc__link" disabled={busy || text.trim() === ""}>
          {action.busy === "add" ? "Adding…" : "Add"}
        </button>
      </form>
    </div>
  );
}
