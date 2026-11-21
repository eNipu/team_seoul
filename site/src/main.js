// Entry point for the Heldly site: the card under the 3D scene, the "inside ChatGPT" example,
// and the scene itself, which loads as a separate chunk only when WebGL 2 is available.

import { CLUSTERS, PEOPLE } from "./data.js";

function setupStageCard() {
  const card = document.querySelector("[data-signal]");
  if (!card) return () => {};
  const field = (key) => card.querySelector(`[data-signal-${key}]`);
  let timer = 0;
  const write = (person) => {
    field("name").textContent = person.name;
    field("shared").textContent = `you share ${person.clusters.map((c) => CLUSTERS[c]).join(" and ")}`;
    field("text").textContent = person.keep;
  };
  write(PEOPLE[0]);
  let shown = 0;
  return function show(index) {
    if (index === shown) return;
    shown = index;
    card.classList.add("is-changing");
    clearTimeout(timer);
    timer = setTimeout(() => {
      write(PEOPLE[index]);
      card.classList.remove("is-changing");
    }, 350);
  };
}

function setupScene(showPerson) {
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
  import("./scene.js")
    .then(({ startScene }) => startScene(host, { reducedMotion, onActivate: showPerson }))
    .catch((error) => {
      console.warn("Heldly scene unavailable:", error);
      flat("scene-error");
    });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function setupExample() {
  const picker = document.querySelector("[data-clusters]");
  const panel = document.querySelector("[data-cluster-panel]");
  if (!picker || !panel) return;
  const radios = [...picker.querySelectorAll('input[type="radio"]')];

  function render(cluster) {
    panel.textContent = "";
    for (const person of PEOPLE.filter((p) => p.clusters.includes(cluster))) {
      const item = el("li", "person");
      const head = el("div", "person__head");
      head.append(el("p", "person__name", person.name), el("p", "person__quiet", person.quiet));
      const keep = el("p", "person__row");
      keep.append(el("span", "person__label", "Keep it alive"), el("span", "", person.keep));
      const use = el("p", "person__row");
      use.append(el("span", "person__label", "How it could help"), el("span", "", person.use));
      item.append(head, keep, use);
      panel.append(item);
    }
  }

  for (const radio of radios) {
    radio.disabled = false;
    radio.addEventListener("change", () => render(Number(radio.value)));
  }
  render(Number(radios.find((r) => r.checked)?.value ?? 0));
}

setupExample();
setupScene(setupStageCard());
