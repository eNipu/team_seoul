// Tiny static server for testing the build the way the backend serves it:
// /app/assets/* and other real files come from web/dist, every other /app/ path
// answers index.html, and / redirects to /app. No API here: use ?demo=1.
//
//   node scripts/serve.mjs [port]      (default 4173)

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

async function fileAt(rel) {
  const full = normalize(join(dist, rel));
  if (full !== dist && !full.startsWith(dist + sep)) return null;
  try {
    const info = await stat(full);
    return info.isFile() ? full : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }
  if (path === "/") {
    res.writeHead(302, { Location: "/app" + url.search }).end();
    return;
  }
  if (path.startsWith("/api/")) {
    // Looks like a host without the backend, which is what this server is.
    res.writeHead(404, { "Content-Type": "text/plain" }).end("No API on this static server. Use ?demo=1.");
    return;
  }
  if (path !== "/app" && !path.startsWith("/app/")) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }
  const rel = path.slice("/app".length).replace(/^\/+/, "");
  if (rel.startsWith("assets/") && !(await fileAt(rel))) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }
  const file = (rel && (await fileAt(rel))) || join(dist, "index.html");
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
    });
    res.end(body);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" }).end("Build first: npm run build");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Venn website (static build) at http://127.0.0.1:${port}/app?demo=1`);
});
