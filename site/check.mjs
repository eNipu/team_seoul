// Browser checks for the Heldly site. No dependencies: Node 22+ and a local Chrome.
//
//   node site/check.mjs                 run the checks
//   node site/check.mjs --shots <dir>   also write full-page screenshots
//   node site/check.mjs --url <url>     check a deployed copy instead of site/public
//
// Covers: headings, horizontal overflow, text contrast, control sizes, console
// errors, third-party requests, cookies, the interest example, and the 3D scene
// (it must draw, and must hold still when reduced motion is requested).

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "public");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const shotsDir = arg("--shots") && resolve(arg("--shots"));
const remoteUrl = arg("--url");

const VIEWPORTS = [
  { name: "phone", width: 360, height: 780 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];
const SCHEMES = ["light", "dark"];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = join(root, path.endsWith("/") ? path + "index.html" : path);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

function findChrome() {
  const candidates = [
    process.env.CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error("Chrome not found. Set CHROME to the browser binary.");
  return found;
}

function launch() {
  const profile = mkdtempSync(join(tmpdir(), "heldly-check-"));
  const child = spawn(findChrome(), [
    "--headless=new",
    "--remote-debugging-port=0",
    "--no-first-run",
    "--disable-gpu",
    "--hide-scrollbars",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    `--user-data-dir=${profile}`,
    "about:blank",
  ]);
  const ready = new Promise((done, fail) => {
    let buffer = "";
    child.stderr.on("data", (chunk) => {
      buffer += chunk;
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) done(match[1]);
    });
    child.on("exit", () => fail(new Error("Chrome exited before it was ready")));
    setTimeout(() => fail(new Error("Chrome did not start within 20s")), 20_000);
  });
  const close = () => {
    child.kill();
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  return { ready, close };
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((done, fail) => {
    ws.onopen = done;
    ws.onerror = () => fail(new Error("Could not connect to Chrome"));
  });
  let next = 0;
  const pending = new Map();
  const handlers = new Set();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { done, fail } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) fail(new Error(message.error.message));
      else done(message.result);
    } else {
      for (const handler of handlers) handler(message);
    }
  };
  return {
    send(method, params = {}, sessionId) {
      const id = ++next;
      ws.send(JSON.stringify({ id, method, params, sessionId }));
      return new Promise((done, fail) => pending.set(id, { done, fail }));
    },
    on(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close: () => ws.close(),
  };
}

// Runs in the page. Returns a list of human-readable problems.
function audit() {
  const problems = [];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const rgba = (color) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  };
  const luminance = ({ r, g, b }) => {
    const [x, y, z] = [r, g, b].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * x + 0.7152 * y + 0.0722 * z;
  };
  const describe = (el) => {
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `<${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}> "${text}"`;
  };
  const visible = (el) => {
    if (el.closest("[hidden]")) return false;
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  };

  // Headings
  const h1s = document.querySelectorAll("h1");
  if (h1s.length !== 1) problems.push(`expected one h1, found ${h1s.length}`);
  for (const h of document.querySelectorAll("h1, h2, h3")) {
    if (visible(h) && !h.textContent.trim()) problems.push(`empty heading ${describe(h)}`);
  }
  if (h1s[0] && parseFloat(getComputedStyle(h1s[0]).fontSize) < 32) problems.push("h1 is smaller than 32px");

  // Horizontal overflow
  const overflow = document.documentElement.scrollWidth - window.innerWidth;
  if (overflow > 0) problems.push(`page is ${overflow}px wider than the viewport`);
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || el.closest("svg, .skip, .stage__washes")) continue; // washes are clipped decoration
    const box = el.getBoundingClientRect();
    if (box.right > window.innerWidth + 0.5 || box.left < -0.5) problems.push(`sticks out sideways: ${describe(el)}`);
  }

  // Text contrast (WCAG AA: 4.5, or 3 for large text)
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    if (!walker.currentNode.nodeValue.trim() || seen.has(el)) continue;
    seen.add(el);
    if (!visible(el) || el.closest("option, noscript, script, :disabled")) continue;
    const style = getComputedStyle(el);
    let bg = null;
    for (let node = el; node && !bg; node = node.parentElement) {
      const color = rgba(getComputedStyle(node).backgroundColor);
      if (color.a > 0.99) bg = color;
    }
    bg = bg || rgba(getComputedStyle(document.documentElement).backgroundColor);
    const fg = rgba(style.color);
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(style.fontWeight, 10) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) problems.push(`contrast ${ratio.toFixed(2)} below ${need}: ${describe(el)}`);
    if (size < 13) problems.push(`text smaller than 13px (${size}px): ${describe(el)}`);
  }

  // Control sizes: 44px, matching the widget
  for (const el of document.querySelectorAll("a[href], button, select, label.chip")) {
    if (!visible(el) || el.closest(".skip")) continue;
    const box = el.getBoundingClientRect();
    if (box.height < 43.5 || box.width < 43.5) {
      problems.push(`control ${Math.round(box.width)}x${Math.round(box.height)} is under 44px: ${describe(el)}`);
    }
  }

  if (document.cookie) problems.push("page set a cookie");
  return problems;
}

