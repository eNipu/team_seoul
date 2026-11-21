import { useId, useState, type FormEvent } from "react";
import type { HostBridge } from "../mcp/client";
import { LIMITS, hasId, isObj, parseFollowUp, type FollowUp } from "../types";
import { ActionError, SectionTitle, Spinner, useAction } from "./common";

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
  const open = items.filter((f) => !done.includes(f.follow_up_id)).length;

  function complete(item: FollowUp) {
    void action.run(`done-${item.follow_up_id}`, async () => {
      const res = await bridge.callTool("heldly_complete_follow_up", { follow_up_id: item.follow_up_id });
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.done !== true) return "Heldly couldn't tick that off.";
      setDone((d) => [...d, item.follow_up_id]);
      return null;
    });
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    void action.run("add", async () => {
      const res = await bridge.callTool("heldly_add_follow_up", { ...friend, text: value });
      if (!res.ok) return res.errorText;
      if (!hasId(res.data, "follow_up_id")) return "Heldly didn't confirm that. Try again.";
      setItems((list) => [...list, parseFollowUp(res.data)]);
      setText("");
      return null;
    });
  }

  return (
    <>
      <SectionTitle count={open}>Things to ask about</SectionTitle>
      <ActionError action={action} />
      {items.length === 0 ? (
        <p className="muted small">Nothing yet. Jot down what you want to remember to ask {name}.</p>
      ) : (
        <ul className="list ask-list">
          {items.map((item) => {
            const isDone = done.includes(item.follow_up_id);
            const pending = action.busy === `done-${item.follow_up_id}`;
            return (
              <li key={item.follow_up_id}>
                <label className={`ask ${isDone ? "ask--done" : ""}`}>
                  <input type="checkbox" checked={isDone} disabled={isDone || busy} onChange={() => complete(item)} />
                  <span className="ask__text">{item.text}</span>
                  {pending && <Spinner />}
                  {isDone && <span className="ask__state">Asked</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <form className="ask-add" onSubmit={add}>
        <label className="sr-only" htmlFor={`${id}-ask`}>
          Add something to ask {name}
        </label>
        <input
          id={`${id}-ask`}
          type="text"
          value={text}
          maxLength={LIMITS.followUp}
          placeholder="How did the interview go?"
          autoComplete="off"
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn--small" disabled={busy || text.trim() === ""}>
          {action.busy === "add" ? "Adding…" : "Add"}
        </button>
      </form>
    </>
  );
}
