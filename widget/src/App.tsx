import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyTheme, connectToHost, extractText, type HostBridge } from "./mcp/client";
import { DEMO_VIEWS, createMockBridge, demoParam, mockInitialView } from "./mock";
import { friendArg, parseView, type ViewData } from "./types";
import MemoryReview from "./components/MemoryReview";
import MemoryImport from "./components/MemoryImport";
import Dashboard, { type DashboardTab } from "./components/Dashboard";
import Invite from "./components/Invite";
import ActivityIdeas from "./components/ActivityIdeas";
import Reconnect from "./components/Reconnect";
import Friend from "./components/Friend";
import Welcome from "./components/Welcome";
import PeopleImport from "./components/PeopleImport";
import PeopleSearch from "./components/PeopleSearch";
import GroupPlan from "./components/GroupPlan";
import Brief from "./components/Brief";
import Quiz from "./components/Quiz";
import ErrorBanner from "./components/ErrorBanner";
import { Spinner, type Nav } from "./components/common";

const inHost = typeof window !== "undefined" && window.parent !== window;

/** One entry of the in-widget view stack. `key` changes whenever the data is replaced. */
interface Entry {
  view: ViewData;
  key: number;
}

type SkeletonKind = "dashboard" | "profile" | "ticket" | "cards";

function skeletonFor(hint: string | null | undefined): SkeletonKind {
  switch (hint) {
    case "heldly_show_dashboard":
    case "dashboard":
      return "dashboard";
    case "heldly_view_friend":
    case "friend":
    case "friend_person":
    case "welcome":
    case "heldly_meetup_brief":
    case "brief":
    case "brief_person":
      return "profile";
    case "heldly_create_invite":
    case "invite":
      return "ticket";
    default:
      return "cards";
  }
}

/** The tool call that re-fetches a view, for views whose data a child view can change. */
function refreshCall(view: ViewData): { tool: string; args: Record<string, unknown> } | null {
  switch (view.view) {
    case "dashboard":
      return { tool: "heldly_show_dashboard", args: {} };
    case "reconnect":
      return { tool: "heldly_reconnection_suggestions", args: {} };
    case "friend":
      return view.id ? { tool: "heldly_view_friend", args: friendArg(view.kind, view.id) } : null;
    case "brief":
      return view.id ? { tool: "heldly_meetup_brief", args: friendArg(view.kind, view.id) } : null;
    case "people_search":
      return view.query ? { tool: "heldly_find_people", args: { query: view.query } } : null;
    default:
      return null;
  }
}

function demoTab(): DashboardTab | null {
  const t = demoParam("tab");
  return t === "profile" || t === "memories" || t === "friends" ? t : null;
}

