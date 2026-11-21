// A small fixed-window rate limit, kept in this server process.
//
// It is enough for one instance, which is how the site runs on Railway. With several
// instances each would count on its own, and a restart forgets the counts.

type Window = { count: number; resetAt: number };

const globals = globalThis as typeof globalThis & { __vennLimits?: Map<string, Window> };
const windows = (globals.__vennLimits ??= new Map());

const MAX_KEYS = 20_000;

/** The caller's address. Railway's edge sets X-Real-IP; X-Forwarded-For is the fallback. */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip")?.trim() || (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export type Limit = { name: string; max: number; windowMs: number };

/** Counts one request. Returns 0 if it is allowed, or the seconds to wait if it is not. */
export function overLimit(limit: Limit, headers: Headers): number {
  const now = Date.now();
  const key = `${limit.name}|${clientIp(headers)}`;
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      if (windows.size >= MAX_KEYS) windows.clear();
    }
    windows.set(key, { count: 1, resetAt: now + limit.windowMs });
    return 0;
  }
  current.count += 1;
  return current.count > limit.max ? Math.max(1, Math.ceil((current.resetAt - now) / 1000)) : 0;
}
