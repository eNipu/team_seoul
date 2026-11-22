// The app shell: session gate (sign-in is part of this app), navigation, routing.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEMO, api, setUnauthenticatedHandler } from "./api";
import { errorMessage } from "./errors";
import { BrandMark, type IconName } from "./icons";
import { Link, href, navigate, useLocation, type Location } from "./router";
import { SessionContext, useSession, type SessionValue } from "./session";
import type { Session } from "./types";
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

// Three places, nothing more. Account and sign out live in the avatar menu. Follow-ups, plans and
// answers still open by URL; nothing links to follow-ups or plans.
const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/people", label: "Circle", icon: "users" },
  { to: "/memories", label: "Memories", icon: "bookmark" },
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
  if (path === "/people") return { title: "Circle", element: <People /> };
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
          <Link to="/" className="btn btn--primary">
            Go home
          </Link>
        }
      />
    </div>
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
            Account
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
      <header className="topbar">
        <Link to="/" className="topbar__brand" aria-label="Venn, home">
          <BrandMark size={32} />
        </Link>
        <nav className="nav" aria-label="Main">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="nav__item"
              aria-current={isCurrent(loc.path, item.to) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
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
