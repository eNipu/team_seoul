// The hero animation: what you've told Heldly gathers into interest clusters, and the people
// you know sit between the interests you share. One person at a time lights up, with lines to
// those interests and to you.
//
// WebGL draws the dots and lines. Cluster washes and labels are HTML positioned from the same
// 3D points, so text stays sharp. Colours come from the page's CSS tokens.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  QuadraticBezierCurve3,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { CLUSTERS, PEOPLE, firstName } from "./data.js";

const PER_CLUSTER = 26;
const MEMORIES = CLUSTERS.length * PER_CLUSTER;
const TOTAL = MEMORIES + PEOPLE.length + 2; // + you + your glow
const YOU = MEMORIES + PEOPLE.length;
const CLUSTER_RADIUS = 0.5;
const ARC_POINTS = 40;
const GATHER_MS = 2600;
const EVERY_MS = 4400;
const DRAW_MS = 800;
const KIND = { dot: 0, ring: 2, glow: 3 };

const vertexShader = /* glsl */ `
  attribute vec3 aFrom;
  attribute float aSize;
  attribute float aWarm;
  attribute float aKind;
  attribute float aPhase;
  uniform float uPixel;
  uniform float uGather;
  uniform float uTime;
  uniform float uDist;
  uniform vec3 uCold;
  uniform vec3 uWarm;
  varying vec3 vColor;
  varying float vKind;
  varying float vWarm;
  void main() {
    vec3 p = mix(aFrom, position, uGather);
    float drifts = 1.0 - step(0.5, aKind);
    p += vec3(sin(uTime * 0.6 + aPhase), cos(uTime * 0.5 + aPhase * 1.7), sin(uTime * 0.4 + aPhase * 2.3)) * 0.035 * drifts;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = mix(uCold, uWarm, aWarm);
    vKind = aKind;
    vWarm = aWarm;
    gl_PointSize = aSize * uPixel * (uDist / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vKind;
  varying float vWarm;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float disc = smoothstep(0.5, 0.44, d);
    float alpha = disc;
    if (vKind > 2.5) {
      alpha = pow(1.0 - d * 2.0, 2.0) * 0.4;
    } else if (vKind > 1.5) {
      float ring = disc * smoothstep(0.3, 0.36, d);
      alpha = mix(ring, disc, vWarm);
    } else {
      alpha = disc * mix(0.8, 1.0, vWarm);
    }
    gl_FragColor = vec4(vColor, alpha);
  }
`;

function readTokens() {
  const style = getComputedStyle(document.documentElement);
  const get = (name) => style.getPropertyValue(name).trim() || "#888888";
  return { warm: get("--warm"), cold: get("--cold"), faint: get("--cold-faint") };
}

// Raw sRGB triplet for the custom shader, which writes colours without conversion.
function rawRGB(hex) {
  const c = new Color();
  c.setStyle(hex);
  c.convertLinearToSRGB();
  return new Vector3(c.r, c.g, c.b);
}

