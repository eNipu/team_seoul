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
    description: "Try editing the proposal or changing who can see it. Saving here only updates this preview.",
  },
] as const;

const EXAMPLE = {
  category: "INTEREST",
  title: "Getting into film photography",
  description: "Bought a second-hand film camera and shoots a roll every weekend.",
  tags: ["photography", "hobby"],
  visibility: "PRIVATE",
};

export default function ChatGptPreview({ widgetUrl }: { widgetUrl: string }) {
  const [screen, setScreen] = useState(0);
  const [height, setHeight] = useState<number>();
  const frame = useRef<HTMLIFrameElement>(null);
  const current = SCREENS[screen];
  const source = new URL(widgetUrl);
  source.searchParams.set("view", current.key);
  source.searchParams.set("theme", "light");

  useEffect(() => {
    const receiveHeight = (event: MessageEvent) => {
      if (event.origin !== "null" || event.source !== frame.current?.contentWindow) return;
      const data = event.data;
      if (data?.type !== "venn:preview-height" || !Number.isInteger(data.height) || data.height < 1) return;
      setHeight(Math.min(1800, Math.max(180, data.height)));
    };
    window.addEventListener("message", receiveHeight);
    return () => window.removeEventListener("message", receiveHeight);
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
              <h4>Example of an approved memory</h4>
              <pre><code>{JSON.stringify(EXAMPLE, null, 2)}</code></pre>
            </>
          )}
        </div>
      </div>
    </>
  );
}
