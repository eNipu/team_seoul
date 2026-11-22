"use client";

// The picture behind the join panel: two glass spheres slowly orbiting each other, with the
// volume they share lit up. Loaded on its own (next/dynamic, ssr: false) after the page is
// interactive; HeroBackdrop shows a CSS version until the first frame is drawn.

import { useEffect, useRef } from "react";
import { Color, Mesh, PerspectiveCamera, Scene, ShaderMaterial, SphereGeometry, Vector3, WebGLRenderer } from "three";

type Props = {
  /** Called once, after the first frame is on screen. */
  onReady: () => void;
  /** Called when WebGL is unavailable or the context is lost. */
  onFail: () => void;
};

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Glass by Fresnel: nearly clear face-on, tinted toward the rim. A fragment that
// lies inside the other sphere takes the shared color, which draws the lens.
// The silhouette fades out, so the edge is soft without multisampling.
const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uShared;
  uniform vec3 uOther;
  uniform float uRadius;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    float facing = clamp(dot(n, v), 0.0, 1.0);
    float rim = pow(1.0 - facing, 2.4);
    float edge = smoothstep(0.0, 0.2, facing);
    float inside = 1.0 - smoothstep(uRadius * 0.84, uRadius, distance(vWorld, uOther));
    vec3 light = normalize(vec3(-0.45, 0.75, 0.6));
    float sheen = pow(max(dot(reflect(-light, n), v), 0.0), 18.0);
    vec3 color = mix(uColor, uShared, inside);
    color = mix(color, vec3(1.0), sheen * 0.7);
    float alpha = 0.07 + 0.5 * rim + 0.26 * inside + 0.35 * sheen;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * edge);
    #include <colorspace_fragment>
  }
`;

const MAX_PIXEL_RATIO = 1.75;
// Below this width-to-height ratio the spheres sit one above the other, so one shows above
// the join panel and one below it. That is the case on a phone and in the desktop column.
const STACK_BELOW = 1.25;

export default function VennScene({ onReady, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
    } catch {
      onFail();
      return;
    }
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    el.appendChild(canvas);

    const token = (name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;
    const shared = new Color(token("--venn-shared", "#ff7a00"));
    const centers = [new Vector3(), new Vector3()];
    const geometry = new SphereGeometry(1, 48, 32);
    const glass = (color: string, other: Vector3) =>
      new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color(color) },
          uShared: { value: shared },
          uOther: { value: other },
          uRadius: { value: 1 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
      });
    const spheres = [
      new Mesh(geometry, glass(token("--venn-a", "#ffd400"), centers[1])),
      new Mesh(geometry, glass(token("--venn-b", "#eb0a0a"), centers[0])),
    ];

    const scene = new Scene();
    scene.add(...spheres);
    const camera = new PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0, 8);

    let radius = 1;
    let portrait = false;
    let frames = 0;
    let raf = 0;
    let onScreen = true;
    const started = performance.now();

    const draw = () => {
      const t = (performance.now() - started) / 1000;
      const angle = -0.35 + t * 0.1;
      const reach = radius * (0.56 + 0.06 * Math.sin(t * 0.37));
      // The pair sits one above the other in a tall or squarish space and side by side in a
      // wide one, and circles on a tilted orbit, so each sphere passes behind the other in turn.
      const along = reach * Math.cos(angle);
      const across = reach * 0.35 * Math.sin(angle);
      const depth = reach * 0.9 * Math.sin(angle);
      centers[0].set(portrait ? across : along, portrait ? along : across, depth);
      centers[1].copy(centers[0]).multiplyScalar(-1);
      spheres.forEach((sphere, i) => {
        sphere.position.copy(centers[i]);
        sphere.scale.setScalar(radius);
        (sphere.material as ShaderMaterial).uniforms.uRadius.value = radius;
      });
      renderer.render(scene, camera);
      frames += 1;
      el.dataset.frames = String(frames);
      if (frames === 1) onReady();
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      if (onScreen && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const visibleHeight = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
      const visibleWidth = visibleHeight * camera.aspect;
      portrait = camera.aspect < STACK_BELOW;
      radius = portrait ? Math.min(visibleWidth * 0.46, visibleHeight * 0.28) : Math.min(visibleWidth * 0.3, visibleHeight * 0.36);
      draw();
    };

    const sizes = new ResizeObserver(resize);
    sizes.observe(el);
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      play();
    });
    visibility.observe(el);
    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      onFail();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    document.addEventListener("visibilitychange", play);

    resize();
    play();

    return () => {
      cancelAnimationFrame(raf);
      sizes.disconnect();
      visibility.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      document.removeEventListener("visibilitychange", play);
      geometry.dispose();
      spheres.forEach((sphere) => (sphere.material as ShaderMaterial).dispose());
      renderer.dispose();
      canvas.remove();
    };
    // Both callbacks are stable (useCallback in HeroBackdrop), so this runs once.
  }, [onReady, onFail]);

  return <div ref={host} className="venn-scene" />;
}