// Deterministic pseudo-random numbers, so every visitor sees the same picture.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function startScene(host, { reducedMotion = false, onActivate = () => {} } = {}) {
  const random = seeded(23);
  const tokens = readTokens();
  const stage = host.closest(".stage");

  // HTML layers: washes behind the canvas, labels in front.
  const washLayer = make("div", "stage__washes");
  const labelLayer = make("div", "stage__labels");
  const washes = CLUSTERS.map(() => washLayer.appendChild(make("span", "wash")));
  const clusterLabels = CLUSTERS.map((name) => labelLayer.appendChild(make("span", "tag tag--cluster", name)));
  const youLabel = labelLayer.appendChild(make("span", "tag tag--you", "You"));
  const personLabel = labelLayer.appendChild(make("span", "tag tag--person", ""));

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(washLayer, renderer.domElement, labelLayer);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  const world = new Group();
  scene.add(world);

  // Per-point data. Unit offsets are kept so the layout can be rebuilt for wide and tall stages.
  const positions = new Float32Array(TOTAL * 3);
  const from = new Float32Array(TOTAL * 3);
  const sizes = new Float32Array(TOTAL);
  const baseSize = new Float32Array(TOTAL);
  const warmth = new Float32Array(TOTAL);
  const warmTarget = new Float32Array(TOTAL);
  const kinds = new Float32Array(TOTAL);
  const phases = new Float32Array(TOTAL);
  const unitOffset = [];
  const unitFrom = [];

  for (let i = 0; i < TOTAL; i++) {
    phases[i] = random() * 6.283;
    const u = random();
    const v = random();
    const r = Math.cbrt(random());
    const theta = u * 6.283;
    const phi = Math.acos(2 * v - 1);
    unitOffset.push(new Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)));
    unitFrom.push(new Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1));
    if (i < MEMORIES) {
      baseSize[i] = 5 + random() * 5;
    } else if (i < YOU) {
      kinds[i] = KIND.ring;
      baseSize[i] = 20;
    }
  }
  kinds[YOU] = KIND.dot;
  baseSize[YOU] = 16;
  kinds[YOU + 1] = KIND.glow;
  baseSize[YOU + 1] = 110;
  warmth[YOU] = warmth[YOU + 1] = warmTarget[YOU] = warmTarget[YOU + 1] = 1;
  sizes.set(baseSize);

  const geometry = new BufferGeometry();
  const positionAttr = new BufferAttribute(positions, 3);
  const fromAttr = new BufferAttribute(from, 3);
  const sizeAttr = new BufferAttribute(sizes, 1);
  const warmAttr = new BufferAttribute(warmth, 1);
  geometry.setAttribute("position", positionAttr);
  geometry.setAttribute("aFrom", fromAttr);
  geometry.setAttribute("aSize", sizeAttr);
  geometry.setAttribute("aWarm", warmAttr);
  geometry.setAttribute("aKind", new BufferAttribute(kinds, 1));
  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uPixel: { value: 1 },
      uGather: { value: reducedMotion ? 1 : 0 },
      uTime: { value: 0 },
      uDist: { value: 10 },
      uCold: { value: rawRGB(tokens.cold) },
      uWarm: { value: rawRGB(tokens.warm) },
    },
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;

  const linkPositions = new Float32Array(PEOPLE.length * 2 * 6);
  const linkGeometry = new BufferGeometry();
  const linkAttr = new BufferAttribute(linkPositions, 3);
  linkGeometry.setAttribute("position", linkAttr);
  const linkMaterial = new LineBasicMaterial({ color: new Color(tokens.faint), transparent: true, opacity: 0 });
  const links = new LineSegments(linkGeometry, linkMaterial);
  links.frustumCulled = false;
  links.renderOrder = 1;

  const arcs = [0, 1, 2].map(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(ARC_POINTS * 3), 3));
    g.setDrawRange(0, 0);
    const line = new Line(g, new LineBasicMaterial({ color: new Color(tokens.warm), transparent: true, opacity: 0.95 }));
    line.frustumCulled = false;
    line.renderOrder = 2;
    return line;
  });
  world.add(links, ...arcs, points);

  // Layout: clusters on an ellipse around you, people between the two interests they share.
  const centers = CLUSTERS.map(() => new Vector3());
  const people = PEOPLE.map(() => new Vector3());
  let extent = { x: 3.3, y: 1.9 };

  function layout(tall) {
    const rx = tall ? 1.2 : 2.75;
    const ry = tall ? 2.05 : 1.2;
    extent = { x: rx + 1.0, y: ry + 1.0 };
    centers.forEach((c, k) => {
      const angle = -Math.PI / 2 + (k / CLUSTERS.length) * Math.PI * 2 + (tall ? 0 : 0.3);
      c.set(Math.cos(angle) * rx, -Math.sin(angle) * ry, k % 2 ? 0.35 : -0.35);
    });
    for (let i = 0; i < MEMORIES; i++) {
      const c = centers[Math.floor(i / PER_CLUSTER)];
      const o = unitOffset[i];
      positions.set([c.x + o.x * CLUSTER_RADIUS, c.y + o.y * CLUSTER_RADIUS, c.z + o.z * CLUSTER_RADIUS], i * 3);
      from.set([unitFrom[i].x * extent.x, unitFrom[i].y * extent.y, unitFrom[i].z * 1.4], i * 3);
    }
    PEOPLE.forEach((person, p) => {
      const [a, b] = person.clusters.map((k) => centers[k]);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const out = mid.clone().setZ(0);
      const length = out.length() || 1;
      mid.add(out.multiplyScalar(0.85 / length)).setZ(0.5);
      people[p].copy(mid);
      const i = MEMORIES + p;
      positions.set([mid.x, mid.y, mid.z], i * 3);
      from.set([mid.x * 1.6, mid.y * 1.6, 2], i * 3);
      linkPositions.set([mid.x, mid.y, mid.z, a.x, a.y, a.z, mid.x, mid.y, mid.z, b.x, b.y, b.z], p * 12);
    });
    positions.set([0, 0, 0.2, 0, 0, 0.2], YOU * 3);
    from.set([0, 0, 0.2, 0, 0, 0.2], YOU * 3);
    positionAttr.needsUpdate = fromAttr.needsUpdate = linkAttr.needsUpdate = true;
  }

  // The person in focus.
  let active = -1;
  let activatedAt = 0;

  function setArc(line, a, b, lift) {
    const control = a.clone().add(b).multiplyScalar(0.5);
    control.z += lift;
    const pts = new QuadraticBezierCurve3(a, control, b).getPoints(ARC_POINTS - 1);
    const attr = line.geometry.getAttribute("position");
    pts.forEach((p, i) => attr.setXYZ(i, p.x, p.y, p.z));
    attr.needsUpdate = true;
  }

  function activate(index, now, instant) {
    active = index;
    activatedAt = instant ? now - DRAW_MS : now;
    const person = PEOPLE[index];
    for (let i = 0; i < MEMORIES; i++) {
      warmTarget[i] = person.clusters.includes(Math.floor(i / PER_CLUSTER)) ? 0.8 : 0;
    }
    PEOPLE.forEach((_, p) => (warmTarget[MEMORIES + p] = p === index ? 1 : 0));
    if (instant) warmth.set(warmTarget);
    const here = people[index];
    setArc(arcs[0], new Vector3(0, 0, 0.2), here, 0.7);
    setArc(arcs[1], here, centers[person.clusters[0]], 0.5);
    setArc(arcs[2], here, centers[person.clusters[1]], 0.5);
    washes.forEach((wash, k) => wash.classList.toggle("is-warm", person.clusters.includes(k)));
    personLabel.textContent = firstName(person);
    onActivate(index);
  }

  // Sizing and HTML overlay placement.
  let width = 0;
  let height = 0;
  let tall = null;
  const probe = new Vector3();

  function resize() {
    const box = host.getBoundingClientRect();
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.round(box.height));
    const nowTall = width / height < 0.95;
    if (nowTall !== tall) {
      tall = nowTall;
      layout(tall);
      if (active >= 0) activate(active, performance.now(), true);
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const half = Math.tan((camera.fov * Math.PI) / 360);
    const dist = Math.max(extent.y / half, extent.x / (half * camera.aspect));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    material.uniforms.uDist.value = dist;
    material.uniforms.uPixel.value = dpr * Math.max(0.7, Math.min(1.15, width / 900));
  }

  function place(node, point, dx, dy, anchorX, anchorY) {
    probe.copy(point).applyMatrix4(world.matrixWorld).project(camera);
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    let x = (probe.x * 0.5 + 0.5) * width + dx - w * anchorX;
    let y = (-probe.y * 0.5 + 0.5) * height + dy - h * anchorY;
    x = Math.max(2, Math.min(width - w - 2, x));
    y = Math.max(2, Math.min(height - h - 2, y));
    node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  function placeOverlays() {
    world.updateMatrixWorld();
    const unit = (height / (2 * extent.y)) * CLUSTER_RADIUS; // cluster radius in CSS px
    centers.forEach((c, k) => {
      const size = unit * 3.4;
      washes[k].style.width = washes[k].style.height = `${size.toFixed(0)}px`;
      place(washes[k], c, 0, 0, 0.5, 0.5);
      // Labels sit on the outer side of each cluster, pointing away from you, so they stay
      // clear of the people, who sit between clusters.
      const reach = Math.hypot(c.x, c.y) || 1;
      const ox = c.x / reach;
      const oy = c.y / reach;
      const gap = unit * 1.2 + 6;
      place(clusterLabels[k], c, ox * gap, -oy * gap, 0.5 - ox * 0.5, 0.5 + oy * 0.5);
    });
    place(youLabel, new Vector3(0, 0, 0.2), 0, 14, 0.5, 0);
    if (active >= 0) {
      // The name goes on the outer side of the node, away from the clusters.
      const right = people[active].x >= 0;
      place(personLabel, people[active], right ? 18 : -18, 0, right ? 0 : 1, 0.5);
    }
  }

  function applyTheme() {
    const t = readTokens();
    material.uniforms.uCold.value = rawRGB(t.cold);
    material.uniforms.uWarm.value = rawRGB(t.warm);
    linkMaterial.color.set(t.faint);
    for (const arc of arcs) arc.material.color.set(t.warm);
  }

  let frames = 0;
  function render() {
    placeOverlays();
    renderer.render(scene, camera);
    frames += 1;
    host.dataset.frames = String(frames);
    if (frames <= 120 && !(Number(host.dataset.lit) > 0)) {
      // Count lit pixels until the canvas has drawn something, so automated checks can tell it works.
      // Sampled on early frames only; the first frame can be blank while the canvas is still sizing.
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let lit = 0;
      for (let i = 3; i < pixels.length; i += 16) if (pixels[i] > 0) lit++;
      host.dataset.lit = String(lit);
    }
  }

  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  world.rotation.set(0.1, 0, 0);

  if (reducedMotion) {
    // One still frame: everything gathered, the first person in focus.
    linkMaterial.opacity = 0.9;
    const still = () => {
      resize();
      if (active < 0) activate(0, 0, true);
      for (let i = 0; i < TOTAL; i++) sizes[i] = baseSize[i] * (1 + warmth[i] * (i < MEMORIES ? 0.35 : 0.3));
      sizeAttr.needsUpdate = warmAttr.needsUpdate = true;
      arcs.forEach((arc) => arc.geometry.setDrawRange(0, ARC_POINTS));
      render();
    };
    still();
    new ResizeObserver(still).observe(host);
    scheme.addEventListener("change", () => {
      applyTheme();
      render();
    });
    stage.classList.add("stage--ready");
    host.dataset.state = "static";
    return;
  }

  resize();
  new ResizeObserver(resize).observe(host);
  scheme.addEventListener("change", applyTheme);

  let visible = true;
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(host);

  // Drag turns the picture a little; it eases back when released.
  let dragX = null;
  let yaw = 0;
  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", (e) => {
    dragX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (dragX === null) return;
    yaw = Math.max(-0.7, Math.min(0.7, yaw + (e.clientX - dragX) * 0.004));
    dragX = e.clientX;
  });
  const release = () => (dragX = null);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  const start = performance.now();
  let last = start;
  let clock = 0;
  let nextAt = 0;
  let nextPerson = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden) return;
    clock += dt;

    const gather = Math.min(1, (clock * 1000) / GATHER_MS);
    const eased = 1 - Math.pow(1 - gather, 3);
    material.uniforms.uGather.value = eased;
    material.uniforms.uTime.value = clock;
    linkMaterial.opacity = Math.max(0, eased - 0.6) * 2.25;
    if (gather >= 1 && !stage.classList.contains("stage--ready")) stage.classList.add("stage--ready");

    if (gather >= 1 && clock * 1000 >= nextAt) {
      activate(nextPerson % PEOPLE.length, now, false);
      nextPerson += 1;
      nextAt = clock * 1000 + EVERY_MS;
    }

    if (dragX === null) yaw += (0 - yaw) * Math.min(1, dt * 1.2);
    world.rotation.y = Math.sin(clock * 0.25) * 0.2 + yaw;
    world.rotation.x = 0.1 + Math.sin(clock * 0.2) * 0.04;

    if (active >= 0) {
      const t = Math.min(1, (now - activatedAt) / DRAW_MS);
      arcs[0].geometry.setDrawRange(0, Math.ceil(t * ARC_POINTS));
      const t2 = Math.max(0, Math.min(1, (now - activatedAt - DRAW_MS * 0.6) / DRAW_MS));
      arcs[1].geometry.setDrawRange(0, Math.ceil(t2 * ARC_POINTS));
      arcs[2].geometry.setDrawRange(0, Math.ceil(t2 * ARC_POINTS));
    }

    const ease = Math.min(1, dt * 3);
    for (let i = 0; i < YOU; i++) {
      warmth[i] += (warmTarget[i] - warmth[i]) * ease;
      sizes[i] = baseSize[i] * (1 + warmth[i] * (i < MEMORIES ? 0.35 : 0.3));
    }
    sizes[YOU + 1] = baseSize[YOU + 1] * (1 + Math.sin(clock * 1.1) * 0.08);
    warmAttr.needsUpdate = sizeAttr.needsUpdate = true;

    render();
  }

  host.dataset.state = "running";
  requestAnimationFrame(frame);
}