export default function App() {
  const [bridge, setBridge] = useState<HostBridge | null>(null);
  const [stack, setStackState] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skeleton, setSkeleton] = useState<SkeletonKind>(() => skeletonFor(inHost ? null : demoParam("view")));

  const started = useRef(false);
  const toolRunning = useRef(false);
  const bridgeRef = useRef<HostBridge | null>(null);
  const stackRef = useRef<Entry[]>([]);
  const keyRef = useRef(0);
  // Bumped whenever the host delivers a result, so in-flight widget navigation is discarded.
  const generation = useRef(0);
  // Remembers the dashboard tab across navigation and refreshes.
  const dashboardTab = useRef<DashboardTab | null>(inHost ? null : demoTab());

  const setStack = useCallback((next: Entry[]) => {
    stackRef.current = next;
    setStackState(next);
  }, []);
  const entry = useCallback((view: ViewData): Entry => ({ view, key: ++keyRef.current }), []);

  useEffect(() => {
    if (started.current) return; // StrictMode double-invoke guard: connect exactly once.
    started.current = true;

    if (!inHost) {
      const theme = demoParam("theme");
      applyTheme(theme === "dark" || theme === "light" ? theme : undefined);
      const mock = createMockBridge();
      bridgeRef.current = mock;
      setBridge(mock);
      // Simulate the host delivering a tool result shortly after load.
      setTimeout(() => {
        const initial = mockInitialView();
        setStack(initial ? [entry(initial)] : []);
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
        // A host-delivered result always resets the stack to that single view.
        generation.current += 1;
        dashboardTab.current = null;
        setRefreshing(false);
        setError(null);
        setStack(parsed ? [entry(parsed)] : []);
      },
      onToolCancelled: () => {
        toolRunning.current = false;
        setLoading(false);
      },
      onHostContext: (ctx) => {
        /* theme is applied inside the bridge; the tool name only picks a skeleton shape */
        const name = ctx.toolInfo?.tool?.name;
        if (typeof name === "string") setSkeleton(skeletonFor(name));
      },
    })
      .then((b) => {
        bridgeRef.current = b;
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
  }, [entry, setStack]);

  /** Call a view-returning tool, then push its view or swap it in for the current one. */
  const loadView = useCallback(
    async (tool: string, args: Record<string, unknown>, replace: boolean): Promise<string | null> => {
      const b = bridgeRef.current;
      if (!b) return "Heldly isn't connected yet.";
      const gen = generation.current;
      const res = await b.callTool(tool, args);
      if (gen !== generation.current) return null; // superseded by a host-delivered result
      if (!res.ok) return res.errorText;
      const parsed = parseView(res.data);
      if (!parsed) return "Heldly sent something this widget can't show yet.";
      setError(null);
      const cur = stackRef.current;
      setStack([...(replace ? cur.slice(0, -1) : cur), entry(parsed)]);
      window.scrollTo?.(0, 0);
      return null;
    },
    [entry, setStack],
  );
  const openView = useCallback((tool: string, args: Record<string, unknown>) => loadView(tool, args, false), [loadView]);
  const replaceView = useCallback((tool: string, args: Record<string, unknown>) => loadView(tool, args, true), [loadView]);

  /** Re-fetch the view at `key` (if it is refreshable) and swap it in. Keeps the stale view on failure. */
  const refresh = useCallback(
    async (target: Entry) => {
      const b = bridgeRef.current;
      const call = refreshCall(target.view);
      if (!b || !call) return;
      const gen = generation.current;
      setRefreshing(true);
      const res = await b.callTool(call.tool, call.args);
      if (gen !== generation.current) return;
      setRefreshing(false);
      if (!res.ok) return;
      const parsed = parseView(res.data);
      if (!parsed || parsed.view !== target.view.view) return;
      setStack(stackRef.current.map((e) => (e.key === target.key ? entry(parsed) : e)));
    },
    [entry, setStack],
  );

  const back = useCallback(() => {
    const cur = stackRef.current;
    if (cur.length < 2) return;
    const next = cur.slice(0, -1);
    setStack(next);
    window.scrollTo?.(0, 0);
    // The child view may have changed data the parent shows: show it stale, then refresh.
    void refresh(next[next.length - 1]);
  }, [refresh, setStack]);

  const canGoBack = stack.length > 1;
  const nav: Nav = useMemo(
    () => ({ openView, replaceView, back, canGoBack }),
    [openView, replaceView, back, canGoBack],
  );
  const onTabChange = useCallback((t: DashboardTab) => {
    dashboardTab.current = t;
  }, []);

  const showSkeleton = loading && !error;
  const top = stack.length > 0 ? stack[stack.length - 1] : null;

  return (
    <div className="heldly">
      <header className="heldly__header">
        {canGoBack && !showSkeleton && (
          <button type="button" className="btn btn--ghost btn--small back" onClick={back}>
            <span aria-hidden="true">←</span> Back
          </button>
        )}
        <span className="logo" aria-hidden="true">♡</span>
        <span className="heldly__brand">Heldly</span>
        <span className="heldly__spacer" />
        {refreshing && <Spinner label="Refreshing" />}
        {bridge?.isMock && <span className="badge badge--demo">Demo mode</span>}
      </header>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {showSkeleton ? (
        <Skeleton kind={skeleton} />
      ) : top && bridge ? (
        <div className={`view ${refreshing ? "view--refreshing" : ""}`} aria-busy={refreshing}>
          {renderView(top, bridge, nav, dashboardTab.current, onTabChange)}
        </div>
      ) : (
        <EmptyState demo={bridge?.isMock ?? false} />
      )}
    </div>
  );
}

function renderView(
  { view, key }: Entry,
  bridge: HostBridge,
  nav: Nav,
  tab: DashboardTab | null,
  onTabChange: (t: DashboardTab) => void,
) {
  switch (view.view) {
    case "memory_review":
      return <MemoryReview key={key} data={view} bridge={bridge} nav={nav} />;
    case "memory_import":
      return <MemoryImport key={key} data={view} bridge={bridge} nav={nav} />;
    case "dashboard":
      return <Dashboard key={key} data={view} bridge={bridge} nav={nav} initialTab={tab} onTabChange={onTabChange} />;
    case "invite":
      return <Invite key={key} data={view} bridge={bridge} nav={nav} />;
    case "activity_ideas":
      return <ActivityIdeas key={key} data={view} bridge={bridge} nav={nav} />;
    case "reconnect":
      return <Reconnect key={key} data={view} bridge={bridge} nav={nav} />;
    case "friend":
      return <Friend key={key} data={view} bridge={bridge} nav={nav} />;
    case "welcome":
      return <Welcome key={key} data={view} bridge={bridge} nav={nav} />;
    case "people_import":
      return <PeopleImport key={key} data={view} bridge={bridge} nav={nav} />;
    case "people_search":
      return <PeopleSearch key={key} data={view} bridge={bridge} nav={nav} />;
    case "group_plan":
      return <GroupPlan key={key} data={view} bridge={bridge} nav={nav} />;
    case "brief":
      return <Brief key={key} data={view} bridge={bridge} nav={nav} />;
    case "quiz":
      return <Quiz key={key} data={view} bridge={bridge} nav={nav} />;
  }
}

function Skeleton({ kind }: { kind: SkeletonKind }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {kind === "dashboard" && (
        <>
          <div className="skeleton__row">
            <div className="skeleton__pill" />
            <div className="skeleton__pill" />
            <div className="skeleton__pill" />
          </div>
          <div className="skeleton__row">
            <div className="skeleton__circle skeleton__circle--large" />
            <div className="skeleton__stack">
              <div className="skeleton__line skeleton__line--title" />
              <div className="skeleton__line skeleton__line--short" />
            </div>
          </div>
          <div className="skeleton__line" />
          <div className="skeleton__line skeleton__line--short" />
          <div className="skeleton__block" />
        </>
      )}
      {kind === "profile" && (
        <>
          <div className="skeleton__row">
            <div className="skeleton__circle skeleton__circle--large" />
            <div className="skeleton__stack">
              <div className="skeleton__line skeleton__line--title" />
              <div className="skeleton__line skeleton__line--short" />
            </div>
          </div>
          <div className="skeleton__row">
            <div className="skeleton__pill" />
            <div className="skeleton__pill" />
            <div className="skeleton__pill" />
          </div>
          <div className="skeleton__block" />
          <div className="skeleton__line" />
        </>
      )}
      {kind === "ticket" && (
        <>
          <div className="skeleton__line skeleton__line--title" />
          <div className="skeleton__block skeleton__block--ticket" />
          <div className="skeleton__row">
            <div className="skeleton__pill skeleton__pill--wide" />
            <div className="skeleton__pill skeleton__pill--wide" />
          </div>
          <div className="skeleton__line skeleton__line--short" />
        </>
      )}
      {kind === "cards" && (
        <>
          <div className="skeleton__line skeleton__line--title" />
          <div className="skeleton__line skeleton__line--short" />
          <div className="skeleton__block" />
          <div className="skeleton__block" />
        </>
      )}
    </div>
  );
}

function EmptyState({ demo }: { demo: boolean }) {
  return (
    <div className="panel empty">
      <div className="empty__art" aria-hidden="true">☕</div>
      <p className="empty__title">Hi, I'm Heldly.</p>
      <p className="muted">Ask Heldly to get to know you, remember something, or show your dashboard</p>
      {demo && (
        <div className="demo-links">
          <p className="small muted">Demo views</p>
          <div className="chips chips--center">
            {DEMO_VIEWS.map((v) => (
              <a key={v} className="chip chip--link" href={`?view=${v}`}>
                {v}
              </a>
            ))}
          </div>
          <p className="small muted">
            Add <code>&amp;theme=dark</code>, <code>&amp;tab=memories|friends</code> or <code>&amp;flaky=1</code>.
          </p>
        </div>
      )}
    </div>
  );
}
