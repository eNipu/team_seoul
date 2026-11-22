// The app shell: session gate (sign-in is part of this app), navigation, routing.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEMO, api, setUnauthenticatedHandler } from "./api";
import { errorMessage } from "./errors";
import { BrandMark, Icon, type IconName } from "./icons";
import { Link, href, navigate, useLocation, type Location } from "./router";
import { SessionContext, useSession, type SessionValue } from "./session";
import { LIMITS, type Session } from "./types";
import { Avatar, EmptyState, Skeleton, ToastProvider, useToast } from "./ui";
import SignIn, { NotConnected, SignInUnavailable } from "./pages/SignIn";
import Home from "./pages/Home";
import Overlap from "./pages/Overlap";
import People from "./pages/People";
import PersonPage from "./pages/Person";
import Memories from "./pages/Memories";
import Search from "./pages/Search";
import FollowUps from "./pages/FollowUps";
import Plans from "./pages/Plans";
import Answers from "./pages/Answers";
import Account from "./pages/Account";
import ConnectChatGpt, { PublicConnectChatGpt } from "./pages/ConnectChatGpt";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/people", label: "People", icon: "users" },
  { to: "/memories", label: "Memories", icon: "bookmark" },
  { to: "/follow-ups", label: "Follow-ups", icon: "flag" },
  { to: "/plans", label: "Plans", icon: "calendar" },
];

const SECONDARY_NAV: NavItem[] = [
  { to: "/answers", label: "Answers", icon: "chat" },
  { to: "/connect", label: "Connect ChatGPT", icon: "sparkle" },
  { to: "/account", label: "Account", icon: "user" },
];

function isCurrent(path: string, to: string): boolean {
  return to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);
}

interface Route {
  title: string;
  element: ReactNode;
}

function matchRoute(loc: Location): Route {
  const { path } = loc;
  if (path === "/") return { title: "Home", element: <Home /> };
  if (path === "/overlap") return { title: "Venn Overlap", element: <Overlap /> };
  if (path === "/people") return { title: "People", element: <People /> };
  const person = /^\/people\/(connection|person)\/([^/]+)$/.exec(path);
  if (person) {
    const kind = person[1] === "connection" ? "connection" : "person";
    const id = decodeURIComponent(person[2]);
    return { title: "Person", element: <PersonPage key={`${kind}:${id}`} kind={kind} id={id} /> };
  }
  if (path === "/memories") return { title: "Memories", element: <Memories /> };
  if (path === "/search") return { title: "Search", element: <Search /> };
  if (path === "/follow-ups") return { title: "Follow-ups", element: <FollowUps /> };
  if (path === "/plans") return { title: "Plans", element: <Plans /> };
  if (path === "/answers") return { title: "Answers", element: <Answers /> };
  if (path === "/connect") return { title: "Connect ChatGPT", element: <ConnectChatGpt /> };
  if (path === "/account") return { title: "Account", element: <Account /> };
  return { title: "Page not found", element: <NotFound /> };
}

function NotFound() {
  return (
    <div className="page">
      <EmptyState
        illustration="search"
        title="This page doesn't exist"
        actions={
          <>
            <Link to="/" className="btn btn--primary">
              Go to Home
            </Link>
            <Link to="/people" className="btn">
              See your people
            </Link>
          </>
        }
      >
        <p>The link may be old, or the address was mistyped.</p>
      </EmptyState>
    </div>
  );
}

/* --------------------------------------------------------- global search */

function GlobalSearch() {
  const loc = useLocation();
  const urlQuery = loc.path === "/search" ? (loc.query.get("q") ?? "") : "";
  const [value, setValue] = useState(urlQuery);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setValue(urlQuery), [urlQuery, loc.key]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable))
        return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        navigate("/search", q ? { q } : {});
      }}
    >
      <Icon name="search" size={18} />
      <input
        ref={ref}
        type="search"
        className="search__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Who do I know who…"
        aria-label="Search your circle: who do I know who…"
        maxLength={LIMITS.searchQuery}
        enterKeyHint="search"
      />
      <kbd className="search__kbd" aria-hidden="true">
        /
      </kbd>
    </form>
  );
}

/* ----------------------------------------------------------- account menu */

