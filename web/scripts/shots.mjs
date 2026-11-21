// Drives the built site in headless Chrome over the DevTools protocol (no dependencies;
// needs Node 22+ for the global WebSocket and a `google-chrome` binary).
//
//   node scripts/serve.mjs 4173 &
//   node scripts/shots.mjs jobs.json
//
// jobs.json: [{ "url": "/app/people?demo=1", "w": 1280, "h": 900, "scheme": "dark",
//               "steps": ["click('Add a person')", "wait:200", "waitFor:Saved", "key:Tab"],
//               "out": "/tmp/venn_web/people.png", "full": true, "reducedMotion": false }]
// Each step is JavaScript evaluated in the page (its value is printed), or wait:<ms>,
// waitFor:<text>, key:<Key>. Console errors and uncaught exceptions are printed as they happen.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ORIGIN = process.env.VENN_ORIGIN || "http://127.0.0.1:4173";
const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "venn-chrome-"));
const chrome = spawn(
  process.env.CHROME || "google-chrome",
  ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HELPERS = `
window.__ready=()=>!!document.querySelector('#root')&&document.querySelector('#root').children.length>0&&!document.querySelector('[aria-busy=true]');
window.click=(t,n=0)=>{const b=[...document.querySelectorAll("dialog[open] button,dialog[open] a,dialog[open] label")].concat(document.querySelector("dialog[open]")?[]:[...document.querySelectorAll("button,a,label,summary")]).filter(b=>b.textContent.trim().includes(t)&&!b.disabled&&b.getClientRects().length)[n]; if(!b) return "NO BUTTON "+t; b.click(); return "clicked "+t};
window.clickLabel=(t,n=0)=>{const b=[...document.querySelectorAll("[aria-label]")].filter(b=>b.getAttribute("aria-label").includes(t)&&!b.disabled&&b.getClientRects().length)[n]; if(!b) return "NO LABEL "+t; b.click(); return "clicked label "+t};
window.has=(t)=>(document.body.innerText.includes(t)?"HAS ":"MISSING ")+t;
window.overflow=()=>{const sw=document.documentElement.scrollWidth,cw=document.documentElement.clientWidth; return (sw>cw?"OVERFLOW":"no overflow")+" sw="+sw+" cw="+cw};
window.field=(label,n=0)=>{const root=document.querySelector("dialog[open]")||document; const l=[...root.querySelectorAll("label,legend")].filter(l=>l.textContent.trim().startsWith(label))[n]; if(!l) return null; return l.htmlFor?document.getElementById(l.htmlFor):l.parentElement.querySelector("input,textarea,select")};
window.setEl=(el,v)=>{const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:el.tagName==="SELECT"?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value").set.call(el,v); el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true}));};
window.fill=(label,v,n=0)=>{const el=window.field(label,n); if(!el) return "NO FIELD "+label; window.setEl(el,v); return "filled "+label};
window.setVal=(sel,v)=>{const el=document.querySelector(sel); if(!el) return "NO EL "+sel; window.setEl(el,v); return "set "+sel};
window.focusInfo=()=>{const a=document.activeElement; if(!a||a===document.body) return "focus: body"; const cs=getComputedStyle(a); return "focus: <"+a.tagName.toLowerCase()+"> "+JSON.stringify((a.getAttribute("aria-label")||a.textContent||"").trim().slice(0,40))+" outline="+cs.outlineStyle+" "+cs.outlineWidth};
window.smallTargets=()=>{const out=[]; for(const el of document.querySelectorAll("button,a,input,select,textarea,label.pick,label.answer,label.radio")){const r=el.getBoundingClientRect(); if(!r.width||el.closest(".sr-only")||el.disabled) continue; if(el.matches("input[type=checkbox],input[type=radio]")&&el.closest("label")) continue; const cs=getComputedStyle(el); if(cs.display==="inline"&&el.tagName==="A") continue; let h=r.height,w=r.width; const after=getComputedStyle(el,"::after"); if(after.content!=="none"&&after.position==="absolute"){h+=16;w+=16} if(h<43.5||w<43.5) out.push(el.tagName.toLowerCase()+"."+(el.className||"")+" "+Math.round(w)+"x"+Math.round(h)+" "+JSON.stringify((el.getAttribute("aria-label")||el.textContent||"").trim().slice(0,24)));} return out.length?"SMALL TARGETS: "+[...new Set(out)].join(" | "):"targets ok"};
window.contrastReport=(min=4.5)=>{
 const parse=c=>{const m=c.match(/rgba?\\(([^)]+)\\)/); if(m){const p=m[1].split(/[, /]+/).filter(Boolean).map(Number); return {r:p[0],g:p[1],b:p[2],a:p[3]===undefined?1:p[3]}} const s=c.match(/color\\(srgb ([^)]+)\\)/); if(s){const p=s[1].split(/[ /]+/).filter(Boolean).map(Number); return {r:p[0]*255,g:p[1]*255,b:p[2]*255,a:p[3]===undefined?1:p[3]}} return null};
 const lum=({r,g,b})=>{const f=v=>{v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)};
 const over=(t,u)=>({r:t.r*t.a+u.r*(1-t.a),g:t.g*t.a+u.g*(1-t.a),b:t.b*t.a+u.b*(1-t.a),a:1});
 const bodyBg=parse(getComputedStyle(document.body).backgroundColor);
 const bgOf=el=>{const stack=[]; let img=false; for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e); if(cs.backgroundImage!=="none") img=true; const c=parse(cs.backgroundColor); if(c&&c.a>0){stack.push(c); if(c.a===1)break;}} let base=bodyBg; for(let i=stack.length-1;i>=0;i--) base=over(stack[i],base); return base};
 const bad=[]; let checked=0; const seen=new Set();
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 for(let n=walker.nextNode();n;n=walker.nextNode()){
  if(!n.textContent.trim()) continue; const el=n.parentElement; const cs=getComputedStyle(el);
  if(cs.visibility==='hidden'||cs.display==='none'||el.closest('.sr-only')||el.closest('svg')||el.closest('script,style')) continue;
  if(el.closest(':disabled')||el.closest('[aria-disabled=true]')) continue;
  const r=el.getBoundingClientRect(); if(r.width===0) continue;
  let fg=parse(cs.color); if(!fg) continue; const bg=bgOf(el); fg=over(fg,bg);
  const l1=lum(fg),l2=lum(bg); const ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
  const size=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight)>=700; const large=size>=24||(bold&&size>=18.66);
  checked++;
  if(ratio<(large?3:min)){const key=el.tagName.toLowerCase()+'.'+(typeof el.className==='string'?el.className:''); if(!seen.has(key)){seen.add(key); bad.push(key+' '+ratio.toFixed(2)+' '+size+'px '+JSON.stringify(n.textContent.trim().slice(0,20)));}}
 }
 return (bad.length?"CONTRAST FAIL: "+bad.join(" | "):"contrast ok")+" ("+checked+" text nodes)";
};
`;

async function connect() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error("Chrome did not start");
}

