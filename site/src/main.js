// Entry point for the Heldly site: the booking example and the 3D network in the hero.
// The scene is loaded as a separate chunk, only when WebGL 2 is available.

const SIGNALS = [
  { name: "Teodor Weiss", quiet: "quiet for 14 months", text: "Moved to Berlin. Looking for his first enterprise clients.", kind: "Possible client" },
  { name: "Mina Park", quiet: "quiet for 8 months", text: "Launching in the US this spring. Needs a sales lead.", kind: "Possible client" },
  { name: "Sam Okafor", quiet: "quiet for 2 years", text: "Raising a seed round. Wants advisors with B2B sales experience.", kind: "Advisory role" },
  { name: "Lea Novak", quiet: "quiet for 11 months", text: "Hiring a fractional CFO for her design studio.", kind: "Possible client" },
  { name: "Jun Ito", quiet: "quiet for 6 months", text: "Looking for a partner agency for a retail rollout.", kind: "Partnership" },
  { name: "Priya Raman", quiet: "quiet for 1 year", text: "Offering intros to retail buyers in Seoul.", kind: "Warm intro" },
];

function setupSignalCard() {
  const card = document.querySelector("[data-signal]");
  if (!card) return () => {};
  const field = (key) => card.querySelector(`[data-signal-${key}]`);
  let next = 1;
  let timer = 0;
  return function showNext() {
    const signal = SIGNALS[next % SIGNALS.length];
    next += 1;
    card.classList.add("is-changing");
    clearTimeout(timer);
    timer = setTimeout(() => {
      field("name").textContent = signal.name;
      field("quiet").textContent = signal.quiet;
      field("text").textContent = signal.text;
      field("kind").textContent = signal.kind;
      card.classList.remove("is-changing");
    }, 350);
  };
}

function setupScene() {
  const host = document.querySelector("[data-scene]");
  if (!host) return;
  const stage = host.closest(".stage");
  const flat = (reason) => {
    stage.classList.add("stage--flat");
    host.dataset.state = "flat";
    host.dataset.reason = reason;
  };

  const probe = document.createElement("canvas");
  let gl = null;
  try {
    gl = probe.getContext("webgl2");
  } catch {
    gl = null;
  }
  if (!gl) {
    flat("no-webgl2");
    return;
  }
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const onWarm = reducedMotion ? () => {} : setupSignalCard();
  import("./scene.js")
    .then(({ startScene }) => startScene(host, { reducedMotion, onWarm }))
    .catch((error) => {
      console.warn("Heldly scene unavailable:", error);
      flat("scene-error");
    });
}

function setupDemo() {
  const steps = {
    results: document.querySelector('[data-step="results"]'),
    slots: document.querySelector('[data-step="slots"]'),
    sent: document.querySelector('[data-step="sent"]'),
  };
  if (!steps.results || !steps.slots || !steps.sent) return;

  const books = [...steps.results.querySelectorAll("[data-book]")];
  const radios = [...steps.slots.querySelectorAll('input[type="radio"]')];
  let person = "";
  let opener = null;

  const show = (name) => {
    for (const [key, el] of Object.entries(steps)) el.hidden = key !== name;
    steps[name].querySelector(".card__title").focus();
  };
  const firstName = (full) => full.split(" ")[0];

  for (const button of books) {
    button.disabled = false;
    button.addEventListener("click", () => {
      person = button.dataset.book;
      opener = button;
      steps.slots.querySelector("[data-slots-title]").textContent = `Times that work for you and ${firstName(person)}`;
      show("slots");
    });
  }

  steps.slots.querySelector("[data-back]").addEventListener("click", () => {
    show("results");
    opener?.focus();
  });

  steps.slots.querySelector("[data-send]").addEventListener("click", () => {
    const slot = radios.find((r) => r.checked)?.value ?? radios[0].value;
    steps.sent.querySelector("[data-sent-title]").textContent = `Request sent to ${person}`;
    steps.sent.querySelector("[data-sent-text]").textContent =
      `${firstName(person)} gets a request for ${slot}. When ${firstName(person)} says yes, it goes on both calendars.`;
    show("sent");
  });

  steps.sent.querySelector("[data-restart]").addEventListener("click", () => {
    radios.forEach((r, i) => (r.checked = i === 0));
    show("results");
    books[0].focus();
  });
}

setupDemo();
setupScene();
