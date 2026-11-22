// Browser checks for the Venn site. No dependencies beyond the site's own: Node 22+ and a local Chrome.
//
//   npm run build && node check.mjs     start the built site on a free port and check it
//   node check.mjs --shots <dir>        also write screenshots
//   node check.mjs --url <url>          check a running or deployed copy instead
//
// Covers: headings, horizontal overflow, the hero fitting in one screen, text contrast,
// control sizes, console errors, third-party requests, cookies, the CSS-only hero,
// the four-step onboarding preview, the /metrics password, /metrics itself, and the waitlist
// with its rate limit: both versions, what an invited person sees, a full link, and
// joining with the keyboard alone.
//
// The waitlist is only submitted against a local server started with DATABASE_URL.
// With --url it is left alone, so checking production never adds a signup.
// /metrics is opened with METRICS_PASSWORD; with --url and no password it is skipped.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};
const shotsDir = arg("--shots") && resolve(arg("--shots"));
const remoteUrl = arg("--url");
// The local server gets a password of its own if the environment has none.
const metricsPassword = process.env.METRICS_PASSWORD || (remoteUrl ? "" : "check-only-password");

const VIEWPORTS = [
  { name: "phone-small", width: 360, height: 640 },
  { name: "phone", width: 390, height: 780 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

// Starts `next start` on the build in .next and waits until it answers.
async function startSite() {
  if (!existsSync(join(here, ".next", "BUILD_ID"))) {
    throw new Error("No build found. Run `npm run build` first, or pass --url.");
  }
  const port = await freePort();
  const child = spawn(process.execPath, [join(here, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], {
    cwd: here,
    env: { ...process.env, METRICS_PASSWORD: metricsPassword },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (chunk) => (log += chunk));
  child.stderr.on("data", (chunk) => (log += chunk));
  const base = `http://127.0.0.1:${port}/`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`next start exited:\n${log}`);
    try {
      if ((await fetch(base)).ok) return { base, close: () => child.kill() };
    } catch {
      // not listening yet
    }
    await sleep(200);
  }
  child.kill();
  throw new Error(`next start did not answer within 20s:\n${log}`);
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
  const profile = mkdtempSync(join(tmpdir(), "venn-check-"));
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
    if (!h.textContent.trim()) problems.push(`empty heading ${describe(h)}`);
  }

  // Horizontal overflow
  const overflow = document.documentElement.scrollWidth - window.innerWidth;
  if (overflow > 0) problems.push(`page is ${overflow}px wider than the viewport`);
  for (const el of document.querySelectorAll("body *")) {
    // The backdrop is clipped decoration; a wide table scrolls inside its own box.
    if (!visible(el) || el.closest("svg, .sr-only, .hero__backdrop, .metrics__scroll")) continue;
    const box = el.getBoundingClientRect();
    if (box.right > window.innerWidth + 0.5 || box.left < -0.5) problems.push(`sticks out sideways: ${describe(el)}`);
  }

  // Text contrast (WCAG AA: 4.5, or 3 for large text) and a 12px floor
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    if (!walker.currentNode.nodeValue.trim() || seen.has(el)) continue;
    seen.add(el);
    if (!visible(el) || el.closest("option, noscript, script, style, :disabled, .sr-only")) continue;
    const style = getComputedStyle(el);
    let bg = null;
    for (let node = el; node && !bg; node = node.parentElement) {
      const color = rgba(getComputedStyle(node).backgroundColor);
      if (color.a > 0.99) bg = color;
    }
    bg = bg || rgba(getComputedStyle(document.documentElement).backgroundColor);
    if (bg.a < 0.99) bg = { r: 255, g: 255, b: 255, a: 1 };
    const fg = rgba(style.color);
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(style.fontWeight, 10) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) problems.push(`contrast ${ratio.toFixed(2)} below ${need}: ${describe(el)}`);
    if (size < 12) problems.push(`text smaller than 12px (${size}px): ${describe(el)}`);
  }

  // Control sizes: 44px, matching the widget
  for (const el of document.querySelectorAll("a[href], button, input[type=email], select, label.pick")) {
    if (!visible(el)) continue;
    const box = el.getBoundingClientRect();
    if (box.height < 43.5 || box.width < 43.5) {
      problems.push(`control ${Math.round(box.width)}x${Math.round(box.height)} is under 44px: ${describe(el)}`);
    }
  }

  if (document.cookie) problems.push("page set a cookie");
  return problems;
}

