import { useEffect, useRef, useState } from "react";
import { applyTheme, connectToHost, extractText, type HostBridge } from "./mcp/client";
import { createMockBridge, mockInitialView } from "./mock";
import { parseView, type ViewData } from "./types";
import MemoryReview from "./components/MemoryReview";
import Dashboard from "./components/Dashboard";
import ErrorBanner from "./components/ErrorBanner";

const inHost = typeof window !== "undefined" && window.parent !== window;

export default function App() {
  const [bridge, setBridge] = useState<HostBridge | null>(null);
  const [view, setView] = useState<ViewData | null>(null);
  // Bumped on every host-delivered result so child views remount with fresh state.
  const [viewKey, setViewKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const toolRunning = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode double-invoke guard: connect exactly once.
    started.current = true;

    if (!inHost) {
      applyTheme(undefined);
      setBridge(createMockBridge());
      // Simulate the host delivering a tool result shortly after load.
      setTimeout(() => {
        setView(mockInitialView());
        setLoading(false);
      }, 500);
      return undefined;
    }

    connectToHost({
      onToolInput: () => {
        toolRunning.current = true;
        setLoading(true);
        setError(null);
      },
      onToolResult: (result) => {
        toolRunning.current = false;
        setLoading(false);
        if (result.isError) {
          setError(extractText(result) || "Heldly couldn't complete that request.");
          return;
        }
        const parsed = parseView(result.structuredContent);
        setError(null);
        setView(parsed);
        setViewKey((k) => k + 1);
      },
      onToolCancelled: () => {
        toolRunning.current = false;
        setLoading(false);
      },
      onHostContext: () => {
        /* theme is applied inside the bridge */
      },
    })
      .then((b) => {
        setBridge(b);
        // If the host never signals a running tool, fall back to the empty state.
        setTimeout(() => {
          if (!toolRunning.current) setLoading(false);
        }, 4000);
      })
      .catch((e: unknown) => {
        setLoading(false);
        setError(`Couldn't connect to ChatGPT: ${e instanceof Error ? e.message : String(e)}`);
      });
    return undefined;
  }, []);

  const showSkeleton = loading && !error;

  return (
    <div className="heldly">
      <header className="heldly__header">
        <span className="logo" aria-hidden="true">♡</span>
        <span className="heldly__brand">Heldly</span>
        {bridge?.isMock && <span className="badge badge--demo">Demo mode</span>}
      </header>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {showSkeleton ? (
        <Skeleton />
      ) : view && bridge ? (
        view.view === "memory_review" ? (
          <MemoryReview key={viewKey} data={view} bridge={bridge} />
        ) : (
          <Dashboard key={viewKey} data={view} bridge={bridge} />
        )
      ) : (
        <EmptyState demo={bridge?.isMock ?? false} />
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      <div className="skeleton__line skeleton__line--title" />
      <div className="skeleton__line" />
      <div className="skeleton__line skeleton__line--short" />
      <div className="skeleton__block" />
    </div>
  );
}

function EmptyState({ demo }: { demo: boolean }) {
  return (
    <div className="empty">
      <div className="empty__art" aria-hidden="true">☕</div>
      <p className="empty__title">Hi, I'm Heldly.</p>
      <p className="muted">Ask Heldly to get to know you, remember something, or show your dashboard</p>
      {demo && (
        <p className="small muted">
          Demo: try <a href="?view=memory_review">?view=memory_review</a> or <a href="?view=dashboard">?view=dashboard</a>
        </p>
      )}
    </div>
  );
}
