import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { QuizViewData } from "../types";
import { ActionError, Avatar, ChatStatus, EmptyNote, useAction, useChatPrompt, type ViewProps } from "./common";
import { Icon, Illustration, type IconName } from "./icons";

const LETTERS = ["A", "B", "C", "D"];
const RING_R = 52;
const RING_LEN = 2 * Math.PI * RING_R;
const CONFETTI = Array.from({ length: 14 }, (_, i) => i);

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
      <section className="panel">
        <h2>{data.title}</h2>
        <ActionError action={action} />
        <EmptyNote art="quiz" title="Not enough to quiz on yet">
          {isFriend && first
            ? `${first} hasn't shared enough for a quiz. Check back once they add a few things.`
            : "Add a few friends and their interests, then try again."}
        </EmptyNote>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void action.run("friends", () => nav.openView("heldly_show_dashboard", {}))}
        >
          {action.busy === "friends" ? "Loading…" : "See my friends"}
        </button>
      </section>
    );
  }

  const score = results.filter(Boolean).length;

  if (finished) {
    const v = verdict(score, total, isFriend ? first : null);
    const ratio = score / total;
    const ringStyle = { "--ring-full": String(RING_LEN), "--ring-target": String(RING_LEN * (1 - ratio)) } as CSSProperties;
    return (
      <section className="panel quiz">
        <ActionError action={action} />
        <div className="quiz-result">
          {ratio >= 0.6 && (
            <div className="confetti" aria-hidden="true">
              {CONFETTI.map((i) => (
                <span key={i} className={`confetti__bit confetti__bit--${i % 7}`} style={{ "--i": String(i) } as CSSProperties} />
              ))}
            </div>
          )}
          <Illustration name="result" size="sm" />
          <p className="eyebrow">{data.title}</p>
          <div className="ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="ring__track" cx="60" cy="60" r={RING_R} />
              <circle className="ring__value" cx="60" cy="60" r={RING_R} style={ringStyle} />
            </svg>
            <span className="ring__icon" aria-hidden="true">
              <Icon name={v.icon} size={36} />
            </span>
          </div>
          <h2 ref={headingRef} tabIndex={-1} className="quiz-result__score">
            {score} of {total}
          </h2>
          <p className="quiz-result__verdict">{v.line}</p>
          <ol className="quiz-dots" aria-label="Your answers">
            {results.map((r, i) => (
              <li key={i} className={`quiz-dot ${r ? "quiz-dot--right" : "quiz-dot--wrong"}`}>
                <Icon name={r ? "check" : "close"} size={14} />
                <span className="sr-only">
                  Question {i + 1}: {r ? "correct" : "missed"}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {isFriend && first && data.id ? (
          <>
            {data.common_ground.length > 0 && (
              <div className="spotlight reveal">
                <span className="spotlight__label">
                  <Icon name="sparkle" size={16} /> What you two have in common
                </span>
                <div className="chips">
                  {data.common_ground.map((s, i) => (
                    <span key={`${s}-${i}`} className="chip chip--big" style={{ "--i": String(i) } as CSSProperties}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.next && (
              <div className="card">
                <span className="field__label">Do this together next</span>
                <strong className="card__title">{data.next.title}</strong>
                {data.next.description && <p>{data.next.description}</p>}
              </div>
            )}
            <div className="button-row">
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => {
                  const id = data.id;
                  if (id) void action.run("ideas", () => nav.openView("heldly_suggest_activity", { connection_id: id }));
                }}
              >
                <Icon name="bulb" size={18} />
                {action.busy === "ideas" ? "Loading…" : `Get ideas with ${first}`}
              </button>
              <button
                type="button"
                className="btn"
                disabled={chat.state === "sending"}
                onClick={() =>
                  void chat.send(
                    `I just scored ${score} out of ${total} on Heldly's "How well do you know ${name}?" quiz. ` +
                      `Help me draft a short, playful message telling ${first} my score. I will send it myself.`,
                  )
                }
              >
                <Icon name="chat" size={18} />
                {chat.state === "sending" ? "Asking…" : `Tell ${first} my score`}
              </button>
            </div>
            <ChatStatus state={chat.state} prompt={chat.prompt} />
          </>
        ) : (
          <div className="button-row">
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void action.run("again", () => nav.replaceView("heldly_start_quiz", {}))}
            >
              <Icon name="dice" size={18} />
              {action.busy === "again" ? "Shuffling…" : "Play again"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void action.run("friends", () => nav.openView("heldly_show_dashboard", {}))}
            >
              {action.busy === "friends" ? "Loading…" : "See my friends"}
            </button>
          </div>
        )}

        {data.note && <p className="muted small footnote">{data.note}</p>}
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
    <section className="panel quiz">
      {index === 0 && !answered && (
        <div className="quiz-intro">
          <Illustration name="quiz" size="sm" />
        </div>
      )}
      <div className="quiz-top">
        <div className="quiz-top__who">
          {isFriend && name && <Avatar name={name} size="small" />}
          <p className="eyebrow">{data.title}</p>
        </div>
        <span className="quiz-count">
          <span className="sr-only">Question </span>
          {index + 1}
          <span aria-hidden="true"> / </span>
          <span className="sr-only"> of </span>
          {total}
        </span>
      </div>
      <div className="quiz-progress" aria-hidden="true">
        {data.questions.map((_, i) => (
          <span
            key={i}
            className={`quiz-progress__seg ${
              i < results.length ? (results[i] ? "quiz-progress__seg--right" : "quiz-progress__seg--wrong") : i === index ? "quiz-progress__seg--now" : ""
            }`}
          />
        ))}
      </div>

      <div key={index} className="quiz-card">
        <h2 ref={headingRef} tabIndex={-1} className="quiz-prompt">
          {q.prompt}
        </h2>

        <ul className="list list--tight" aria-label="Answers">
          {q.options.map((opt, i) => {
            const isAnswer = i === q.answer_index;
            const isPicked = i === picked;
            const state = !answered ? "" : isAnswer ? "quiz-option--right" : isPicked ? "quiz-option--wrong" : "quiz-option--dim";
            return (
              <li key={i}>
                <button type="button" className={`quiz-option ${state}`} disabled={answered} onClick={() => pick(i)}>
                  <span className="quiz-option__key" aria-hidden="true">
                    {answered && isAnswer ? <Icon name="check" size={16} /> : answered && isPicked ? <Icon name="close" size={16} /> : LETTERS[i]}
                  </span>
                  <span className="quiz-option__text">{opt}</span>
                  {answered && (isAnswer || isPicked) && (
                    <span className="quiz-option__tag">
                      {isAnswer ? (isPicked ? "Your answer · correct" : "Correct answer") : "Your answer"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div role="status" aria-live="polite">
          {answered && (
            <div className={`quiz-feedback ${right ? "quiz-feedback--right" : "quiz-feedback--wrong"}`}>
              <strong className="quiz-feedback__title">
                <Icon name={right ? "check-circle" : "info"} size={18} />
                <span>{right ? "Correct!" : `Not quite. It's “${q.options[q.answer_index]}”.`}</span>
              </strong>
              {q.explanation && <p className="small">{q.explanation}</p>}
            </div>
          )}
        </div>

        {answered && (
          <button ref={nextRef} type="button" className="btn btn--primary btn--block" onClick={next}>
            {last ? "See my score" : "Next question"}
            <Icon name="arrow-right" size={18} />
          </button>
        )}
      </div>

      {data.note && <p className="muted small footnote">{data.note}</p>}
    </section>
  );
}