// Runs in the page. The hero, header included, must fit in the first screen.
function auditFold() {
  const problems = [];
  const fold = window.innerHeight + 0.5;
  const hero = document.querySelector(".hero");
  if (!hero) return ["no .hero section"];
  if (hero.getBoundingClientRect().bottom > fold) {
    problems.push(`hero is ${Math.round(hero.getBoundingClientRect().height)}px tall, taller than the ${window.innerHeight}px screen`);
  }
  for (const selector of [".site-header", "h1", ".hero__sub", ".waitlist"]) {
    const el = hero.querySelector(selector);
    if (!el) problems.push(`hero has no ${selector}`);
    else if (el.getBoundingClientRect().bottom > fold) problems.push(`${selector} ends below the fold`);
  }
  const h1 = hero.querySelector("h1");
  if (h1 && h1.textContent.trim() !== "Venn. Connect your AI memories.") problems.push(`h1 reads "${h1.textContent.trim()}"`);
  if (h1 && parseFloat(getComputedStyle(h1).fontSize) < 32) problems.push("h1 is smaller than 32px");
  if (hero.querySelector(".hero__sub")?.textContent !== "Build your inner circle.") problems.push("unexpected hero subtitle");
  if (hero.querySelectorAll(".hero__circle").length !== 2 || document.querySelector("main img, main canvas")) {
    problems.push("the hero must use two CSS circles and the page must load no photos or canvas");
  }
  const backdrop = getComputedStyle(hero.querySelector(".hero__backdrop"));
  if (backdrop.pointerEvents !== "none" || backdrop.position !== "absolute" || Number(backdrop.zIndex) >= 0) {
    problems.push("the hero backdrop must be absolute, behind the content and ignore the pointer");
  }
  return problems;
}

// Runs in the page. Exercises consent, both invitation views, overlap, back and restart.
async function exercisePreview() {
  const problems = [];
  const expect = (ok, message) => ok || problems.push(`preview: ${message}`);
  const tick = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 30)));
  const root = document.querySelector(".onboarding");
  if (!root) return ["preview: onboarding is missing"];
  const button = (text) => [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
  const boxes = () => [...root.querySelectorAll('input[type="checkbox"]')];
  const step = (number) => {
    expect(root.querySelectorAll('.onboarding__progress [data-complete="true"]').length === number, `progress at step ${number}`);
    expect(document.activeElement === root.querySelector("h3"), `focus on heading at step ${number}`);
  };
  const storageBefore = JSON.stringify(localStorage);

  expect(boxes().length === 3 && boxes().every((b) => !b.checked), "memories start unselected");
  expect(button("Select a memory to continue")?.disabled, "empty selection cannot advance");
  boxes()[0]?.click();
  boxes()[2]?.click();
  await tick();
  button("Approve 2 memories")?.click();
  await tick();
  step(2);
  expect(root.querySelector("svg.onboarding__circle .onboarding__outline"), "pending circle shown");
  button("Preview Maya’s invitation")?.click();
  await tick();
  step(3);
  expect(root.textContent.includes("Someone invited you to Venn."), "invitee sees an invitation");
  button("Accept as Maya")?.click();
  await tick();
  step(4);
  expect(root.querySelectorAll(".onboarding__member").length === 2, "both people shown after acceptance");
  expect(root.querySelector(".onboarding__interests")?.textContent === "Photography", "only shared approved memories shown");
  expect(root.querySelector('a[href="#waitlist"]')?.textContent === "Join the Waitlist", "result links to live signup");
  button("Back")?.click();
  await tick();
  step(3);
  button("Restart")?.click();
  await tick();
  step(1);

  boxes()[2]?.click();
  await tick();
  button("Approve 1 memory")?.click();
  await tick();
  button("Preview Maya’s invitation")?.click();
  await tick();
  button("Accept as Maya")?.click();
  await tick();
  expect(root.textContent.includes("No shared interests in the memories you chose."), "no overlap for an unshared interest");
  button("Restart")?.click();
  await tick();
  expect(boxes().every((b) => !b.checked), "restart clears choices");
  expect(JSON.stringify(localStorage) === storageBefore, "preview did not change local storage");
  return problems;
}

