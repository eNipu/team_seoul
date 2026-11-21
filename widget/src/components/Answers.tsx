import { useId, useState } from "react";
import {
  LIMITS,
  firstName,
  formatDate,
  formatRelative,
  isObj,
  parseSaveAnswers,
  plural,
  type AnswerResponse,
  type AnswersViewData,
  type QuestionLink,
  type SaveAnswersResult,
} from "../types";
import type { HostBridge } from "../mcp/client";
import { ActionError, Avatar, EmptyNote, ManualCopy, SectionTitle, useAction, useCopy, type Nav, type ViewProps } from "./common";
import { Icon } from "./icons";

type Outcome = { kind: "saved"; result: SaveAnswersResult; count: number } | { kind: "discarded" };

function ResponseCard({ r, bridge, nav }: { r: AnswerResponse; bridge: HostBridge; nav: Nav }) {
  const id = useId();
  const action = useAction();
  const [name, setName] = useState(r.name.slice(0, LIMITS.personName));
  const [picked, setPicked] = useState<string[]>(() => r.items.map((i) => i.key));
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const isNew = r.person_id === null;
  const shownName = (isNew ? name.trim() : r.person_name) || r.name || "Your friend";
  const busy = action.busy !== null;
  const nameMissing = isNew && name.trim() === "";
  const when = formatRelative(r.received_at) || formatDate(r.received_at);

  function toggle(key: string) {
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }

  function save() {
    void action.run("save", async () => {
      const keys = r.items.map((i) => i.key).filter((k) => picked.includes(k));
      const args: Record<string, unknown> = { response_id: r.response_id, keys };
      if (isNew) args.name = name.trim();
      const res = await bridge.callTool("venn_save_answers", args);
      if (!res.ok) return res.errorText;
      const result = parseSaveAnswers(res.data);
      if (!result.saved) return "Venn couldn't save these answers.";
      setOutcome({ kind: "saved", result, count: keys.length });
      return null;
    });
  }

  function discard() {
    void action.run("discard", async () => {
      const res = await bridge.callTool("venn_discard_answers", { response_id: r.response_id });
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.discarded !== true) return "Venn couldn't discard these answers.";
      setOutcome({ kind: "discarded" });
      return null;
    });
  }

  if (outcome?.kind === "discarded") {
    return (
      <li className="card card--quiet" role="status">
        <p className="muted small">
          <Icon name="trash" size={16} /> Discarded the answers from {shownName}. Nothing was saved.
        </p>
      </li>
    );
  }

  if (outcome?.kind === "saved") {
    const person = outcome.result.person;
    const savedName = person?.name || shownName;
    const extras: string[] = [];
    if (outcome.result.added_interests.length > 0) extras.push(`Added ${plural(outcome.result.added_interests.length, "interest", "interests")}: ${outcome.result.added_interests.join(", ")}.`);
    if (outcome.result.follow_up) extras.push(`Added a follow-up: “${outcome.result.follow_up.text}”`);
    return (
      <li className="card answer-saved" role="status">
        <p className="logged-row">
          <Icon name="check-circle" size={18} />
          <span>
            Saved {plural(outcome.count, "answer", "answers")} to your note on {savedName}
          </span>
        </p>
        {extras.map((line, i) => (
          <p key={i} className="muted small">
            {line}
          </p>
        ))}
        <ActionError action={action} />
        {person && (
          <div className="card__actions">
            <button
              type="button"
              className="btn btn--small"
              disabled={busy}
              onClick={() => void action.run("open", () => nav.openView("venn_view_friend", { person_id: person.person_id }))}
            >
              {action.busy === "open" ? "Opening…" : `Open ${firstName(savedName)}`}
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="card answer">
      <div className="answer__head">
        <Avatar name={shownName} />
        <div className="answer__who">
          <strong className="card__title">{r.name || shownName} answered</strong>
          <span className="muted small">{when}</span>
        </div>
      </div>

      {isNew ? (
        <label className="field" htmlFor={`${id}-name`}>
          <span className="field__label">Save as a new person named</span>
          <input
            id={`${id}-name`}
            type="text"
            value={name}
            maxLength={LIMITS.personName}
            autoComplete="off"
            aria-invalid={nameMissing}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      ) : (
        <p className="answer__target">
          <Icon name="note" size={16} />
          <span>Updates your note on {r.person_name || shownName}</span>
        </p>
      )}

      <ul className="answer__items">
        {r.items.map((item) => {
          const on = picked.includes(item.key);
          return (
            <li key={item.key}>
              <label className={`answer-item ${on ? "" : "answer-item--off"}`}>
                <input type="checkbox" checked={on} disabled={busy} onChange={() => toggle(item.key)} />
                <span className="answer-item__body">
                  <span className="answer-item__q">
                    <span>{item.question}</span>
                    {item.saves_as && <span className="badge badge--note">Saves as: {item.saves_as}</span>}
                  </span>
                  <span className="answer-item__a">{item.answer}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <ActionError action={action} />

      {confirming ? (
        <div className="confirm">
          <span className="small">Discard these answers? They can't be brought back.</span>
          <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={discard}>
            {action.busy === "discard" ? "Discarding…" : "Discard"}
          </button>
          <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setConfirming(false)}>
            Keep
          </button>
        </div>
      ) : (
        <div className="card__actions">
          <button type="button" className="btn btn--primary btn--small" disabled={busy || picked.length === 0 || nameMissing} onClick={save}>
            <Icon name="check" size={16} />
            {action.busy === "save" ? "Saving…" : picked.length === r.items.length ? "Save selected" : `Save selected (${picked.length})`}
          </button>
          <button type="button" className="btn btn--danger-quiet btn--small" disabled={busy} onClick={() => setConfirming(true)}>
            Discard
          </button>
          {nameMissing && <span className="muted small">Add a name to save.</span>}
          {!nameMissing && picked.length === 0 && <span className="muted small">Tick at least one answer.</span>}
        </div>
      )}
    </li>
  );
}

function LinkRow({ link, bridge }: { link: QuestionLink; bridge: HostBridge }) {
  const action = useAction();
  const { copied, manual, copy } = useCopy();
  const [revoked, setRevoked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const busy = action.busy !== null;
  const expired = !revoked && !link.active;
  const live = link.active && !revoked;
  const expires = formatDate(link.expires_at);

  function revoke() {
    void action.run("revoke", async () => {
      const res = await bridge.callTool("venn_revoke_question_link", { link_id: link.link_id });
      if (!res.ok) return res.errorText;
      if (!isObj(res.data) || res.data.revoked !== true) return "Venn couldn't revoke this link.";
      setRevoked(true);
      setConfirming(false);
      return null;
    });
  }

  return (
    <li className="link-row">
      <div className="link-row__main">
        <div className="link-row__text">
          <strong>{link.for_name ? `For ${link.for_name}` : "For a friend"}</strong>
          <span className="muted small">
            {plural(link.responses, "response", "responses")}
            {live && expires ? ` · expires ${expires}` : ""}
          </span>
        </div>
        <span className={`badge ${live ? "badge--live" : "badge--off"}`}>{revoked ? "Revoked" : expired ? "Expired" : "Active"}</span>
      </div>
      {live &&
        (confirming ? (
          <div className="confirm">
            <span className="small">Revoke this link? It will stop working right away.</span>
            <button type="button" className="btn btn--danger btn--small" disabled={busy} onClick={revoke}>
              {action.busy === "revoke" ? "Revoking…" : "Revoke"}
            </button>
            <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <div className="card__actions">
            {link.link && (
              <button type="button" className="btn btn--small" onClick={() => void copy("link", link.link)}>
                <Icon name={copied === "link" ? "check" : "link"} size={16} />
                {copied === "link" ? "Copied" : "Copy link"}
              </button>
            )}
            <button type="button" className="btn btn--danger-quiet btn--small" disabled={busy} onClick={() => setConfirming(true)}>
              Revoke
            </button>
            <span className="sr-only" role="status">
              {copied ? "Link copied to clipboard" : ""}
            </span>
          </div>
        ))}
      {manual !== null && live && <ManualCopy text={manual} />}
      <ActionError action={action} />
    </li>
  );
}

export default function Answers({ data, bridge, nav }: ViewProps<AnswersViewData>) {
  const action = useAction();
  const busy = action.busy !== null;
  const create = () => void action.run("create", () => nav.openView("venn_create_question_link", {}));

  return (
    <section className="panel">
      <div className="hero hero--row">
        <span className="week-badge" aria-hidden="true">
          <Icon name="inbox" size={26} />
        </span>
        <div>
          <p className="eyebrow">Answers from friends</p>
          <h2>{data.responses.length > 0 ? `${plural(data.responses.length, "answer", "answers")} waiting for your review` : "No answers waiting"}</h2>
          {data.responses.length > 0 && <p className="muted small">Untick anything you'd rather not keep. Nothing is saved until you approve it.</p>}
        </div>
      </div>

      <ActionError action={action} />

      {data.responses.length === 0 ? (
        <>
          <EmptyNote art="chat" title="No answers waiting">
            Send a friend a short link with four questions. Their answers show up here for you to review.
          </EmptyNote>
          <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={create}>
            <Icon name="link" size={18} />
            {action.busy === "create" ? "Creating…" : "Create a link"}
          </button>
        </>
      ) : (
        <ul className="list">
          {data.responses.map((r) => (
            <ResponseCard key={r.response_id} r={r} bridge={bridge} nav={nav} />
          ))}
        </ul>
      )}

      {data.links.length > 0 && (
        <>
          <SectionTitle count={data.links.length}>Your question links</SectionTitle>
          <ul className="list list--tight">
            {data.links.map((l) => (
              <LinkRow key={l.link_id} link={l} bridge={bridge} />
            ))}
          </ul>
        </>
      )}

      {data.responses.length > 0 && (
        <button type="button" className="btn btn--dashed btn--block" disabled={busy} onClick={create}>
          <Icon name="plus" size={18} />
          {action.busy === "create" ? "Creating…" : "Create a link"}
        </button>
      )}

      {data.note && <p className="muted small footnote">{data.note}</p>}
    </section>
  );
}
