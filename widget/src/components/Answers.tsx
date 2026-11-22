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
import { ActionError, ManualCopy, useAction, useCopy, type Nav, type ViewProps } from "./common";
import { Icon } from "./icons";
import "./cards.css";

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
      <li role="status">
        <p className="vc__muted">Discarded the answers from {shownName}. Nothing was saved.</p>
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
      <li role="status">
        <p className="vc__done">
          <Icon name="check-circle" size={18} />
          <span>
            Saved {plural(outcome.count, "answer", "answers")} to {savedName}
          </span>
        </p>
        {extras.map((line, i) => (
          <p key={i} className="vc__muted">
            {line}
          </p>
        ))}
        <ActionError action={action} />
        {person && (
          <button
            type="button"
            className="vc__link"
            disabled={busy}
            onClick={() => void action.run("open", () => nav.openView("venn_view_friend", { person_id: person.person_id }))}
          >
            {action.busy === "open" ? "Opening…" : `Open ${firstName(savedName)}`}
          </button>
        )}
      </li>
    );
  }

  return (
    <li>
      <div className="vc__item-row">
        <h3 className="vc__item-title">{r.name || shownName}</h3>
        <span className="vc__muted">{when}</span>
      </div>

      {isNew ? (
        <label className="vc__field" htmlFor={`${id}-name`} style={{ alignItems: "center" }}>
          <span className="vc__muted" style={{ flex: "none" }}>Save as</span>
          <input
            id={`${id}-name`}
            type="text"
            value={name}
            maxLength={LIMITS.personName}
            autoComplete="off"
            aria-invalid={nameMissing}
            aria-label="Save as a new person named"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      ) : (
        <p className="vc__muted">Adds to your note on {r.person_name || shownName}</p>
      )}

      <ul className="vc__checks">
        {r.items.map((item) => {
          const on = picked.includes(item.key);
          return (
            <li key={item.key}>
              <label className="vc__check" style={on ? undefined : { opacity: 0.5 }}>
                <input type="checkbox" checked={on} disabled={busy} onChange={() => toggle(item.key)} />
                <span>
                  <span className="vc__check-q">
                    {item.question}
                    {item.saves_as && <span className="sr-only"> Saves as: {item.saves_as}</span>}
                  </span>
                  {item.answer}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <ActionError action={action} />

      {confirming ? (
        <div className="vc__actions">
          <span className="vc__muted">Discard for good?</span>
          <button type="button" className="vc__link vc__link--danger" disabled={busy} onClick={discard}>
            {action.busy === "discard" ? "Discarding…" : "Discard"}
          </button>
          <button type="button" className="vc__link" disabled={busy} onClick={() => setConfirming(false)}>
            Keep
          </button>
        </div>
      ) : (
        <div className="vc__actions">
          <button type="button" className="vc__cta vc__cta--small" disabled={busy || picked.length === 0 || nameMissing} onClick={save}>
            {action.busy === "save" ? "Saving…" : picked.length === r.items.length ? "Save" : `Save ${picked.length}`}
          </button>
          <button type="button" className="vc__link" disabled={busy} onClick={() => setConfirming(true)}>
            Discard
          </button>
          {nameMissing && <span className="vc__muted">Add a name to save.</span>}
          {!nameMissing && picked.length === 0 && <span className="vc__muted">Tick at least one.</span>}
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
    <li>
      <div className="vc__item-row">
        <strong>{link.for_name ? `For ${link.for_name}` : "For a friend"}</strong>
        <span className="vc__muted">
          {revoked ? "Revoked" : expired ? "Expired" : `${plural(link.responses, "response", "responses")}${expires ? ` · until ${expires}` : ""}`}
        </span>
      </div>
      {live &&
        (confirming ? (
          <div className="vc__actions">
            <span className="vc__muted">Revoke? It stops working right away.</span>
            <button type="button" className="vc__link vc__link--danger" disabled={busy} onClick={revoke}>
              {action.busy === "revoke" ? "Revoking…" : "Revoke"}
            </button>
            <button type="button" className="vc__link" disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <div className="vc__actions">
            {link.link && (
              <button type="button" className="vc__link" onClick={() => void copy("link", link.link)}>
                {copied === "link" ? "Copied" : "Copy link"}
              </button>
            )}
            <button type="button" className="vc__link vc__link--danger" disabled={busy} onClick={() => setConfirming(true)}>
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
  const waiting = data.responses.length;

  return (
    <section className="vc">
      <h2 className="vc__title">
        {waiting === 0 ? "No answers yet." : `${data.responses[0].name || "A friend"} answered.`}
      </h2>
      <p className="vc__muted">
        {waiting > 0 ? "Untick anything to skip it." : "Send a friend four quick questions. Their answers land here."}
      </p>

      <ActionError action={action} />

      {waiting === 0 ? (
        <button type="button" className="vc__cta" disabled={busy} onClick={create}>
          {action.busy === "create" ? "Creating…" : "Create a link"}
        </button>
      ) : (
        <>
          <ul className="vc__items">
            <ResponseCard key={data.responses[0].response_id} r={data.responses[0]} bridge={bridge} nav={nav} />
          </ul>
          {data.responses.length > 1 && (
            <details className="vc__more">
              <summary>{plural(data.responses.length - 1, "more answer", "more answers")}</summary>
              <ul className="vc__items">
                {data.responses.slice(1).map((r) => (
                  <ResponseCard key={r.response_id} r={r} bridge={bridge} nav={nav} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {(data.links.length > 0 || waiting > 0) && (
        <details className="vc__more">
          <summary>Your question links{data.links.length > 0 ? ` (${data.links.length})` : ""}</summary>
          <div className="vc__more-body">
            {data.links.length > 0 && (
              <ul className="vc__items">
                {data.links.map((l) => (
                  <LinkRow key={l.link_id} link={l} bridge={bridge} />
                ))}
              </ul>
            )}
            {waiting > 0 && (
              <button type="button" className="vc__link" disabled={busy} onClick={create}>
                {action.busy === "create" ? "Creating…" : "Create a new link"}
              </button>
            )}
          </div>
        </details>
      )}

    </section>
  );
}