// Runs in the page. Where keyboard focus is, and whether a focus ring is drawn for it.
// The email field shows its ring on the pill around it.
function focused() {
  const el = document.activeElement;
  const ringed = (node) => {
    const style = getComputedStyle(node);
    return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
  };
  const field = el.closest(".waitlist__field");
  let what = el.tagName.toLowerCase();
  if (el.id) what = `#${el.id}`;
  else if (el.classList.contains("waitlist__joined")) what = ".waitlist__joined";
  else if (el.matches("a, button")) what = el.textContent.trim();
  return { what, ring: ringed(el) || (!!field && ringed(field)) };
}

// Runs in the page. Resolves once the waitlist has answered a submit.
function waitlistAnswered() {
  return new Promise((done) => {
    const started = performance.now();
    const poll = () => {
      const joined = document.querySelector(".waitlist__joined");
      const error = document.querySelector(".waitlist__note--error");
      if (joined || error || performance.now() - started > 8000) {
        done({ joined: !!joined, error: error?.textContent ?? "" });
      } else setTimeout(poll, 50);
    };
    poll();
  });
}

// Runs in the page. What the waitlist shows right now, as a form or after joining.
function waitlistState() {
  const root = document.querySelector(".waitlist");
  const joined = root.querySelector(".waitlist__joined");
  const text = (selector) => root.querySelector(selector)?.textContent.trim() ?? "";
  return {
    joined: !!joined,
    lead: text(".waitlist__spot"),
    text: text(".waitlist__text"),
    note: text(".waitlist__note"),
    invite: text(".waitlist__invite"),
    submit: text(".waitlist__submit"),
    buttons: [...(joined?.querySelectorAll(".btn") ?? [])].map((b) => b.textContent.trim()),
    seats: [...root.querySelectorAll(".waitlist__circle .avatar")]
      .map((seat) => (seat.classList.contains("waitlist__seat") ? "open" : "taken"))
      .join(","),
    jump: joined?.querySelector('a[href="#inside"]') ? "#inside" : "",
    saved: localStorage.getItem("venn.waitlist"),
  };
}

// Runs in the page. Types into the waitlist form the way a person would and submits it.
function submitWaitlist(email) {
  const input = document.querySelector("#waitlist-email");
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setValue.call(input, email);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return new Promise((done) => {
    requestAnimationFrame(() => {
      document.querySelector(".waitlist__form").requestSubmit();
      const started = performance.now();
      const poll = () => {
        const joined = document.querySelector(".waitlist__joined");
        const error = document.querySelector(".waitlist__note--error");
        if (joined || error || performance.now() - started > 8000) {
          done({ joined: !!joined, error: error?.textContent ?? "" });
        } else setTimeout(poll, 50);
      };
      poll();
    });
  });
}