// Runs in the page. Exercises the "inside ChatGPT" example.
function exerciseDemo() {
  const problems = [];
  const expect = (ok, message) => ok || problems.push(`interest example: ${message}`);
  const radios = [...document.querySelectorAll('[data-clusters] input[type="radio"]')];
  const names = () => [...document.querySelectorAll("[data-cluster-panel] .person__name")].map((n) => n.textContent);
  const rows = () => [...document.querySelectorAll("[data-cluster-panel] .person")];

  expect(radios.length === 5 && radios.every((r) => !r.disabled), "five enabled interests");
  expect(radios[0].checked, "Climbing is selected at start");
  expect(names().join() === "Mina Park,Jun Ito", `Climbing lists "${names().join()}"`);

  radios[1].click();
  expect(names().join() === "Mina Park,Lea Novak", `Design lists "${names().join()}"`);
  for (const row of rows()) {
    const labels = [...row.querySelectorAll(".person__label")].map((l) => l.textContent).join();
    expect(labels === "Keep it alive,How it could help", `row labels were "${labels}"`);
    expect([...row.querySelectorAll(".person__row span:last-child")].every((t) => t.textContent.length > 20), "each row has a suggestion");
  }

  radios[4].click();
  expect(names().join() === "Sam Okafor,Jun Ito", `Retail lists "${names().join()}"`);
  radios[0].click();
  expect(names().join() === "Mina Park,Jun Ito", "returning to Climbing restores the first list");
  return problems;
}

// Runs in the page. Waits for the 3D scene to settle and reports its state.
function sceneState() {
  return new Promise((done) => {
    const host = document.querySelector("[data-scene]");
    const started = performance.now();
    const poll = () => {
      const state = host?.dataset.state;
      const ready = state === "flat" || (state && Number(host.dataset.frames) > 0 && Number(host.dataset.lit) > 0);
      if (ready || performance.now() - started > 8000) {
        done({
          state: state ?? "missing",
          frames: Number(host?.dataset.frames ?? 0),
          lit: Number(host?.dataset.lit ?? 0),
          reason: host?.dataset.reason ?? "",
          canvas: !!host?.querySelector("canvas"),
          labels: [...document.querySelectorAll(".tag--cluster")].map((t) => t.textContent).join(","),
        });
      } else setTimeout(poll, 100);
    };
    poll();
  });
}

