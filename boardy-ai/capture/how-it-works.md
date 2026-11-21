# How it works

Deep mode: what the site's JavaScript is made of and what its start page did while we watched.

## Its JavaScript

Analysed 18 script(s) from https://www.boardy.ai/: 17 module(s), 42 endpoint(s), 42 route(s), bundled with vite.

Evidence ev_597d255bafe00a3aee982a97d40021b9fa6ce2fbf8c8b1c90e77a7a040f6fa7a.

```json
{
  "api_operations": [],
  "app_kind": "unknown",
  "bundlers": [
    "vite"
  ],
  "edges": [
    {
      "from": "event:www.boardy.ai/assets/country-code-picker-BibYXFOp.js#document:pointerdown",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/country-code-picker-BibYXFOp.js#c@5"
    },
    {
      "from": "event:www.boardy.ai/assets/home-nav-bar-CMMaVtXX.js#c:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/home-nav-bar-CMMaVtXX.js#d@1"
    },
    {
      "from": "event:www.boardy.ai/assets/home-nav-bar-CMMaVtXX.js#window:scroll",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/home-nav-bar-CMMaVtXX.js#l@1"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#C:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#F@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#M:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#Y@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#N:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#V@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#document:visibilitychange",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#J@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#document:visibilitychange",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#T@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#document:visibilitychange",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#U@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#document:visibilitychange",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#g@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#document:visibilitychange",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#h@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#document:visibilitychange",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#k@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#document:visibilitychange",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#x@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#g:finish",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#j@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#h:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#c@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#l:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#h@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#l:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#j@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#m:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#$@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#m:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#S@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#m:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#f@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#p:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#j@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#r.useRef().current:scroll",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#y@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#r:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#f@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#r:change",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#h@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#window:hashchange",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#x@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#window:resize",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#j@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-B9RyudA8.js#window:scroll",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-B9RyudA8.js#j@11"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#M:error",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#M.addEventListener(error)@10"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#M:error",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#W@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#M:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#H@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#M:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#M.addEventListener(load)@10"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#a:error",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#a.onerror@129"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#a:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#a.onload@129"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#b:error",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#M@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#b:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#A@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#document:scroll",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#document.addEventListener(scroll)@10"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#e:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#M7@130"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#ee:DOMContentLoaded",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#r@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#i:error",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#i.addEventListener(error)@129"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#i:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#i.addEventListener(load)@129"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#l:DOMContentLoaded",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#u@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#n:abort",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#h@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#n:readystatechange",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#n.onreadystatechange@129"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#navigation:navigate",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#o@10"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#navigation:navigateerror",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#s@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#navigation:navigatesuccess",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#s@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#o:click",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#xi@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#p:error",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#u@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#p:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#u@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#re.port1:message",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#V@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#s:click",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#xi@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#s:error",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#l@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#s:error",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#s.addEventListener(error)@10"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#s:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#l@9"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#s:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#s.addEventListener(load)@10"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#t:abort",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#r@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#t:beforeunload",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#P@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#t:error",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#t.addEventListener(error)@130"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#t:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#e@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#t:popstate",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#L@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#this._instance:eventCaptured",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#this._instance.on(eventCaptured)@130"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#this.instance.uu:extensionsRemoteConfig",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#n@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#this:eventCaptured",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#this.on(eventCaptured)@129"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#window:boardy:analytics-consent",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#a@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#window:boardy:analytics-consent",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#nm@130"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#window:boardy:analytics-consent",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#r@2"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#y:error",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#y.addEventListener(error)@130"
    },
    {
      "from": "event:www.boardy.ai/assets/index-BjgH2D5g.js#y:load",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/index-BjgH2D5g.js#_@2"
    },
    {
      "from": "event:www.boardy.ai/assets/landing-message-dialog-CIclDkIa.js#document:keydown",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/landing-message-dialog-CIclDkIa.js#i@1"
    },
    {
      "from": "event:www.boardy.ai/assets/landing-message-dialog-CIclDkIa.js#i:resize",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/landing-message-dialog-CIclDkIa.js#u@1"
    },
    {
      "from": "event:www.boardy.ai/assets/landing-message-dialog-CIclDkIa.js#i:scroll",
      "kind": "handled-by",
      "to": "fn:www.boardy.ai/assets/landing-message-dialog-CIclDkIa.js#u@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Er@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#d@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Gr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#D@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Jr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#D@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Lr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#E@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Qr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#D@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Rr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#bt@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Vr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#D@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Wr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#d@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Wr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#p@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Xr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#D@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.Zr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#D@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>._r@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#E@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>._r@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#m@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.dr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#ft@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.dr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#k@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.dr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#lt@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.eo@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#ht@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.io@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#E@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.kr@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#ht@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.lo@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#E@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.lo@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#T@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.oo@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#_t@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.oo@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#ft@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.oo@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#p@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.stop@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#this.gr@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#<class>.ur@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#this.cr@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#B@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#L@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#B@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#T@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#B@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#f@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#B@1",
      "kind": "calls",
      "to": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#o@1"
    },
    {
      "from": "fn:us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js#F@1",
```