async function main() {
  const site = remoteUrl ? null : await startSite();
  const base = remoteUrl ?? site.base;
  const origin = new URL(base).origin;
  const chrome = launch();
  const failures = [];
  const notes = [];

  try {
    const cdp = await connect(await chrome.ready);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    const run = async (fn, ...args) => {
      const { result, exceptionDetails } = await send("Runtime.evaluate", {
        expression: `(${fn})(${args.map((a) => JSON.stringify(a)).join(",")})`,
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

    const open = async (path, viewport, { scheme = "light", motion = "no-preference" } = {}) => {
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
      await send("Page.navigate", { url: new URL(path, base).href });
      await loaded;
      await sleep(250); // hydration
    };
    const shot = async (name, fullPage = true) => {
      if (!shotsDir) return;
      mkdirSync(shotsDir, { recursive: true });
      const params = { format: "png" };
      if (fullPage) {
        const { cssContentSize } = await send("Page.getLayoutMetrics");
        params.captureBeyondViewport = true;
        params.clip = { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 };
      }
      const { data } = await send("Page.captureScreenshot", params);
      writeFileSync(join(shotsDir, `${name.replaceAll("/", "-")}.png`), Buffer.from(data, "base64"));
    };

    // The landing page at every size, plus dark (the page is light only and must stay
    // readable) and reduced motion.
    const runs = VIEWPORTS.map((viewport) => ({ viewport, scheme: "light", motion: "no-preference" }));
    runs.push({ viewport: VIEWPORTS[1], scheme: "dark", motion: "no-preference" });
    runs.push({ viewport: VIEWPORTS[3], scheme: "light", motion: "reduce" });

    for (const { viewport, scheme, motion } of runs) {
      label = `${viewport.name}${scheme === "dark" ? "/dark" : ""}${motion === "reduce" ? "/reduced-motion" : ""}`;
      await open("/", viewport, { scheme, motion });

      for (const problem of await run(auditFold)) failures.push(`${label}: ${problem}`);
      for (const problem of await run(audit)) failures.push(`${label}: ${problem}`);
      await shot(`${label}-fold`, false);
      await shot(label);

      for (const problem of await run(exercisePreview)) failures.push(`${label}: ${problem}`);
      console.log(`checked ${label}`);
    }

    if (shotsDir) {
      label = "phone/onboarding";
      await open("/", VIEWPORTS[1], { motion: "reduce" });
      const next = await run(`async () => {
        const preview = document.querySelector(".onboarding");
        preview.querySelector('input').click();
        const actions = ["Approve 1 memory", "Preview Maya’s invitation", "Accept as Maya"];
        for (const action of actions) {
          await new Promise((done) => requestAnimationFrame(done));
          Array.from(preview.querySelectorAll("button")).find((b) => b.textContent.trim() === action).click();
        }
        await new Promise((done) => requestAnimationFrame(done));
        preview.scrollIntoView({ block: "center" });
        return preview.querySelector("h3").textContent;
      }`);
      if (next !== "Your circle starts here.") failures.push("onboarding screenshot did not reach the result");
      for (const problem of await run(audit)) failures.push(`${label}: ${problem}`);
      await shot(label, false);
    }

    // The waitlist. The pair version runs on the smallest phone, where its states are
    // tallest and must still end above the fold; the open version on a phone, as before.
    const small = VIEWPORTS[0];
    const pairUrl = "/?w=pair&utm_source=check&utm_content=browser";
    const expect = (ok, message) => ok || failures.push(`${label}: ${message}`);
    // Checks the state now on screen: the wording, then the fold and the page audit.
    const look = async (name, wanted) => {
      const state = await run(waitlistState);
      for (const [key, value] of Object.entries(wanted)) {
        const got = Array.isArray(state[key]) ? state[key].join("|") : state[key];
        const ok = value instanceof RegExp ? value.test(got) : got === value;
        expect(ok, `${name}: ${key} was "${got}"`);
      }
      for (const problem of await run(auditFold)) failures.push(`${label}: ${name}: ${problem}`);
      for (const problem of await run(audit)) failures.push(`${label}: ${name}: ${problem}`);
      if (shotsDir) await sleep(700); // let a new state finish fading in
      await shot(`${label}-${name}`, false);
      return state;
    };

    // Real key presses, for the keyboard walk.
    const press = async (key, keyCode, text) => {
      const base = { key, code: key, windowsVirtualKeyCode: keyCode };
      await send("Input.dispatchKeyEvent", { ...base, type: text ? "keyDown" : "rawKeyDown", text });
      await send("Input.dispatchKeyEvent", { ...base, type: "keyUp" });
      await sleep(60);
    };
    const tab = () => press("Tab", 9);
    const enter = () => press("Enter", 13, "\r");
    // Focus must be on `what`, with a ring drawn unless the script itself moved focus there.
    const focusIs = async (what, ring = true) => {
      const now = await run(focused);
      expect(now.what === what, `keyboard: focus is on "${now.what}", expected "${what}"`);
      if (now.what === what) expect(now.ring === ring, `keyboard: "${what}" ${ring ? "shows no focus ring" : "should not show a ring"}`);
    };

    label = "phone-small/waitlist";
    await open(pairUrl, small);
    await look("pair-form", {
      submit: "Join the Waitlist",
      note: "You join with one person you know. We only email you about your invite.",
      invite: "",
    });
    const invalid = await run(submitWaitlist, "not-an-email");
    if (invalid.joined || !invalid.error.includes("valid email")) {
      failures.push(`${label}: an invalid email should show an error, got "${invalid.error}"`);
    }
    await open("/?w=open", small);
    await look("open-form", {
      submit: "Join the Waitlist",
      note: "Founding Circle. We only email you about your invite.",
    });

    if (remoteUrl) {
      notes.push("waitlist signup skipped: not submitted against --url");
    } else if (!process.env.DATABASE_URL) {
      notes.push("waitlist signup skipped: start the check with DATABASE_URL to exercise it");
    } else {
      const stamp = Date.now();
      const actions = "Share my invite link|Try the onboarding";

      // Pair: joining alone holds the place. Done with the keyboard only: the first Tab
      // lands in the email field, Enter joins, and focus moves to the answer.
      await open(pairUrl, small);
      await tab();
      await focusIs("#waitlist-email");
      await send("Input.insertText", { text: `check+${stamp}@example.com` });
      await enter();
      const first = await run(waitlistAnswered);
      expect(first.joined, `pair signup did not answer: "${first.error}"`);
      await sleep(100);
      await focusIs(".waitlist__joined", false);
      const pending = await look("pending", {
        lead: "Good things come in pairs.",
        text: "Your place is held. It is confirmed when one person you know joins with your link.",
        buttons: actions,
        note: "One link. A confirmed place for both of you.",
        seats: "",
        jump: "#inside",
      });
      expect(pending.saved && !pending.saved.includes("@"), "the spot should be remembered without the email");
      const code = pending.saved ? JSON.parse(pending.saved).refCode : "";
      // On from the answer: both actions in order, and Enter on the link goes to the preview.
      await tab();
      await focusIs("Share my invite link");
      await tab();
      await focusIs("Try the onboarding");
      await enter();
      await sleep(300);
      expect((await run(`() => location.hash`)) === "#inside", "keyboard: Enter on the preview link did not go to #inside");
      await run(`() => localStorage.clear()`);

      // The invited person: told a place is saved, not by whom, and joining confirms both.
      await open(`/?w=pair&ref=${code}`, small);
      await look("invitee", {
        invite: /^Someone saved you a place\.\s*Joining confirms a place for both of you\.$/,
        submit: "Accept the invite",
        note: "No +1 needed. We only email you about your invite.",
      });
      const second = await run(submitWaitlist, `check+${stamp}b@example.com`);
      expect(second.joined, `invited signup did not answer: "${second.error}"`);
      await look("confirmed", {
        lead: "You\u2019re both in.",
        text: "Your places in the Founding Circle are confirmed.",
        buttons: actions,
        note: "2 in your circle. 3 invites left.",
        seats: "taken,taken,open,open,open",
      });
      await run(`() => localStorage.clear()`);

      // The first person comes back. Their device remembers a spot in the shape from before
      // pairs, which must still be read and then refreshed to "confirmed".
      await run(`(code) => localStorage.setItem("venn.waitlist", JSON.stringify({ position: 101, refCode: code, referrals: 0 }))`, code);
      await open(pairUrl, small);
      for (let waited = 0; waited < 5000 && (await run(waitlistState)).lead !== "You\u2019re both in."; waited += 100) {
        await sleep(100);
      }
      await look("returning", { lead: "You\u2019re both in.", note: "2 in your circle. 3 invites left." });
      await run(`() => localStorage.clear()`);

      // A link nobody owns: the normal form, and a line that says what to do.
      await open("/?w=pair&ref=zzzzzzzz", small);
      await look("closed-link", {
        invite: "That invite link is no longer open. You can still join.",
        submit: "Join the Waitlist",
      });
      console.log(`checked ${label} (pending, invited, confirmed, returning, closed link)`);

      // Open: a number at once, and inviting moves you up.
      label = "phone/waitlist";
      await open("/?w=open&utm_source=check&utm_content=browser", VIEWPORTS[1]);
      const third = await run(submitWaitlist, `check+${stamp}c@example.com`);
      expect(third.joined, `open signup did not answer: "${third.error}"`);
      const joined = await look("joined", {
        lead: /#\d{3,}/,
        buttons: "Invite a connection to move up|Try the onboarding",
        note: "",
        jump: "#inside",
      });
      expect(joined.saved && !joined.saved.includes("@"), "the spot should be remembered without the email");
      console.log(`checked ${label} (${joined.lead})`);
      await run(`() => localStorage.clear()`);
    }

    // The waitlist rate limit. Local only: it relies on the server trusting X-Real-IP,
    // and a made-up address keeps the browser's own allowance untouched.
    if (!remoteUrl) {
      const statuses = [];
      for (let i = 0; i < 11; i += 1) {
        const response = await fetch(new URL("/api/waitlist", base), {
          method: "POST",
          headers: { "content-type": "application/json", "x-real-ip": "203.0.113.9" },
          body: JSON.stringify({ email: "not-an-email" }),
        });
        statuses.push(response.status);
      }
      if (statuses.slice(0, 10).some((s) => s !== 400) || statuses[10] !== 429) {
        failures.push(`waitlist rate limit: expected ten 400s then a 429, got ${statuses.join(",")}`);
      } else console.log("checked waitlist rate limit (429 after 10 tries)");
    }

    // /metrics is closed without the password.
    const closed = await fetch(new URL("/metrics", base));
    const wrong = await fetch(new URL("/metrics", base), {
      headers: { authorization: `Basic ${Buffer.from("team:wrong-password").toString("base64")}` },
    });
    const closedText = await closed.text();
    if (![401, 503].includes(closed.status) || ![401, 503].includes(wrong.status) || closedText.includes("Unique Visitors")) {
      failures.push(`/metrics must not open without the password (got ${closed.status} and ${wrong.status})`);
    } else console.log(`checked /metrics is closed without the password (${closed.status})`);

    // /metrics
    if (!metricsPassword) notes.push("metrics page skipped: set METRICS_PASSWORD to check it with --url");
    else {
      await send("Network.setExtraHTTPHeaders", {
        headers: { authorization: `Basic ${Buffer.from(`team:${metricsPassword}`).toString("base64")}` },
      });
    }
    for (const viewport of metricsPassword ? [VIEWPORTS[0], VIEWPORTS[3]] : []) {
      label = `${viewport.name}/metrics`;
      await open("/metrics", viewport);
      for (const problem of await run(audit)) failures.push(`${label}: ${problem}`);
      const text = await run(`() => document.body.innerText`);
      if (text.includes("DATABASE_URL is not set")) {
        notes.push("metrics tiles skipped: the site has no DATABASE_URL");
      } else {
        const wantedLabels = [
          "Unique Visitors",
          "Total Waitlist Signups",
          "Activation Rate",
          "Confirmed Signups",
          "Pairs Formed",
          "Confirmed Rate",
          "By waitlist version",
          "By UTM source",
          "By referral",
        ];
        for (const wanted of wantedLabels) {
          if (!text.includes(wanted)) failures.push(`${label}: "${wanted}" is missing`);
        }
      }
      await shot(label);
      console.log(`checked ${label}`);
    }

    const { cookies } = await send("Network.getCookies", { urls: [base] });
    if (cookies.length) failures.push(`cookies were set: ${cookies.map((c) => c.name).join(", ")}`);
    cdp.close();
  } finally {
    chrome.close();
    site?.close();
  }

  for (const note of [...new Set(notes)]) console.log(`note: ${note}`);
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
