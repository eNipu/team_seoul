"use client";

import { useEffect, useRef, useState } from "react";

const SCREENS = [
  {
    key: "welcome",
    label: "Welcome",
    prompt: "Help me get started with Venn.",
    description: "Venn opens in the conversation. Start with a few questions or try it with sample friends.",
  },
  {
    key: "reply_draft",
    label: "Custom response",
    prompt: "Help me invite Maya on a photo walk.",
    description: "Venn turns the answer into a card with a draft you can copy or save privately.",
  },
  {
    key: "preview_review",
    label: "Review data",
    prompt: "I’ve been getting into film photography. Help me remember that.",
    description: "Edit the sample memory, change its visibility, or uncheck it to see the record update.",
  },
] as const;

type LiveReview = { phase: "editing" | "saving" | "saved" | "discarded"; records: unknown[] };

function isLiveReview(value: unknown): value is LiveReview {
  if (!value || typeof value !== "object" || !("phase" in value) || !("records" in value)) return false;
  return ["editing", "saving", "saved", "discarded"].includes(String(value.phase)) && Array.isArray(value.records);
}

function reviewStatus(review: LiveReview | null) {
  if (!review) return "Waiting for the review card";
  if (review.phase === "discarded") return "Draft discarded";
  if (review.phase === "saved") return "Saved in this demo";
  if (review.phase === "saving") return "Saving in this demo";
  return review.records.length ? "Awaiting approval" : "No memories selected";
}

export default function ChatGptPreview({ widgetUrl }: { widgetUrl: string }) {
  const [screen, setScreen] = useState(1);
  const [height, setHeight] = useState<number>();
  const [review, setReview] = useState<LiveReview | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const current = SCREENS[screen];
  const source = new URL(widgetUrl);
  source.searchParams.set("view", current.key);
  source.searchParams.set("theme", "light");

  useEffect(() => {
    const receivePreview = (event: MessageEvent) => {
      if (event.origin !== "null" || event.source !== frame.current?.contentWindow) return;
      const data = event.data;
      if (data?.type === "venn:preview-height" && Number.isInteger(data.height) && data.height > 0) {
        setHeight(Math.min(1800, Math.max(180, data.height)));
      }
      if (data?.type === "venn:preview-review" && (data.review === null || isLiveReview(data.review))) {
        setReview(data.review);
      }
    };
    window.addEventListener("message", receivePreview);
    return () => window.removeEventListener("message", receivePreview);
  }, []);

  return (
    <>
      <div className="chatgpt-preview__switch" role="group" aria-label="ChatGPT preview screen">
        {SCREENS.map(({ key, label }, index) => (
          <button type="button" className={index === screen ? "btn btn--primary" : "btn"}
            key={key} aria-pressed={index === screen} aria-controls="venn-preview-screen"
            onClick={() => {
              if (index === screen) return;
              setHeight(undefined);
              setReview(null);
              setScreen(index);
            }}>
            {label}
          </button>
        ))}
      </div>
      <div className="chatgpt-preview__layout" id="venn-preview-screen">
        <div className="chatgpt-preview__conversation">
          <p className="chatgpt-preview__prompt">{current.prompt}</p>
          <iframe key={current.key} ref={frame} title={`Venn widget preview – ${current.label}`}
            className="chatgpt-preview__frame" src={source.href} sandbox="allow-scripts"
            referrerPolicy="no-referrer" loading="lazy" style={{ height }} />
        </div>
        <div className="chatgpt-preview__explanation">
          <h3>{current.label}</h3>
          <p>{current.description}</p>
          {current.key === "preview_review" && (
            <>
              <h4>Memory record</h4>
              <p className="chatgpt-preview__status" role="status">{reviewStatus(review)}</p>
              {review && <pre><code>{JSON.stringify(review.records, null, 2)}</code></pre>}
            </>
          )}
          <a className="chatgpt-preview__standalone" href={source.href}>Open the widget on its own</a>
        </div>
      </div>
    </>
  );
}