## Ten seconds of it

Watched https://www.boardy.ai/ for 10000ms: 0 request outline(s), 0 console entr(y/ies).

Evidence ev_5415a233adad71ca74020af34a4924ec6297382ef0b795e82fa6009227476004.

```json
{
  "accessibility": null,
  "console": {
    "count": 0,
    "entries": [],
    "has_text": false
  },
  "dom": {
    "attribute_names": [
      "alt",
      "aria-atomic",
      "aria-controls",
      "aria-hidden",
      "aria-label",
      "aria-labelledby",
      "aria-live",
      "aria-pressed",
      "as",
      "async",
      "charset",
      "class",
      "content",
      "crossorigin",
      "cx",
      "cy",
      "d",
      "data-active",
      "data-animating",
      "data-channel-stage",
      "data-complete",
      "data-composer-key",
      "data-composer-prefix",
      "data-composer-send",
      "data-composer-slot",
      "data-dragging",
      "data-feed-complete",
      "data-feed-playing",
      "data-homepage",
      "data-homepage-redesign",
      "data-inview",
      "data-live",
      "data-meeting-demo",
      "data-mobile-active",
      "data-mobile-hero",
      "data-mobile-visible",
      "data-motion",
      "data-motion-active",
      "data-nosnippet",
      "data-opening",
      "data-phase",
      "data-playing",
      "data-position",
      "data-precedence",
      "data-ready",
      "data-reveal",
      "data-reveal-enabled",
      "data-stage-card",
      "data-unfolded",
      "data-viewport",
      "data-visible",
      "decoding",
      "fill",
      "gradientunits",
      "height",
      "href",
      "id",
      "imagesizes",
      "lang",
      "name",
      "offset",
      "property",
      "r",
      "rel",
      "role",
      "rx",
      "ry",
      "sizes",
      "src",
      "stop-color",
      "stop-opacity",
      "stroke",
      "stroke-dasharray",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-opacity",
      "stroke-width",
      "style",
      "tabindex",
      "target",
      "type",
      "viewbox",
      "width",
      "x",
      "x1",
      "x2",
      "xmlns",
      "y",
      "y1",
      "y2"
    ],
    "elements_by_name": {
      "a": 34,
      "b": 8,
      "blockquote": 48,
      "body": 1,
      "br": 2,
      "button": 33,
      "circle": 2,
      "dd": 2,
      "defs": 2,
      "div": 257,
      "dl": 1,
      "dt": 2,
      "ellipse": 4,
      "figcaption": 2,
      "figure": 50,
      "footer": 1,
      "g": 1,
      "h1": 2,
      "h2": 7,
      "h3": 9,
      "head": 1,
      "header": 2,
      "html": 1,
      "i": 9,
      "img": 128,
      "li": 30,
      "lineargradient": 1,
      "link": 68,
      "main": 1,
      "mark": 1,
      "meta": 17,
      "nav": 5,
      "ol": 2,
      "p": 62,
      "path": 83,
      "radialgradient": 1,
      "rect": 7,
      "script": 5,
      "section": 9,
      "small": 66,
      "span": 449,
      "stop": 5,
      "strong": 58,
      "svg": 80,
      "title": 1,
      "ul": 3
    },
    "text_nodes": 555,
    "total_nodes": 2202,
    "truncated": false
  },
  "dropped_events": 0,
  "frame_origins": [
    "https://www.boardy.ai"
  ],
  "network": {
    "request_count": 0,
    "requests": []
  },
  "origin": "https://www.boardy.ai/",
  "resources": [
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/openai.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/alon-michael.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/anthropic.webp"
    },
    {
      "mime_type": "font/woff2",
      "type": "Font",
      "url": "https://www.boardy.ai/assets/raleway-latin-wght-normal-CSF1BaNN.woff2"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/a16z.webp"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://www.boardy.ai/channels/gmail.svg"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/yc.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/nvidia.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/shreyas-kulkarni.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/josh-jackson.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/channels/claude-colour.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/prateek-sanjay.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/stefan-mathys.webp"
    },
    {
      "mime_type": "image/jpeg",
      "type": "Image",
      "url": "https://www.boardy.ai/andrew-profile.jpeg"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://www.boardy.ai/channels/x.svg"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/sequoia.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/sara-scarborough-graham.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/lopsii-olagoke.webp"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://www.boardy.ai/channels/whatsapp.svg"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/alison-kaizer.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/boardy-phone-pfp.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/hf0.webp"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://www.boardy.ai/channels/google-calendar.svg"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/kevin.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/scott-kelly.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/jonny-price.webp"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://www.boardy.ai/phone.svg"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/general-catalyst.webp"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://www.boardy.ai/channels/googlemeet.svg"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://www.boardy.ai/channels/linkedin.svg"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tesla.webp"
    },
    {
      "mime_type": "image/svg+xml",
      "type": "Image",
      "url": "https://www.boardy.ai/channels/text.svg"
    },
    {
      "mime_type": "font/woff2",
      "type": "Font",
      "url": "https://www.boardy.ai/assets/geist-latin-wght-normal-Dm3htQBi.woff2"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/tweets/virgile-rietsch.webp"
    },
    {
      "mime_type": "image/webp",
      "type": "Image",
      "url": "https://www.boardy.ai/boardy-landing-logo-mark.webp"
    }
  ],
  "scripts": [
    {
      "length": 613,
      "source_map_url": null,
      "url": "https://www.boardy.ai/"
    },
    {
      "length": 797,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/scroll-reveal-observer-h4pxLmi5.js"
    },
    {
      "length": 449,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/home-stats-B8pLmeA_.js"
    },
    {
      "length": 79,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/is-record-WdQbMeHT.js"
    },
    {
      "length": 256,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/lock-keyhole-D51r-cXl.js"
    },
    {
      "length": 16524,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/landing-message-dialog-CIclDkIa.js"
    },
    {
      "length": 6617,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/home-nav-bar-CMMaVtXX.js"
    },
    {
      "length": 1482,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/linktree-channel-dialog-BC4KBoT_.js"
    },
    {
      "length": 97595,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/index-B9RyudA8.js"
    },
    {
      "length": 935325,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/index-BjgH2D5g.js"
    },
    {
      "length": 527,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/campaign-submission-Cvm2ovU4.js"
    },
    {
      "length": 266,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/search-CIraHuDM.js"
    },
    {
      "length": 155,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/x-BR0KwmdT.js"
    },
    {
      "length": 1168,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/index-BvvxcsDW.js"
    },
    {
      "length": 133465,
      "source_map_url": null,
      "url": "https://www.boardy.ai/assets/country-code-picker-BibYXFOp.js"
    },
    {
      "length": 1251,
      "source_map_url": null,
      "url": "https://us-assets.i.posthog.com/array/phc_aybzGDeUsNW2jlyrBdExPD9yG2If1qgP7LAZjcmXc7/config.js"
    },
    {
      "length": 27027,
      "source_map_url": "web-vitals-with-attribution.js.map",
      "url": "https://us-assets.i.posthog.com/static/1.438.12/web-vitals-with-attribution.js"
    },
    {
      "length": 23896,
      "source_map_url": "dead-clicks-autocapture.js.map",
      "url": "https://us-assets.i.posthog.com/static/1.438.12/dead-clicks-autocapture.js"
    }
  ],
  "scripts_truncated": false,
  "secret_redactions": 0,
  "storage_keys": null,
  "watch_ms": 10000,
  "websockets": {
    "connections": [],
    "frames": []
  }
}
```
