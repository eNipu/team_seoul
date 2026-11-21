import { cleanAttribution, cleanRef, track, visitorId } from "@/lib/analytics";
import { hasDatabase } from "@/lib/db";
import { type Limit, overLimit } from "@/lib/rate-limit";
import { joinWaitlist, normalizeEmail, spotForCode } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

const NOT_OPEN = "The waitlist isn't open yet. Please try again soon.";

// Per address. Generous enough for an office or a mobile carrier sharing one address.
const JOIN_LIMIT: Limit = { name: "join", max: 10, windowMs: 10 * 60_000 };
const LOOKUP_LIMIT: Limit = { name: "lookup", max: 30, windowMs: 60_000 };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function tooMany(seconds: number): Response {
  return json({ error: "Too many tries from this network. Please wait a few minutes and try again." }, 429, {
    "Retry-After": String(seconds),
  });
}

export async function POST(request: Request): Promise<Response> {
  const wait = overLimit(JOIN_LIMIT, request.headers);
  if (wait) return tooMany(wait);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send the email address as JSON." }, 400);
  }

  const email = normalizeEmail((body as { email?: unknown } | null)?.email);
  if (!email) return json({ error: "Enter a valid email address." }, 400);

  if (!hasDatabase()) {
    console.error("waitlist: DATABASE_URL is not set, signup refused");
    return json({ error: NOT_OPEN }, 503);
  }

  const attribution = cleanAttribution(body);
  try {
    const { spot, created } = await joinWaitlist(email, attribution);
    if (created) {
      // The signup is saved; losing the analytics event must not fail the request.
      await track("core_action_completed", visitorId(request.headers), attribution).catch((error) =>
        console.error("waitlist: could not record core_action_completed", error),
      );
    }
    return json(spot);
  } catch (error) {
    console.error("waitlist: signup failed", error);
    return json({ error: "Something went wrong on our side. Please try again." }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  const wait = overLimit(LOOKUP_LIMIT, request.headers);
  if (wait) return tooMany(wait);

  const code = cleanRef(new URL(request.url).searchParams.get("code"));
  if (!code) return json({ error: "Unknown invite code." }, 404);
  if (!hasDatabase()) return json({ error: NOT_OPEN }, 503);
  try {
    const spot = await spotForCode(code);
    return spot ? json(spot) : json({ error: "Unknown invite code." }, 404);
  } catch (error) {
    console.error("waitlist: lookup failed", error);
    return json({ error: "Something went wrong on our side. Please try again." }, 500);
  }
}
