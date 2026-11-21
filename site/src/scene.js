// The hero animation: your network as a slowly turning cloud of contacts.
// Most contacts are cold. Every few seconds one warms up and a line draws from you to them.
// Colours come from the page's CSS tokens, so light and dark mode match the rest of the site.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
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

const NODE_COUNT = 150;
const RADIUS = 2.1;
const ARC_POINTS = 56;
const MAX_WARM = 6;
const EVERY_MS = 3400;
const DRAW_MS = 900;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aWarm;
  attribute float aSoft;
  uniform float uPixel;
  uniform vec3 uCold;
  uniform vec3 uWarm;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float far = clamp((-mv.z - 6.0) / 4.0, 0.0, 1.0);
    vColor = mix(uCold, uWarm, aWarm);
    vAlpha = mix(1.0, 0.3, far) * mix(0.75, 1.0, aWarm);
    vSoft = aSoft;
    gl_PointSize = aSize * uPixel * (8.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float crisp = smoothstep(0.5, 0.36, d);
    float glow = pow(1.0 - d * 2.0, 2.2) * 0.35;
    gl_FragColor = vec4(vColor, mix(crisp, glow, vSoft) * vAlpha);
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

// Deterministic pseudo-random numbers, so every visitor sees the same network.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildNodes(random) {
  const nodes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NODE_COUNT; i++) {
    const y = 1 - (i / (NODE_COUNT - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = golden * i + random() * 0.4;
    const r = RADIUS * (0.72 + random() * 0.33);
    nodes.push(new Vector3(Math.cos(theta) * ring * r, y * r * 0.82, Math.sin(theta) * ring * r));
  }
  return nodes;
}

function buildLinks(nodes) {
  const seen = new Set();
  const positions = [];
  nodes.forEach((a, i) => {
    const nearest = nodes
      .map((b, j) => ({ j, d: a.distanceToSquared(b) }))
      .filter(({ j }) => j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, 2);
    for (const { j } of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      positions.push(a.x, a.y, a.z, nodes[j].x, nodes[j].y, nodes[j].z);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

function arcPoints(target, random) {
  const dir = target.clone().normalize();
  const side = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).cross(dir).normalize();
  const control = target.clone().multiplyScalar(0.5).add(side.multiplyScalar(target.length() * 0.45));
  return new QuadraticBezierCurve3(new Vector3(), control, target).getPoints(ARC_POINTS - 1);
}

export function startScene(host, { reducedMotion = false, onWarm = () => {} } = {}) {
  const random = seeded(7);
  const tokens = readTokens();

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 50);
  const world = new Group();
  world.rotation.set(0.32, 0.6, 0);
  scene.add(world);

  // Contacts, plus "you" and your glow at the centre (the last two points).
  const nodes = buildNodes(random);
  const count = NODE_COUNT + 2;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const warmth = new Float32Array(count);
  const soft = new Float32Array(count);
  const baseSize = new Float32Array(count);
  nodes.forEach((p, i) => {
    positions.set([p.x, p.y, p.z], i * 3);
    baseSize[i] = 5.5 + random() * 3.5;
  });
  baseSize[NODE_COUNT] = 17;
  baseSize[NODE_COUNT + 1] = 120;
  warmth[NODE_COUNT] = warmth[NODE_COUNT + 1] = 1;
  soft[NODE_COUNT + 1] = 1;
  sizes.set(baseSize);

  const pointGeometry = new BufferGeometry();
  pointGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  // BufferAttribute keeps a reference to these arrays, so writing to them updates the GPU copy.
  const sizeAttr = new BufferAttribute(sizes, 1);
  const warmAttr = new BufferAttribute(warmth, 1);
  pointGeometry.setAttribute("aSize", sizeAttr);
  pointGeometry.setAttribute("aWarm", warmAttr);
  pointGeometry.setAttribute("aSoft", new Float32BufferAttribute(soft, 1));

  const pointMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uPixel: { value: 1 },
      uCold: { value: rawRGB(tokens.cold) },
      uWarm: { value: rawRGB(tokens.warm) },
    },
  });
  const points = new Points(pointGeometry, pointMaterial);
  points.renderOrder = 2;

  const linkMaterial = new LineBasicMaterial({ color: new Color(tokens.faint), transparent: true, opacity: 0.7 });
  const links = new LineSegments(buildLinks(nodes), linkMaterial);
  world.add(links, points);

  // Lines from you to contacts that have warmed up again.
  const arcs = [];
  const warmTarget = new Float32Array(count);
  const pulse = new Float32Array(count);
  warmTarget[NODE_COUNT] = warmTarget[NODE_COUNT + 1] = 1;

  function addArc(index, now, drawn) {
    const geometry = new BufferGeometry().setFromPoints(arcPoints(nodes[index], random));
    geometry.setDrawRange(0, drawn ? ARC_POINTS : 0);
    const material = new LineBasicMaterial({ color: new Color(tokens.warm), transparent: true, opacity: 0.9 });
    const line = new Line(geometry, material);
    line.renderOrder = 1;
    world.add(line);
    arcs.push({ index, line, born: now, fading: false });
    warmTarget[index] = 1;
    pulse[index] = drawn ? 0 : 1;
    if (drawn) warmth[index] = 1;
  }

  const scratch = new Vector3();
  function pickCold() {
    const taken = new Set(arcs.map((a) => a.index));
    const candidates = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      if (taken.has(i) || warmth[i] > 0.05) continue;
      scratch.copy(nodes[i]).applyMatrix4(world.matrixWorld);
      if (scratch.z > 0.4 && scratch.x > -1.2) candidates.push(i); // facing the viewer, away from the caption
    }
    const pool = candidates.length ? candidates : [...Array(NODE_COUNT).keys()].filter((i) => !taken.has(i));
    return pool[Math.floor(random() * pool.length)];
  }

  function rekindle(now) {
    world.updateMatrixWorld();
    addArc(pickCold(), now, false);
    const live = arcs.filter((a) => !a.fading);
    if (live.length > MAX_WARM) {
      live[0].fading = true;
      live[0].fadeStart = now;
      warmTarget[live[0].index] = 0;
    }
    onWarm();
  }

  // Sizing
  let width = 0;
  let height = 0;
  function resize() {
    const box = host.getBoundingClientRect();
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.round(box.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    pointMaterial.uniforms.uPixel.value = dpr * Math.min(1, width / 520 + 0.2);
    camera.aspect = width / height;
    const fit = RADIUS * 1.18 / Math.sin((camera.fov * Math.PI) / 360);
    camera.position.set(0, 0, camera.aspect < 1 ? fit / camera.aspect : fit);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function applyTheme() {
    const t = readTokens();
    tokens.warm = t.warm;
    pointMaterial.uniforms.uCold.value = rawRGB(t.cold);
    pointMaterial.uniforms.uWarm.value = rawRGB(t.warm);
    linkMaterial.color.set(t.faint);
    for (const arc of arcs) arc.line.material.color.set(t.warm);
  }

  let frames = 0;
  function render() {
    renderer.render(scene, camera);
    frames += 1;
    host.dataset.frames = String(frames);
    if (frames === 1) {
      // Count lit pixels once, so automated checks can tell the canvas is drawing.
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

  // Interaction: drag to turn, pointer tilts slightly.
  let spin = 0.06;
  let dragX = null;
  let tiltTarget = 0;
  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", (e) => {
    dragX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const box = canvas.getBoundingClientRect();
    tiltTarget = ((e.clientY - box.top) / box.height - 0.5) * 0.35;
    if (dragX === null) return;
    world.rotation.y += (e.clientX - dragX) * 0.006;
    spin = (e.clientX - dragX) * 0.4;
    dragX = e.clientX;
  });
  const release = () => (dragX = null);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  const scheme = window.matchMedia("(prefers-color-scheme: dark)");

  if (reducedMotion) {
    // One still frame with a few contacts already warm.
    world.updateMatrixWorld();
    for (let k = 0; k < 5; k++) addArc(pickCold(), 0, true);
    for (let i = 0; i < NODE_COUNT; i++) sizes[i] = baseSize[i] * (1 + warmth[i] * 0.9);
    warmAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    const still = () => {
      resize();
      render();
    };
    new ResizeObserver(still).observe(host);
    scheme.addEventListener("change", () => {
      applyTheme();
      render();
    });
    host.dataset.state = "static";
    return;
  }

  resize();
  new ResizeObserver(resize).observe(host);
  scheme.addEventListener("change", applyTheme);

  let visible = true;
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(host);

  let last = performance.now();
  let nextAt = last + 900;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden) {
      nextAt = now + 600;
      return;
    }

    if (now >= nextAt) {
      rekindle(now);
      nextAt = now + EVERY_MS;
    }

    if (dragX === null) {
      spin += (0.06 - spin) * Math.min(1, dt * 1.5);
      world.rotation.y += spin * dt;
    }
    world.rotation.x += (0.32 + tiltTarget - world.rotation.x) * Math.min(1, dt * 2);

    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      const drawn = Math.min(1, (now - arc.born) / DRAW_MS);
      arc.line.geometry.setDrawRange(0, Math.ceil(drawn * ARC_POINTS));
      if (arc.fading) {
        const fade = 1 - Math.min(1, (now - arc.fadeStart) / 1500);
        arc.line.material.opacity = 0.9 * fade;
        if (fade <= 0) {
          world.remove(arc.line);
          arc.line.geometry.dispose();
          arc.line.material.dispose();
          arcs.splice(i, 1);
        }
      }
    }

    const ease = Math.min(1, dt * 2.5);
    for (let i = 0; i < NODE_COUNT; i++) {
      warmth[i] += (warmTarget[i] - warmth[i]) * ease;
      if (pulse[i] > 0) pulse[i] = Math.max(0, pulse[i] - dt * 0.9);
      sizes[i] = baseSize[i] * (1 + warmth[i] * 0.9 + Math.sin(pulse[i] * Math.PI) * 1.4);
    }
    const breath = 1 + Math.sin(now / 900) * 0.08;
    sizes[NODE_COUNT + 1] = baseSize[NODE_COUNT + 1] * breath;
    warmAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    render();
  }

  host.dataset.state = "running";
  requestAnimationFrame(frame);
}
