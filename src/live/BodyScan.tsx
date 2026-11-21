/*
 * Full-body checkup: the overlay opened by the status button on the Live page.
 * It grows out of the button, scans a glowing hologram body while it checks each reading one by
 * one, then shows the verdict. The verdict is also saved so the chatbot can answer "am I healthy?".
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { StatusDot } from "@/components/ui/glyph";
import { sfx } from "@/lib/sound";

export type Status = "NORMAL" | "WATCH" | "ACT";
export type Check = { label: string; value: string | null; status: Status | null; normal: string };

const STEP_MS = 650;
const TONE = { NORMAL: "normal", WATCH: "watch", ACT: "act" } as const;
const COLOR: Record<Status, string> = { NORMAL: "#059669", WATCH: "#d97706", ACT: "#dc2626" };
const TEXT: Record<Status, string> = { NORMAL: "text-ok", WATCH: "text-watch", ACT: "text-act" };
const WORD: Record<Status, string> = { NORMAL: "Normal", WATCH: "Watch", ACT: "Act now" };
const VERDICT: Record<Status, [string, string]> = {
  NORMAL: ["Healthy", "Everything VITALS checked is in the normal range. Keep it up."],
  WATCH: ["Keep an eye on it", "Something is in the watch range. Fix it today and check again later."],
  ACT: ["Act now", "A reading is outside both ranges. Deal with it now and contact the flight surgeon."],
};

export function verdictOf(checks: Check[]): Status | null {
  const s = checks.map((c) => c.status).filter(Boolean) as Status[];
  return s.length ? (s.includes("ACT") ? "ACT" : s.includes("WATCH") ? "WATCH" : "NORMAL") : null;
}

/* Hologram skin: glows at the edges (fresnel), faint moving scan lines, and a bright band where the scanner is. */
const HOLO_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vY = wp.y;
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const HOLO_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uScan; uniform float uTime;
  varying vec3 vN; varying vec3 vV; varying float vY;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    float band = smoothstep(0.12, 0.0, abs(vY - uScan));
    float lines = step(0.85, fract(vY * 45.0 - uTime * 0.6)) * 0.18;
    float a = 0.1 + rim * 1.2 + band * 1.1 + lines;
    gl_FragColor = vec4(uColor * (1.2 + band * 2.0), a);
  }`;

/** A human figure about 2.5 units tall (feet at -1.25), built from smooth primitives. */
function humanGeometries(): THREE.BufferGeometry[] {
  const g: THREE.BufferGeometry[] = [];
  const at = (geo: THREE.BufferGeometry, x: number, y: number, z = 0, rz = 0, rx = 0, s: [number, number, number] = [1, 1, 1]) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(...s));
    g.push(geo.applyMatrix4(m));
  };
  at(new THREE.SphereGeometry(0.15, 28, 20), 0, 1.08, 0, 0, 0, [0.88, 1.1, 0.95]); // head
  at(new THREE.CylinderGeometry(0.055, 0.065, 0.14, 16), 0, 0.9); // neck
  // torso: hips to shoulders, a lathe profile flattened front to back
  const profile = [[0, 0], [0.17, 0.02], [0.2, 0.12], [0.17, 0.32], [0.18, 0.48], [0.24, 0.68], [0.25, 0.76], [0.16, 0.82], [0.06, 0.86], [0, 0.86]];
  at(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 32), 0, -0.04, 0, 0, 0, [1, 1, 0.62]);
  for (const s of [-1, 1]) {
    at(new THREE.SphereGeometry(0.075, 16, 12), s * 0.27, 0.7); // shoulder
    at(new THREE.CapsuleGeometry(0.06, 0.34, 6, 14), s * 0.31, 0.5, 0, s * 0.12); // upper arm
    at(new THREE.CapsuleGeometry(0.05, 0.32, 6, 14), s * 0.36, 0.08, 0.02, s * 0.06); // forearm
    at(new THREE.SphereGeometry(0.055, 14, 10), s * 0.375, -0.18, 0.02, 0, 0, [0.75, 1.35, 0.5]); // hand
    at(new THREE.CapsuleGeometry(0.085, 0.42, 6, 16), s * 0.1, -0.34, 0, s * -0.03); // thigh
    at(new THREE.CapsuleGeometry(0.06, 0.42, 6, 14), s * 0.105, -0.86, 0); // shin
    at(new THREE.CapsuleGeometry(0.045, 0.12, 4, 10), s * 0.105, -1.2, 0.07, 0, Math.PI / 2); // foot
  }
  return g;
}

/** The hologram: a glowing human turning on a platform, a scanner sweeping head to toe, a beating heart. */
function Hologram({ color, bpm }: { color: string; bpm: number }) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ color, bpm });
  live.current = { color, bpm };
  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000); // pure black survives the colour-space conversion; the overlay background is near-black too
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    const tint = new THREE.Color(live.current.color);
    const target = new THREE.Color();
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;
    const disposables: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(x: T) => {
      disposables.push(x);
      return x;
    };

    const uniforms = { uColor: { value: tint }, uScan: { value: 1.3 }, uTime: { value: 0 } };
    const skin = keep(new THREE.ShaderMaterial({ uniforms, vertexShader: HOLO_VERT, fragmentShader: HOLO_FRAG, ...additive, depthFunc: THREE.LessEqualDepth }));
    // depth-only pre-pass: hides where body parts overlap, so the body reads as one smooth silhouette
    const depthOnly = keep(new THREE.MeshBasicMaterial({ colorWrite: false }));
    const body = new THREE.Group();
    for (const geo of humanGeometries()) {
      keep(geo);
      const pre = new THREE.Mesh(geo, depthOnly);
      pre.renderOrder = -1;
      body.add(pre, new THREE.Mesh(geo, skin));
    }

    // heart: a small core that beats at the measured heart rate, with a soft halo
    const heart = new THREE.Mesh(keep(new THREE.SphereGeometry(0.045, 20, 14)), keep(new THREE.MeshBasicMaterial({ color: "#ff5a7a", opacity: 0.95, ...additive, depthTest: false })));
    const halo = new THREE.Mesh(keep(new THREE.SphereGeometry(0.09, 20, 14)), keep(new THREE.MeshBasicMaterial({ color: "#ff5a7a", opacity: 0.25, ...additive, depthTest: false })));
    heart.position.set(0.04, 0.52, 0.05);
    halo.position.copy(heart.position);
    body.add(heart, halo);

    // scanner: a glowing disc and its rim
    const lineMat = keep(new THREE.MeshBasicMaterial({ color: tint, opacity: 0.9, side: THREE.DoubleSide, ...additive }));
    const scanRim = new THREE.Mesh(keep(new THREE.RingGeometry(0.62, 0.635, 96)), lineMat);
    const scanDisc = new THREE.Mesh(keep(new THREE.CircleGeometry(0.62, 64)), keep(new THREE.MeshBasicMaterial({ color: tint, opacity: 0.07, side: THREE.DoubleSide, ...additive })));
    for (const m of [scanRim, scanDisc]) m.rotation.x = -Math.PI / 2;

    // platform: two rings turning in opposite directions, tick marks and a soft glow
    const platform = new THREE.Group();
    platform.position.y = -1.3;
    const ringA = new THREE.Mesh(keep(new THREE.RingGeometry(0.7, 0.715, 128)), lineMat);
    const ringB = new THREE.Mesh(keep(new THREE.RingGeometry(0.82, 0.86, 128, 1, 0, Math.PI * 1.6)), lineMat);
    const ticks = new THREE.Mesh(keep(new THREE.RingGeometry(0.92, 0.96, 72, 1)), keep(new THREE.MeshBasicMaterial({ color: tint, opacity: 0.35, wireframe: true, ...additive })));
    const glow = new THREE.Mesh(keep(new THREE.CircleGeometry(0.7, 64)), keep(new THREE.MeshBasicMaterial({ color: tint, opacity: 0.12, side: THREE.DoubleSide, ...additive })));
    for (const m of [ringA, ringB, ticks, glow]) {
      m.rotation.x = -Math.PI / 2;
      platform.add(m);
    }

    // particles drifting up around the body
    const N = 220;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.45 + Math.random() * 0.55;
      pos.set([Math.cos(a) * r, -1.3 + Math.random() * 2.7, Math.sin(a) * r], i * 3);
    }
    const sparkGeo = keep(new THREE.BufferGeometry());
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const sparks = new THREE.Points(sparkGeo, keep(new THREE.PointsMaterial({ color: tint, size: 0.018, opacity: 0.6, ...additive })));

    scene.add(body, scanRim, scanDisc, platform, sparks);
    const composer = new EffectComposer(renderer);
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.1, 0, 0.3);
    // only the tight blur levels: the wide ones smear a grey haze over the whole canvas
    bloom.compositeMaterial.uniforms.bloomFactors.value = [1.0, 0.7, 0.3, 0.0, 0.0];
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    keep(composer);
    const tinted = [lineMat, scanDisc.material, ticks.material, glow.material, sparks.material] as (THREE.MeshBasicMaterial | THREE.PointsMaterial)[];

    const fit = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      camera.aspect = w / h;
      // pull back on narrow boxes so the whole body and platform stay in view
      camera.position.set(0, 0.35, 5.4 / Math.min(1, camera.aspect / 0.62));
      camera.lookAt(0, -0.05, 0);
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      tint.lerp(target.set(live.current.color), 0.06); // fade to the verdict colour
      for (const m of tinted) m.color.copy(tint);
      uniforms.uTime.value = t;
      const scanY = 1.3 - (0.5 - 0.5 * Math.cos(t * 1.6)) * 2.6; // eases head -> toe -> head
      uniforms.uScan.value = scanY;
      scanRim.position.y = scanDisc.position.y = scanY;
      body.rotation.y = t * 0.45;
      body.position.y = Math.sin(t * 1.2) * 0.02;
      ringA.rotation.z = t * 0.5;
      ringB.rotation.z = -t * 0.8;
      ticks.rotation.z = t * 0.15;
      const beat = (t * live.current.bpm) / 60;
      const pulse = Math.exp(-(beat % 1) * 9) + 0.5 * Math.exp(-((beat + 0.72) % 1) * 9); // lub-dub
      heart.scale.setScalar(1 + pulse * 0.45);
      halo.scale.setScalar(1 + pulse * 0.9);
      for (let i = 1; i < pos.length; i += 3) pos[i] = pos[i] > 1.4 ? -1.3 : pos[i] + 0.004;
      sparkGeo.attributes.position.needsUpdate = true;
      composer.render();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);
  return (
    <div className="relative h-full w-full">
      <div ref={host} className="relative h-full w-full" style={{ maskImage: "radial-gradient(closest-side, black 75%, transparent)", WebkitMaskImage: "radial-gradient(closest-side, black 75%, transparent)" }} aria-hidden="true" />
    </div>
  );
}

/** What to do for a reading in Watch or Act now (no medicines: those are the flight surgeon's call). */
const REMEDY: Record<string, string> = {
  "Heart rate": "Sit still for 5 minutes, breathe slowly, drink some water, then check again.",
  "Blood oxygen (SpO2)": "Sit upright and take slow deep breaths. Check the cabin air and CO2 scrubber, warm your hand, and recheck with a still finger.",
  "ECG heart rate": "Rest for 5 minutes and recheck with the electrodes firmly attached. Note any palpitations or chest discomfort.",
  Water: "Drink a full pouch (about 250 ml) now and sip regularly through the day.",
  Sleep: "Take a 20-minute nap if you can, and protect a full sleep period tonight: lights dim, screens off.",
  Exercise: "Do your planned exercise session today; even 20 minutes on the treadmill or bike helps.",
  "Room temperature": "Adjust the cabin temperature setting, and add or remove a layer.",
  Humidity: "Adjust the humidity control. If it's damp, check for mould; if it's dry, moisturise your skin and drink more.",
};
const remedyFor = (label: string) => REMEDY[label.replace(" (simulated)", "")];

export default function BodyScan({ checks, origin, onClose }: { checks: Check[]; origin: { x: number; y: number }; onClose: () => void }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [open, setOpen] = useState(reduced);
  const [done, setDone] = useState(reduced ? checks.length : 0);
  const finished = done >= checks.length;
  const verdict = verdictOf(checks);

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true)); // start the grow-from-the-button transition
    const t = setInterval(() => setDone((n) => n + 1), STEP_MS);
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    document.body.dataset.immersive = "1"; // the 3D scan gets the frame time: background grid paused, nav hidden
    return () => {
      delete document.body.dataset.immersive;
      clearInterval(t);
      removeEventListener("keydown", key);
    };
  }, [onClose]);

  // sound: the scanner sweeps, each reading answers with its status, the verdict closes it
  useEffect(() => {
    if (!reduced) sfx("scan");
  }, [reduced]);
  useEffect(() => {
    const c = checks[done - 1];
    if (c?.status && !finished) sfx(TONE[c.status]);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!finished) return;
    if (verdict) sfx(verdict === "NORMAL" ? "good" : TONE[verdict]);
    try {
      localStorage.setItem("vitals-checkup", JSON.stringify({ at: Date.now(), verdict, checks }));
    } catch {
      /* storage blocked: the chatbot just won't know the last checkup */
    }
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const tint = finished && verdict ? COLOR[verdict] : "#dc2626";
  const [title, text] = verdict ? VERDICT[verdict] : ["Not enough data", "No readings yet. Connect the sensor or fill in the daily log, then check again."];

  // portal: a transformed parent on the Live page would trap position:fixed
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full-body checkup"
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#fffbfb]"
      style={{ clipPath: `circle(${open ? "150%" : "0%"} at ${origin.x}px ${origin.y}px)`, transition: reduced ? undefined : "clip-path 700ms cubic-bezier(.7,0,.2,1)" }}
    >
      <div className="mx-auto grid min-h-full max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1fr_1fr]">
        <div className={`relative mx-auto h-[50vh] w-full max-w-[420px] lg:h-auto lg:aspect-[3/4] transition-all duration-700 ${finished ? "lg:scale-90 opacity-80" : ""}`}>
          <Hologram color={tint} bpm={parseFloat(checks.find((c) => c.label === "Heart rate")?.value ?? "") || 70} />
          {!finished && <p className="absolute inset-x-0 bottom-0 text-center text-sm tracking-widest text-sky-300/80">SCANNING…</p>}
        </div>

        <div className="space-y-5">
          <div className={`transition-all duration-500 ${finished ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`} aria-live="polite">
            <p className="text-sm uppercase tracking-widest text-white/50">Full-body checkup</p>
            <p className={`mt-1 text-4xl font-bold tracking-tight ${verdict ? TEXT[verdict] : "text-white/80"}`}>{finished ? title : " "}</p>
            <p className="mt-2 text-white/70">{finished ? text : " "}</p>
          </div>
          <ul className="space-y-2.5">
            {checks.map((c, i) => (
              <li
                key={c.label}
                className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-all duration-300 ${i < done ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
              >
                {c.status ? <StatusDot status={c.status} /> : <i className="h-2.5 w-2.5 rounded-full bg-white/25" />}
                <span className="flex-1 font-medium">{c.label}</span>
                <span className="text-right text-sm">
                  <span className="font-semibold">{c.value ?? "Not measured"}</span>
                  <span className="block text-xs text-white/50">{c.status ? `${WORD[c.status]} · target ${c.normal}` : `target ${c.normal}`}</span>
                </span>
              </li>
            ))}
          </ul>
          {finished && checks.some((c) => c.status === "WATCH" || c.status === "ACT") && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm uppercase tracking-widest text-white/50">What to do</p>
              {checks
                .filter((c) => (c.status === "WATCH" || c.status === "ACT") && remedyFor(c.label))
                .map((c) => (
                  <p key={c.label} className="text-sm text-white/80">
                    <span className={`font-semibold ${TEXT[c.status!]}`}>{c.label}:</span> {remedyFor(c.label)}
                    {c.status === "ACT" && " If it doesn't improve, or you feel unwell, contact the flight surgeon now."}
                  </p>
                ))}
            </div>
          )}
          <LiquidButton type="button" onClick={onClose} className={`h-11 rounded-full bg-primary/25 px-6 font-semibold text-white transition-opacity ${finished ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            Back to live monitor
          </LiquidButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