function AccountMenu() {
  const { displayName, session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.key]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        wrap.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="account" ref={wrap}>
      <button
        type="button"
        className="account__btn"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Account menu for ${displayName}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={displayName} size="small" />
        <span className="account__name">{displayName}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <div className="menu">
          <div className="menu__who">
            <strong>{displayName}</strong>
            {session.username && (
              <span>{session.username.includes("@") ? session.username : `@${session.username}`}</span>
            )}
          </div>
          <Link to="/account" className="menu__item">
            <Icon name="user" size={18} />
            Account
          </Link>
          <Link to="/answers" className="menu__item">
            <Icon name="chat" size={18} />
            Answers from friends
          </Link>
          <Link to="/connect" className="menu__item">
            <Icon name="sparkle" size={18} />
            Connect ChatGPT
          </Link>
          <button
            type="button"
            className="menu__item"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await signOut();
              } catch (e) {
                toast(errorMessage(e), "error");
                setBusy(false);
              }
            }}
          >
            <Icon name="log-out" size={18} />
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ shell */

function Shell() {
  const loc = useLocation();
  const route = useMemo(() => matchRoute(loc), [loc]);
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    document.title = `${route.title} · Venn`;
  }, [route.title]);

  // Move focus to the page on navigation so keyboard and screen-reader users land in the new content.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [loc.path]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="Venn, home">
          <BrandMark size={32} />
          <span className="brand__name">Venn</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="nav__item"
              aria-current={isCurrent(loc.path, item.to) ? "page" : undefined}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </Link>
          ))}
        </nav>
        <nav className="nav nav--secondary" aria-label="More">
          {SECONDARY_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={item.to === "/connect" ? "nav__item nav__item--connect" : "nav__item"}
              aria-current={isCurrent(loc.path, item.to) ? "page" : undefined}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <p className="sidebar__foot">
          <Icon name="lock" size={14} />
          Private by default. Venn never sends anything for you.
        </p>
      </aside>
      <div className="shell__main">
        <header className="topbar">
          <Link to="/" className="topbar__brand" aria-label="Venn, home">
            <BrandMark size={32} />
          </Link>
          <GlobalSearch />
          {DEMO && (
            <span className="demo-pill" title="Demo mode: sample data in this browser tab, nothing is saved.">
              Demo
            </span>
          )}
          <AccountMenu />
        </header>
        <main className="main" id="main" tabIndex={-1} ref={mainRef}>
          {route.element}
        </main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="tabbar__item"
            aria-current={isCurrent(loc.path, item.to) ? "page" : undefined}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/* ----------------------------------------------------------- session gate */

type Gate = { state: "loading" } | { state: "offline"; message: string } | { state: "ready"; session: Session };

function SessionGate() {
  const loc = useLocation();
  const [gate, setGate] = useState<Gate>({ state: "loading" });
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(() => {
    setGate({ state: "loading" });
    api.getSession().then(
      (session) => {
        setDisplayName(session.display_name ?? "");
        setGate({ state: "ready", session });
      },
      (e) => setGate({ state: "offline", message: errorMessage(e) }),
    );
  }, []);

  useEffect(load, [load]);

  const dropSession = useCallback(() => {
    setGate((g) => (g.state === "ready" ? { state: "ready", session: { ...g.session, signed_in: false } } : g));
  }, []);

  // Any API call answering 401 brings the sign-in screen back; the URL stays, so signing in continues there.
  useEffect(() => {
    setUnauthenticatedHandler(dropSession);
    return () => setUnauthenticatedHandler(null);
  }, [dropSession]);

  const value = useMemo<SessionValue | null>(() => {
    if (gate.state !== "ready") return null;
    return {
      session: gate.session,
      displayName: displayName || gate.session.username || "You",
      setDisplayName,
      signOut: async () => {
        await api.signOut();
        navigate("/", {}, { replace: true });
        dropSession();
      },
      signedOut: () => {
        navigate("/", {}, { replace: true });
        dropSession();
      },
    };
  }, [gate, displayName, dropSession]);

  if (gate.state === "loading") {
    return (
      <div className="gate" aria-busy="true">
        <BrandMark size={48} />
        <Skeleton rows={2} />
      </div>
    );
  }
  if (gate.state === "offline") return <NotConnected onRetry={load} demoHref={`${href("/")}${DEMO ? "" : "?demo=1"}`} />;
  const { session } = gate;
  if (!session.signed_in) {
    if (loc.path === "/connect") {
      return <PublicConnectChatGpt googleSsoAvailable={session.google_sso_available} />;
    }
    if (!session.sign_in_available) return <SignInUnavailable />;
    return (
      <SignIn
        googleSsoAvailable={session.google_sso_available}
        devSignInAvailable={session.dev_sign_in_available}
        passcodeRequired={session.passcode_required}
        onSignedIn={(result) => {
          setDisplayName(result.display_name);
          setGate({
            state: "ready",
            session: { ...session, signed_in: true, display_name: result.display_name, username: result.username },
          });
        }}
      />
    );
  }
  return (
    <SessionContext.Provider value={value}>
      <Shell key={session.username ?? "account"} />
    </SessionContext.Provider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <SessionGate />
    </ToastProvider>
  );
}