let failed = 0;
try {
  const ws = new WebSocket(await connect());
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let nextId = 1;
  const pending = new Map();
  let current = "";
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown") {
      failed++;
      console.log(`  !! EXCEPTION [${current}]`, msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    } else if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      failed++;
      console.log(`  !! console.${msg.params.type} [${current}]`, msg.params.args.map((a) => a.value ?? a.description).join(" "));
    } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      // The static test server has no API; the "not connected" job expects that 404.
      if (!/api\/v1\/session/.test(msg.params.entry.url ?? "")) {
        failed++;
        console.log(`  !! log.error [${current}]`, msg.params.entry.text, msg.params.entry.url ?? "");
      }
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) return "EVAL ERROR " + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const waitUntil = async (expression, ms = 6000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if ((await evaluate(expression)) === true) return true;
      await sleep(60);
    }
    return false;
  };

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Log.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: HELPERS });

  for (const job of jobs) {
    current = job.out ? job.out.split("/").pop() : job.url;
    const w = job.w ?? 1280;
    const h = job.h ?? 900;
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-color-scheme", value: job.scheme ?? "light" },
        { name: "prefers-reduced-motion", value: job.reducedMotion ? "reduce" : "no-preference" },
      ],
    });
    await send("Page.navigate", { url: "about:blank" });
    await send("Page.navigate", { url: ORIGIN + job.url });
    if (!(await waitUntil("typeof window.__ready==='function'&&window.__ready()"))) console.log(`  !! [${current}] page never became ready`);
    await sleep(120);
    console.log(`# ${current}  (${job.url} ${w}px ${job.scheme ?? "light"})`);
    for (const step of job.steps ?? []) {
      if (step.startsWith("wait:")) await sleep(Number(step.slice(5)));
      else if (step.startsWith("waitFor:")) {
        const ok = await waitUntil(`document.body.innerText.includes(${JSON.stringify(step.slice(8))})`);
        if (!ok) {
          failed++;
          console.log("  !! never saw", JSON.stringify(step.slice(8)));
        }
      } else if (step.startsWith("key:")) {
        const key = step.slice(4);
        const code = { Tab: 9, Enter: 13, Escape: 27 }[key] ?? 0;
        for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key, code: key, windowsVirtualKeyCode: code, text: type === "keyDown" && key === "Enter" ? "\r" : undefined });
      } else {
        const out = await evaluate(step);
        if (typeof out === "string" && /^(NO |MISSING|OVERFLOW|CONTRAST FAIL|SMALL TARGETS|EVAL ERROR)/.test(out)) failed++;
        if (out !== undefined) console.log("  ", out);
        await sleep(140);
      }
    }
    if (job.out) {
      await sleep(200);
      if (job.full) {
        const height = await evaluate("Math.max(document.documentElement.scrollHeight, document.querySelector('dialog[open]')?.scrollHeight ?? 0)");
        await send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.min(Math.max(height, h), 5000), deviceScaleFactor: 1, mobile: w < 600 });
        await sleep(150);
      }
      const shot = await send("Page.captureScreenshot", { format: "png" });
      mkdirSync(dirname(job.out), { recursive: true });
      writeFileSync(job.out, Buffer.from(shot.data, "base64"));
    }
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(200);
  rmSync(profile, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} problem(s) flagged above` : "\nno problems flagged");
process.exit(failed ? 1 : 0);
