import { type NextRequest, NextResponse } from "next/server";

// /metrics is behind HTTP Basic auth: any user name, and the password in
// METRICS_PASSWORD. In production it stays closed until that variable is set,
// so a forgotten setting can never publish the numbers.

export const config = { matcher: "/metrics/:path*" };

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

function passwordFrom(request: NextRequest): string | null {
  const [scheme, encoded] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded) return null;
  try {
    const decoded = atob(encoded);
    const colon = decoded.indexOf(":");
    return colon === -1 ? null : decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.METRICS_PASSWORD;
  if (!expected) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Metrics are locked. Set METRICS_PASSWORD on the server to open them.", {
      status: 503,
      headers: HEADERS,
    });
  }

  const given = passwordFrom(request);
  // Comparing digests keeps the comparison time independent of where the strings differ.
  if (given !== null && (await digest(given)) === (await digest(expected))) return NextResponse.next();

  return new NextResponse("Password required.", {
    status: 401,
    headers: { ...HEADERS, "WWW-Authenticate": 'Basic realm="Venn metrics", charset="UTF-8"' },
  });
}
