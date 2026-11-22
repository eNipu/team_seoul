import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyTheme, connectToHost, extractText, type HostBridge } from "./mcp/client";
import { DEMO_VIEWS, createMockBridge, demoParam, mockInitialView } from "./mock";
import { friendArg, parseView, type ViewData } from "./types";
import MemoryReview, { type PreviewReview } from "./components/MemoryReview";
import MemoryImport from "./components/MemoryImport";
import Dashboard, { type DashboardTab } from "./components/Dashboard";
import VennCard from "./components/VennCard";
import ThisWeek from "./components/ThisWeek";
import AskLink from "./components/AskLink";
import Answers from "./components/Answers";
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
import Help from "./components/Help";
import ReplyCard, { SavedReplies } from "./components/Reply";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { BrandMark, Icon, Illustration } from "./components/icons";
import ErrorBanner from "./components/ErrorBanner";
import { Spinner, type Nav } from "./components/common";

const publicPreview = typeof window !== "undefined" && window.location.pathname === "/widget-preview";
const inHost = typeof window !== "undefined" && window.parent !== window && !publicPreview;

function reportPreviewReview(review: PreviewReview | null) {
  if (window.parent !== window) window.parent.postMessage({ type: "venn:preview-review", review }, "*");
}

/** One entry of the in-widget view stack. `key` changes whenever the data is replaced. */
interface Entry {
  view: ViewData;
  key: number;
}

type SkeletonKind = "dashboard" | "profile" | "ticket" | "cards" | "hero" | "rows";

function skeletonFor(hint: string | null | undefined): SkeletonKind {
  switch (hint) {
    case "venn_show_dashboard":
    case "dashboard":
      return "dashboard";
    case "venn_view_friend":
    case "friend":
    case "friend_person":
    case "venn_meetup_brief":
    case "brief":
    case "brief_person":
      return "profile";
    case "venn_create_invite":
    case "invite":
    case "venn_create_question_link":
    case "ask_link":
      return "ticket";
    case "venn_compare":
    case "venn":
    case "venn_empty":
    case "venn_full":
      return "hero";
    case "dashboard_sample":
    case "dashboard_plans":
    case "dashboard_setup":
      return "dashboard";
    case "venn_onboard":
    case "welcome":
    case "venn_import_chatgpt_memory":
    case "memory_import":
      return "hero";
    case "venn_help":
    case "help":
    case "venn_reconnection_suggestions":
    case "reconnect":
    case "venn_find_people":
    case "people_search":
    case "venn_preview_people_import":
    case "people_import":
    case "venn_this_week":
    case "this_week":
    case "this_week_empty":
    case "venn_review_answers":
    case "answers":
    case "answers_empty":
      return "rows";
    default:
      return "cards";
  }
}

/** The tool call that re-fetches a view, for views whose data a child view can change. */
function refreshCall(view: ViewData): { tool: string; args: Record<string, unknown> } | null {
  switch (view.view) {
    case "dashboard":
      return { tool: "venn_show_dashboard", args: {} };
    case "reconnect":
      return { tool: "venn_reconnection_suggestions", args: {} };
    case "friend":
      return view.id ? { tool: "venn_view_friend", args: friendArg(view.kind, view.id) } : null;
    case "brief":
      return view.id ? { tool: "venn_meetup_brief", args: friendArg(view.kind, view.id) } : null;
    case "people_search":
      return view.query ? { tool: "venn_find_people", args: { query: view.query } } : null;
    case "help":
      return { tool: "venn_help", args: {} };
    case "venn":
      return { tool: "venn_compare", args: friendArg(view.kind, view.id) };
    case "this_week":
      return { tool: "venn_this_week", args: {} };
    case "answers":
      return { tool: "venn_review_answers", args: {} };
    // "ask_link" is deliberately not refreshed: creating a link again would mint a new one.
    default:
      return null;
  }
}

function demoTab(): DashboardTab | null {
  const t = demoParam("tab");
  return t === "profile" || t === "memories" || t === "friends" ? t : null;
}

