// A small History-API router. The build is served under /app (vite `base`),
// and the backend returns index.html for every unknown path below it.

import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, ""); // "/app"

/** Flags that survive in-app navigation (demo mode and its variants). */
const STICKY = ["demo", "fresh", "passcode", "seat"];

export type Query = Record<string, string | undefined>;

export interface Location {
  /** Path inside the app: "/", "/people", "/people/person/abc". */
  path: string;
  query: URLSearchParams;
  /** Changes on every navigation. */
  key: string;
}

function read(): Location {
  let path = window.location.pathname;
  if (path === BASE || path.startsWith(`${BASE}/`)) path = path.slice(BASE.length);
  path = path.replace(/\/+$/, "") || "/";
  return { path, query: new URLSearchParams(window.location.search), key: window.location.pathname + window.location.search };
}

let current = read();
const listeners = new Set<() => void>();

function emit(): void {
  current = read();
  listeners.forEach((l) => l());
}

window.addEventListener("popstate", emit);

/** Full URL (with /app and the sticky flags) for a path inside the app. */
export function href(path: string, query: Query = {}): string {
  const p = new URLSearchParams();
  const now = new URLSearchParams(window.location.search);
  for (const k of STICKY) {
    const v = now.get(k);
    if (v !== null) p.set(k, v);
  }
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") p.set(k, v);
  const s = p.toString();
  return `${BASE}${path === "/" ? "" : path}${s ? `?${s}` : ""}` || "/";
}

export function navigate(path: string, query: Query = {}, options: { replace?: boolean } = {}): void {
  const url = href(path, query);
  if (options.replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  emit();
  window.scrollTo(0, 0);
}

export function useLocation(): Location {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  query?: Query;
}

/** A real <a href> (open in new tab, copy link) that navigates in place on a plain click. */
export function Link({ to, query, onClick, children, ...rest }: LinkProps) {
  const url = href(to, query);
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to, query);
  };
  return (
    <a href={url} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
