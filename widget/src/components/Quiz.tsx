import { useEffect, useRef, useState } from "react";
import type { QuizViewData } from "../types";
import { ActionError, ChatStatus, useAction, useChatPrompt, type ViewProps } from "./common";
import { Icon, type IconName } from "./icons";
import "./cards.css";


function verdict(score: number, total: number, name: string | null): { icon: IconName; line: string } {
  const ratio = total > 0 ? score / total : 0;
  if (ratio === 1) return { icon: "trophy", line: name ? `Perfect score. ${name} would be impressed.` : "Perfect score. You really know your people." };
  if (ratio >= 0.8) return { icon: "star", line: name ? `So close. You clearly listen when ${name} talks.` : "So close. You clearly pay attention." };
  if (ratio >= 0.6) return { icon: "sparkle", line: "Solid. You know the things that matter." };
  if (ratio >= 0.4) return { icon: "smile", line: name ? `A decent start, and a good excuse to catch up with ${name}.` : "A decent start, and a good excuse to catch up." };
  return { icon: "sprout", line: name ? `Plenty left to discover about ${name}. That's the fun part.` : "Plenty left to discover. That's the fun part." };
}

export default function Quiz({ data, bridge, nav }: ViewProps<QuizViewData>) {
  const action = useAction();
  const chat = useChatPrompt(bridge);
  const total = data.questions.length;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  const nextRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const interacted = useRef(false);

  // Keyboard users: after answering, land on "Next"; after "Next", land on the new question.
  useEffect(() => {
    if (!interacted.current) return;
    if (picked !== null) nextRef.current?.focus();
    else headingRef.current?.focus();
  }, [picked, index, finished]);

  const isFriend = data.mode === "friend" && data.id !== null;
  const name = data.display_name;
  const first = name ? name.trim().split(/\s+/)[0] || name : null;
  const busy = action.busy !== null;

  if (total === 0) {
    return (
      <section className="vc">
        <h2 className="vc__title">{data.title}</h2>
        <ActionError action={action} />
        <p className="vc__muted">
          {isFriend && first
            ? `${first} hasn't shared enough for a quiz yet. Check back once they add a few things.`
            : "Add a few friends and their interests, then try again."}
        </p>
        <button
          type="button"
          className="vc__link"
          disabled={busy}
          onClick={() => void action.run("friends", () => nav.openView("venn_show_dashboard", {}))}
        >
          {action.busy === "friends" ? "Loading…" : "See my friends"}
        </button>
      </section>
    );
  }

  const score = results.filter(Boolean).length;

  if (finished) {
    const v = verdict(score, total, isFriend ? first : null);
    return (
      <section className="vc">
        <ActionError action={action} />
        <p className="vc__kicker">{data.title}</p>
        <h2 ref={headingRef} tabIndex={-1} className="vc__score">
          {score}/{total}
          <span className="sr-only"> correct</span>
        </h2>
        <p className="vc__body">{v.line}</p>

        {isFriend && first && data.id ? (
          <>
            {(data.common_ground.length > 0 || data.next) && (
              <div className="vc__moment">
                {data.common_ground.length > 0 && <p>You both like {data.common_ground.join(", ")}.</p>}
                {data.next && <small>Next together: {data.next.title}</small>}
              </div>
            )}
            <button
              type="button"
              className="vc__cta"
              disabled={busy}
              onClick={() => {
                const id = data.id;
                if (id) void action.run("ideas", () => nav.openView("venn_suggest_activity", { connection_id: id }));
              }}
            >
              {action.busy === "ideas" ? "Loading…" : `Get ideas with ${first}`}
            </button>
            {chat.state === "idle" || chat.state === "sending" ? (
              <button
                type="button"
                className="vc__link vc__center"
                disabled={chat.state === "sending"}
                onClick={() =>
                  void chat.send(
                    `I just scored ${score} out of ${total} on Venn's "How well do you know ${name}?" quiz. ` +
                      `Help me draft a short, playful message telling ${first} my score. I will send it myself.`,
                  )
                }
              >
                {chat.state === "sending" ? "Asking…" : `Tell ${first} my score`}
              </button>
            ) : (
              <ChatStatus state={chat.state} prompt={chat.prompt} />
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="vc__cta"
              disabled={busy}
              onClick={() => void action.run("again", () => nav.replaceView("venn_start_quiz", {}))}
            >
              {action.busy === "again" ? "Shuffling…" : "Play again"}
            </button>
            <button
              type="button"
              className="vc__link vc__center"
              disabled={busy}
              onClick={() => void action.run("friends", () => nav.openView("venn_show_dashboard", {}))}
            >
              {action.busy === "friends" ? "Loading…" : "See my friends"}
            </button>
          </>
        )}

        {data.note && <p className="vc__muted">{data.note}</p>}
      </section>
    );
  }

  const q = data.questions[index];
  const answered = picked !== null;
  const right = answered && picked === q.answer_index;
  const last = index === total - 1;

  function pick(i: number) {
    if (answered) return;
    interacted.current = true;
    setPicked(i);
    setResults((r) => [...r, i === q.answer_index]);
  }

  function next() {
    interacted.current = true;
    setPicked(null);
    if (last) setFinished(true);
    else setIndex(index + 1);
  }

  return (
    <section className="vc">
      <div className="vc__item-row">
        <p className="vc__muted" style={{ fontWeight: 600 }}>{data.title}</p>
        <span className="vc__muted" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          <span className="sr-only">Question </span>
          {index + 1}
          <span aria-hidden="true"> / </span>
          <span className="sr-only"> of </span>
          {total}
        </span>
      </div>
      <div className="vc__segs" aria-hidden="true">
        {data.questions.map((_, i) => (
          <span key={i} className={i < results.length || i === index ? "on" : ""} />
        ))}
      </div>

      <h2 key={`q${index}`} ref={headingRef} tabIndex={-1} className="vc__title">
        {q.prompt}
      </h2>

      <ul className="vc__picks" aria-label="Answers">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answer_index;
          const isPicked = i === picked;
          const state = !answered ? "" : isAnswer ? "vc__pick--right" : isPicked ? "vc__pick--wrong" : "vc__pick--dim";
          return (
            <li key={`${index}-${i}`}>
              <button type="button" className={`vc__pick ${state}`} disabled={answered} onClick={() => pick(i)}>
                <span>{opt}</span>
                {answered && isAnswer && <Icon name="check" size={18} />}
                {answered && (isAnswer || isPicked) && (
                  <span className="sr-only">{isAnswer ? (isPicked ? "Your answer, correct" : "Correct answer") : "Your answer"}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div role="status" aria-live="polite">
        {answered && (
          <p className="vc__body">
            <strong>{right ? "Right." : "Not quite."}</strong>
            {q.explanation && <> {q.explanation}</>}
          </p>
        )}
      </div>

      {answered && (
        <button ref={nextRef} type="button" className="vc__cta" onClick={next}>
          {last ? "See my score" : "Next"}
        </button>
      )}

    </section>
  );
}