async function main() {
  const server = remoteUrl ? null : await serve();
  const base = remoteUrl ?? `http://127.0.0.1:${server.address().port}/`;
  const origin = new URL(base).origin;
  const chrome = launch();
  const failures = [];

  try {
    const cdp = await connect(await chrome.ready);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    const run = async (fn) => {
      const { result, exceptionDetails } = await send("Runtime.evaluate", {
        expression: `(${fn})()`,
        returnByValue: true,
        awaitPromise: true,
      });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };

    let label = "";
    cdp.on((message) => {
      if (message.sessionId !== sessionId) return;
      const p = message.params;
      if (message.method === "Network.requestWillBeSent" && !p.request.url.startsWith("data:")) {
        if (new URL(p.request.url).origin !== origin) failures.push(`${label}: request to another site: ${p.request.url}`);
      }
      if (message.method === "Runtime.exceptionThrown") failures.push(`${label}: script error: ${p.exceptionDetails.text}`);
      if (message.method === "Log.entryAdded" && p.entry.level === "error") {
        failures.push(`${label}: console error: ${p.entry.text} ${p.entry.url ?? ""}`);
      }
    });
    for (const domain of ["Page", "Runtime", "Network", "Log"]) await send(`${domain}.enable`);

    const runs = VIEWPORTS.flatMap((viewport) => SCHEMES.map((scheme) => ({ viewport, scheme, motion: "no-preference" })));
    runs.push({ viewport: VIEWPORTS[2], scheme: "light", motion: "reduce" });

    for (const { viewport, scheme, motion } of runs) {
      {
        label = `${viewport.name}/${scheme}${motion === "reduce" ? "/reduced-motion" : ""}`;
        await send("Emulation.setDeviceMetricsOverride", {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: shotsDir ? 2 : 1,
          mobile: viewport.width < 600,
        });
        await send("Emulation.setEmulatedMedia", {
          features: [
            { name: "prefers-color-scheme", value: scheme },
            { name: "prefers-reduced-motion", value: motion },
          ],
        });
        const loaded = new Promise((done) => {
          const off = cdp.on((m) => {
            if (m.sessionId === sessionId && m.method === "Page.loadEventFired") {
              off();
              done();
            }
          });
        });
        await send("Page.navigate", { url: base });
        await loaded;

        const scene = await run(sceneState);
        const wanted = motion === "reduce" ? "static" : "running";
        if (scene.state !== wanted) {
          failures.push(`${label}: scene state is "${scene.state}" ${scene.reason}, expected "${wanted}"`);
        } else if (scene.lit < 50) {
          failures.push(`${label}: scene drew almost nothing (${scene.lit} lit samples)`);
        } else if (scene.labels !== "Climbing,Design,Berlin,AI tools,Retail") {
          failures.push(`${label}: cluster labels were "${scene.labels}"`);
        }
        if (motion === "reduce") {
          const before = scene.frames;
          await new Promise((r) => setTimeout(r, 1200));
          const after = (await run(sceneState)).frames;
          if (after !== before) failures.push(`${label}: scene kept animating with reduced motion (${before} -> ${after} frames)`);
        }

        for (const problem of await run(audit)) failures.push(`${label}: ${problem}`);
        if (scheme === "light" && motion !== "reduce") {
          for (const problem of await run(exerciseDemo)) failures.push(`${label}: ${problem}`);
        }

        if (shotsDir) {
          // Let the dots finish gathering so the picture shows the settled scene.
          if (motion !== "reduce") {
            await run(`() => new Promise((done) => {
              const t0 = performance.now();
              const wait = () => document.querySelector(".stage--ready") || performance.now() - t0 > 7000 ? setTimeout(done, 1800) : setTimeout(wait, 100);
              wait();
            })`);
          }
          mkdirSync(shotsDir, { recursive: true });
          const { cssContentSize } = await send("Page.getLayoutMetrics");
          const { data } = await send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
          });
          writeFileSync(join(shotsDir, `${label.replaceAll("/", "-")}.png`), Buffer.from(data, "base64"));
        }
        console.log(`checked ${label} (scene: ${scene.state}, ${scene.lit} lit samples)`);
      }
    }

    const { cookies } = await send("Network.getCookies", { urls: [base] });
    if (cookies.length) failures.push(`cookies were set: ${cookies.map((c) => c.name).join(", ")}`);
    cdp.close();
  } finally {
    chrome.close();
    server?.close();
  }

  if (failures.length) {
    console.error(`\n${failures.length} problem(s):`);
    for (const failure of [...new Set(failures)]) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