export default function App() {
  const [hostContext, setHostContext] = useState<McpUiHostContext>({});
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

  useEffect(() => {
    const root = document.querySelector(".venn");
    if (!publicPreview || window.parent === window || !root) return;
    const observer = new ResizeObserver(() => {
      window.parent.postMessage({ type: "venn:preview-height", height: Math.ceil(root.getBoundingClientRect().height) }, "*");
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

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
          setError(extractText(result) || "Venn couldn't complete that request.");
          return;
        }
        const parsed = parseView(result.structuredContent, result._meta);
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
        setHostContext(ctx);
        // The bridge applies the theme. The tool name picks a skeleton shape.
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
      if (!b) return "Venn isn't connected yet.";
      const gen = generation.current;
      const res = await b.callTool(tool, args);
      if (gen !== generation.current) return null; // superseded by a host-delivered result
      if (!res.ok) return res.errorText;
      const parsed = parseView(res.data, res.meta);
      if (!parsed) return "Venn sent something this widget can't show yet.";
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
      const parsed = parseView(res.data, res.meta);
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
  const openDashboard = useCallback(
    async (tab: DashboardTab) => {
      const previous = dashboardTab.current;
      dashboardTab.current = tab;
      const message = await openView("venn_show_dashboard", {});
      if (message !== null) dashboardTab.current = previous;
      return message;
    },
    [openView],
  );
  const nav: Nav = useMemo(
    () => ({ openView, replaceView, openDashboard, back, canGoBack }),
    [openView, replaceView, openDashboard, back, canGoBack],
  );
  const onTabChange = useCallback((t: DashboardTab) => {
    dashboardTab.current = t;
  }, []);

  const showSkeleton = loading && !error;
  const top = stack.length > 0 ? stack[stack.length - 1] : null;

  const [opening, setOpening] = useState<"Help" | "Saved replies" | null>(null);
  const openHeaderView = async (label: "Help" | "Saved replies") => {
    setOpening(label);
    const message = await openView(label === "Help" ? "venn_help" : "venn_saved_replies", {});
    setOpening(null);
    if (message) setError(message);
  };
  const [changingMode, setChangingMode] = useState(false);
  const fullscreen = hostContext.displayMode === "fullscreen";
  const targetMode = fullscreen ? "inline" : "fullscreen";
  const canChangeMode = bridge?.requestDisplayMode && hostContext.availableDisplayModes?.includes(targetMode);
  const insets = fullscreen ? hostContext.safeAreaInsets : undefined;

  async function changeMode() {
    if (!bridge?.requestDisplayMode) return;
    setChangingMode(true);
    const mode = await bridge.requestDisplayMode(targetMode);
    setChangingMode(false);
    if (mode) setHostContext((current) => ({ ...current, displayMode: mode }));
    if (mode !== targetMode) setError("ChatGPT couldn't change how Venn is displayed.");
  }

  return (
    <div className={`venn${top?.view.view === "memory_review" ? " venn--review" : ""}`} style={insets && {
      paddingTop: `calc(var(--s-3) + ${insets.top}px)`,
      paddingRight: `calc(var(--s-3) + ${insets.right}px)`,
      paddingBottom: `calc(var(--s-3) + ${insets.bottom}px)`,
      paddingLeft: `calc(var(--s-3) + ${insets.left}px)`,
    }}>
      <header className="venn__header">
        {canGoBack && !showSkeleton && (
          <button type="button" className="icon-btn back" onClick={back} aria-label="Back" title="Back">
            <Icon name="arrow-left" />
          </button>
        )}
        <div className="venn__brand">
          <BrandMark size={23} />
          <span>Venn</span>
          <span className="venn__pen"><Icon name="pen" size={17} /></span>
        </div>
        <span className="venn__spacer" />
        {(refreshing || opening) && <Spinner label={opening ? `Opening ${opening.toLowerCase()}` : "Refreshing"} />}
        {bridge?.isMock && <span className="badge badge--demo">Demo</span>}
        {bridge && !showSkeleton && top?.view.view !== "saved_replies" && (
          <button type="button" className="icon-btn" disabled={opening !== null}
            onClick={() => void openHeaderView("Saved replies")} aria-label="Saved replies" title="Saved replies">
            <Icon name="bookmark" />
          </button>
        )}
        {canChangeMode && (
          <button type="button" className="icon-btn" disabled={changingMode} onClick={() => void changeMode()}
            aria-label={fullscreen ? "Return Venn to chat" : "Open Venn fullscreen"}
            title={fullscreen ? "Return Venn to chat" : "Open Venn fullscreen"}>
            <Icon name={fullscreen ? "collapse" : "expand"} />
          </button>
        )}
        {bridge && !showSkeleton && top?.view.view !== "help" && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => void openHeaderView("Help")}
            disabled={opening !== null}
            aria-label="Help"
            title="Help"
          >
            <Icon name="help" />
          </button>
        )}
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
    case "reply":
      return <ReplyCard key={key} data={view} bridge={bridge} nav={nav} />;
    case "saved_replies":
      return <SavedReplies key={key} data={view} bridge={bridge} nav={nav} />;
    case "memory_review":
      return <MemoryReview key={key} data={view} bridge={bridge} nav={nav}
        onPreviewReview={publicPreview && bridge.isMock ? reportPreviewReview : undefined} />;
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
    case "help":
      return <Help key={key} data={view} bridge={bridge} nav={nav} />;
    case "venn":
      return <VennCard key={key} data={view} bridge={bridge} nav={nav} />;
    case "this_week":
      return <ThisWeek key={key} data={view} bridge={bridge} nav={nav} />;
    case "ask_link":
      return <AskLink key={key} data={view} bridge={bridge} nav={nav} />;
    case "answers":
      return <Answers key={key} data={view} bridge={bridge} nav={nav} />;
  }
}

function Skeleton({ kind }: { kind: SkeletonKind }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {kind === "dashboard" && (
        <>
          <div className="skeleton__row skeleton__row--tabs">
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
          <div className="skeleton__row skeleton__row--tiles">
            <div className="skeleton__block skeleton__block--tile" />
            <div className="skeleton__block skeleton__block--tile" />
            <div className="skeleton__block skeleton__block--tile" />
          </div>
          <div className="skeleton__line" />
          <div className="skeleton__line skeleton__line--short" />
        </>
      )}
      {kind === "hero" && (
        <>
          <div className="skeleton__block skeleton__block--hero" />
          <div className="skeleton__line skeleton__line--title skeleton__line--center" />
          <div className="skeleton__line skeleton__line--short skeleton__line--center" />
          <div className="skeleton__block" />
          <div className="skeleton__pill skeleton__pill--block" />
        </>
      )}
      {kind === "rows" && (
        <>
          <div className="skeleton__line skeleton__line--title" />
          <div className="skeleton__line skeleton__line--short" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton__row">
              <div className="skeleton__circle" />
              <div className="skeleton__stack">
                <div className="skeleton__line skeleton__line--title" />
                <div className="skeleton__line" />
              </div>
            </div>
          ))}
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
      <Illustration name="chat" />
      <p className="empty__title">Hi, I'm Venn.</p>
      <p className="muted">Ask Venn to get to know you, remember something, or show your dashboard</p>
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
