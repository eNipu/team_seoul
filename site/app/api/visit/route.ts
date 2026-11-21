import { cleanAttribution, isBot, track, visitorId } from "@/lib/analytics";
import { type Limit, overLimit } from "@/lib/rate-limit";
import { cleanVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

const VISIT_LIMIT: Limit = { name: "visit", max: 30, windowMs: 60_000 };

// Records one page view. Always answers 204: a visitor should never see an
// analytics failure, and the page does not read the response.
export async function POST(request: Request): Promise<Response> {
  if (!isBot(request.headers) && !overLimit(VISIT_LIMIT, request.headers)) {
    try {
      const body: unknown = await request.json().catch(() => null);
      const version = cleanVersion((body as { version?: unknown } | null)?.version);
      await track("page_view", visitorId(request.headers), cleanAttribution(body), version);
    } catch (error) {
      console.error("visit: could not record page_view", error);
    }
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
