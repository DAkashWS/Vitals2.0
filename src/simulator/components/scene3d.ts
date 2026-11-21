/*
 * Scenario simulator: the 3D scene (plain three.js, no React).
 *
 * The models are built by tools/blender/build_models.py into public/models/ (served with the site):
 *   interior.glb   an ISS-style laboratory module with the clickable objects (CO2 scrubber, water unit,
 *                  hatch to the storm shelter, medical kit, sleep station, window), shadows baked in
 *   exterior.glb   NASA's ISS model, with the airlock and three task sites for the spacewalk
 *   astronaut.glb  NASA's EMU spacesuit
 * This file loads them, finds their parts by name, and every frame reads the simulation through
 * getView() to drive each scenario's effects:
 *   co2         haze thickens, lights go amber then flashing red
 *   smoke       the same haze, darker, driven by cabin carbon monoxide
 *   radiation   windows pulse with a sun-flare glow, the astronaut moves into the shelter
 *   dehydration warm dim light, the visor fogs, the water unit sits empty until refilled
 *   sleep       the camera sways, the view blurs and lights flicker as sleep debt grows
 *   spacewalk   tether on or loose, tasks turn green, the astronaut moves task to task
 * Drag to look around (orbit controls), W A S D to move (see "walking"); clicking an object calls onPick(objectId).
 * High quality adds bloom and anti-aliasing; low quality draws plainly at a lower resolution.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Status } from "@/simulator/simulation/engine";
import type { ObjectId, Scenario } from "@/simulator/simulation/types";

export type SceneView = {
  t: number;
  values: Record<string, number>;
  flags: Record<string, boolean>;
  status: Status;
  /** objects that have an action available right now: they glow softly */
  ready: ReadonlySet<ObjectId>;
};

export type SceneHandle = { setLow(low: boolean): void; dispose(): void };

type Options = {
  low: boolean;
  onPick: (id: ObjectId) => void;
  onHover: (id: ObjectId | null) => void;
  /** the models finished loading, or couldn't be loaded */
  onStatus?: (s: "ready" | "error") => void;
  /** the scene switched itself to low quality because frames were slow */
  onAutoLow?: () => void;
};

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const BASE = import.meta.env.BASE_URL;
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath(`${BASE}draco/`));
const loadModel = (name: string) => loader.loadAsync(`${BASE}models/${name}.glb`).then((g) => g.scene);

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Same numbers every time, so Earth's continents don't change between visits. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A soft round glow, for haze particles and the sun flare. */
const glowTexture = (inner: string, outer: string) =>
  canvasTexture(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });

const starsTexture = () =>
  canvasTexture(128, 128, (c) => {
    c.fillStyle = "#03061a";
    c.fillRect(0, 0, 128, 128);
    const r = rng(7);
    for (let i = 0; i < 60; i++) {
      c.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
      c.fillRect(r() * 128, r() * 128, 1.2, 1.2);
    }
  });

const STATUS_LIGHT: Record<Status, THREE.Color> = {
  green: new THREE.Color("#eaf3ff"),
  amber: new THREE.Color("#ffb347"),
  red: new THREE.Color("#ff3b2f"),
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Parts of a clickable object that never take the hover glow (lamps, glass, the water itself). */
const NO_GLOW = /Led|Lamp|Glass|^water$|^shade$/;

/* ------------------------------------------------------------------ */
/*  The scene                                                          */
/* ------------------------------------------------------------------ */

export function createScene(host: HTMLDivElement, sc: Scenario, getView: () => SceneView, opts: Options): SceneHandle {
  let low = opts.low;
  let disposed = false;
  let ready = false;
  const interior = sc.setting === "interior";
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const pixelRatio = () => (low ? 0.75 : Math.min(window.devicePixelRatio, 2));
  renderer.setPixelRatio(pixelRatio());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 1200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;

  // soft studio reflections on metal and glass; the status lights below do the real lighting
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  const ENV = interior ? 0.16 : 0.12;
  /** interior light levels at full power: the two ceiling lights, the fill by the hatch, the ambient */
  const POINT = [3.2, 3.2, 1.6];
  const HEMI = 0.38;
  scene.environmentIntensity = ENV;

  // high quality: bloom on lamps and screens, then anti-aliasing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), interior ? 0.35 : 0.3, 0.45, 1.15));
  composer.addPass(new SMAAPass(1, 1));
  composer.addPass(new OutputPass());

  /** Clickable objects: their root, and the materials that glow on hover or when an action is ready. */
  type Glow = { m: THREE.MeshStandardMaterial; base: THREE.Color };
  const pickables: { id: ObjectId; root: THREE.Object3D; mats: Glow[] }[] = [];
  const register = (id: ObjectId, root: THREE.Object3D | undefined) => {
    if (!root) return;
    root.userData.objectId = id;
    const mats: Glow[] = [];
    root.traverse((o) => {
      const part = o as THREE.Mesh;
      if (!part.isMesh || NO_GLOW.test(o.name) || !(part.material instanceof THREE.MeshStandardMaterial)) return;
      const m = part.material.clone(); // its own copy: the model shares materials between objects
      part.material = m;
      mats.push({ m, base: m.emissive.clone() });
    });
    pickables.push({ id, root, mats });
  };
  const has = (id: ObjectId) => sc.objects.includes(id);

  const astro = { group: new THREE.Group(), visorMat: new THREE.MeshStandardMaterial({ color: "#d9a441", metalness: 0.85, roughness: 0.18 }) };
  scene.add(astro.group);

  // Per-look things the frame loop drives; each stays null when not part of the scene.
  let lightMat: THREE.MeshStandardMaterial | null = null;
  let points: THREE.PointLight[] = [];
  let hemi: THREE.HemisphereLight;
  const windowMats: THREE.MeshBasicMaterial[] = [];
  const flares: THREE.Sprite[] = [];
  let flareLight: THREE.PointLight | null = null;
  let haze: THREE.Points | null = null;
  let hazeCount = 0;
  let water: THREE.Object3D | null = null;
  let scrubberLed: THREE.MeshBasicMaterial | null = null;
  let scrubberFan: THREE.Object3D | null = null;
  let hatchDoor: THREE.Object3D | null = null;
  let hatchLamp: THREE.MeshBasicMaterial | null = null;
  let shadeMesh: THREE.Object3D | null = null;
  // exterior
  let earth: THREE.Mesh | null = null;
  let stars: THREE.Points | null = null;
  let tether: THREE.Line | null = null;
  let looseTether: THREE.Line | null = null;
  const taskMarkers: Partial<Record<ObjectId, { ring: THREE.MeshBasicMaterial; spot: THREE.Vector3 }>> = {};
  const airlockSpot = new THREE.Vector3();
  const tetherFrom = new THREE.Vector3();
  const astroTarget = new THREE.Vector3();

  /** Swaps a named part's material for a plain glowing one that the frame loop recolours. */
  const lamp = (model: THREE.Object3D, name: string, color: string) => {
    const part = model.getObjectByName(name) as THREE.Mesh | undefined;
    if (!part?.isMesh) return null;
    const m = new THREE.MeshBasicMaterial({ color });
    part.material = m;
    return m;
  };
  const worldPos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

  if (interior) setupInterior();
  else setupExterior();

  Promise.all([loadModel(interior ? "interior" : "exterior"), loadModel("astronaut")])
    .then(([model, suit]) => {
      if (disposed) return;
      scene.add(model);
      model.updateMatrixWorld(true);
      astro.group.add(suit);
      suit.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m instanceof THREE.MeshStandardMaterial && m.name === "Visor") astro.visorMat = m;
      });
      if (interior) wireInterior(model);
      else wireExterior(model);
      astro.group.position.copy(astroTarget);
      ready = true;
      opts.onStatus?.("ready");
    })
    .catch((e) => {
      console.error("Simulator models failed to load", e);
      if (!disposed) opts.onStatus?.("error");
    });

  /* ---------------------------- interior ---------------------------- */
  function setupInterior() {
    scene.background = new THREE.Color("#05070d");
    hemi = new THREE.HemisphereLight("#dfe8ff", "#262b36", HEMI);
    scene.add(hemi);
    points = POINT.map((p, i) => new THREE.PointLight("#eaf3ff", p, i < 2 ? 20 : 14, 1.2));
    points[0].position.set(0, 1.9, -3.5);
    points[1].position.set(0, 1.9, 3.5);
    points[2].position.set(0, 0.4, -7);
    scene.add(...points);
    if (sc.look === "radiation") {
      flareLight = new THREE.PointLight("#ffb35c", 0, 12, 1.2);
      flareLight.position.set(1.4, 1.6, 0);
      scene.add(flareLight);
    }
    // CO2 haze (or smoke): soft particles that thicken as CO2 or CO climbs
    if (sc.look === "co2" || sc.look === "smoke") {
      const N = 1100;
      const pos = new Float32Array(N * 3);
      const r2 = rng(3);
      for (let i = 0; i < N; i++) {
        const a = r2() * Math.PI * 2;
        const rad = Math.sqrt(r2()) * 2.1;
        pos.set([Math.cos(a) * rad, Math.sin(a) * rad * 0.95, -7.5 + r2() * 15], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      haze = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ size: 0.22, map: glowTexture("rgba(255,255,255,0.9)", "rgba(255,255,255,0)"), color: sc.look === "smoke" ? "#8a8580" : "#cdbf9b", transparent: true, opacity: 0.1, depthWrite: false }),
      );
      hazeCount = N;
      scene.add(haze);
    }
    astroTarget.set(-0.4, -0.5, 0.8);
    camera.position.set(0.6, 0.6, 6.2);
    controls.target.set(0, -0.3, -0.5);
    controls.minDistance = 2;
    controls.maxDistance = 7;
  }

  function wireInterior(model: THREE.Object3D) {
    const get = (n: string) => model.getObjectByName(n);
    model.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m instanceof THREE.MeshStandardMaterial && m.name === "LightStrip") lightMat = m;
    });

    // windows: a star field that the storm and the sunrise brighten
    const flareTex = sc.look === "radiation" ? glowTexture("rgba(255,236,190,1)", "rgba(255,140,40,0)") : null;
    for (const i of [1, 2]) {
      const glass = get(`windowGlass${i}`) as THREE.Mesh | undefined;
      if (!glass) continue;
      const mat = new THREE.MeshBasicMaterial({ map: starsTexture(), color: "#ffffff", side: THREE.DoubleSide });
      glass.material = mat;
      windowMats.push(mat);
      if (flareTex) {
        const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
        f.position.copy(worldPos(glass)).add(new THREE.Vector3(-0.25, -0.25, 0));
        flares.push(f);
        scene.add(f);
      }
    }
    shadeMesh = get("shade") ?? null;
    if (shadeMesh) shadeMesh.visible = false;
    if (has("window")) register("window", get("window2"));

    scrubberFan = get("scrubberFan") ?? null;
    scrubberLed = lamp(model, "scrubberLed", "#ff3b2f");
    hatchDoor = get("hatchDoor") ?? null;
    hatchLamp = lamp(model, "hatchLamp", "#5cc8ff");
    water = get("water") ?? null;
    const bags = get("shelterBags");
    if (bags) bags.visible = sc.look === "radiation"; // the water-bag wall is the storm shelter's
    for (const id of ["scrubber", "medKit", "waterUnit", "bed", "hatch"] as ObjectId[]) if (has(id)) register(id, get(id));
    // you can't walk through the equipment, shown or not (the hatch is the far wall, which the room bounds already stop)
    for (const id of ["scrubber", "medKit", "waterUnit", "bed"]) {
      const o = get(id);
      if (o) solids.push(new THREE.Box3().setFromObject(o).expandByScalar(0.3));
    }
  }

  /* ---------------------------- exterior ---------------------------- */
  function setupExterior() {
    scene.background = new THREE.Color("#000004");
    hemi = new THREE.HemisphereLight("#9fc3ff", "#0a0d16", 0.45);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff4e0", 2.3);
    sun.position.set(40, 50, 30);
    scene.add(sun);

    // stars
    const N = 1800;
    const pos = new Float32Array(N * 3);
    const r = rng(5);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(600);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: "#ffffff", size: 1.4, sizeAttenuation: false }));
    scene.add(stars);

    // Earth, with procedural continents and clouds, far below the station
    const tex = canvasTexture(1024, 512, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, "#16406f");
      g.addColorStop(0.5, "#1f5f9e");
      g.addColorStop(1, "#16406f");
      c.fillStyle = g;
      c.fillRect(0, 0, 1024, 512);
      const rr = rng(42);
      for (let k = 0; k < 14; k++) {
        const cx = rr() * 1024;
        const cy = 90 + rr() * 330;
        for (let j = 0; j < 40; j++) {
          c.fillStyle = rr() > 0.4 ? "#3f7a3c" : "#9a8556";
          c.beginPath();
          c.arc(cx + (rr() - 0.5) * 160, cy + (rr() - 0.5) * 90, 8 + rr() * 26, 0, Math.PI * 2);
          c.fill();
        }
      }
      for (let k = 0; k < 220; k++) {
        c.fillStyle = `rgba(255,255,255,${0.25 + rr() * 0.4})`;
        c.beginPath();
        c.ellipse(rr() * 1024, rr() * 512, 20 + rr() * 60, 6 + rr() * 14, rr() * 0.4, 0, Math.PI * 2);
        c.fill();
      }
    });
    // the globe is far bigger than the map was drawn for: tile it so continents and clouds stay a believable size
    tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
    tex.repeat.set(6, 3);
    earth = mesh(new THREE.SphereGeometry(400, 64, 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, envMapIntensity: 0 }), 40, -470, -160);
    earth.rotation.x = 1.25; // tip the pole away: the map pinches there, and the station flies over the middle latitudes
    scene.add(earth);
    // the real thing: NASA's Blue Marble photo (public/media/earth.jpg); the drawn map above stays if it fails to load
    new THREE.TextureLoader().load(`${BASE}media/earth.jpg`, (photo) => {
      photo.colorSpace = THREE.SRGBColorSpace;
      const m = earth!.material as THREE.MeshStandardMaterial;
      m.map = photo;
      m.needsUpdate = true;
    });
    scene.add(
      mesh(
        new THREE.SphereGeometry(408, 64, 40),
        new THREE.MeshBasicMaterial({ color: "#5fa8ff", transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
        40,
        -470,
        -160,
      ),
    );
    camera.position.set(-4, 8.5, 17);
    controls.target.set(0, 2.2, 1.5);
    controls.minDistance = 4;
    controls.maxDistance = 75;
  }

  function wireExterior(model: THREE.Object3D) {
    const get = (n: string) => model.getObjectByName(n);
    const airlock = get("airlock");
    if (airlock) {
      const p = worldPos(airlock);
      airlockSpot.copy(p).add(new THREE.Vector3(0, 1.8, 0.4));
      tetherFrom.copy(p).add(new THREE.Vector3(0, 0.6, 0));
      hatchLamp = lamp(model, "hatchLamp", "#5cc8ff");
      if (has("airlock")) register("airlock", airlock);
    }
    for (const id of ["task1", "task2", "task3"] as ObjectId[]) {
      const root = get(id);
      if (!root || !has(id)) continue;
      const ringMat = new THREE.MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.9 });
      const ring = mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 32), ringMat, 0, 0.06, 0);
      ring.rotation.x = Math.PI / 2;
      root.add(ring);
      register(id, root);
      taskMarkers[id] = { ring: ringMat, spot: worldPos(root).add(new THREE.Vector3(0, 1.5, 1.0)) };
    }

    // tether: a yellow line from the airlock to the suit, or a loose red one if not locked
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
    tether = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: "#ffd34d" }));
    tether.frustumCulled = false;
    scene.add(tether);
    const lg = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 12 }, (_, i) => new THREE.Vector3(i * 0.12, Math.sin(i * 0.9) * 0.25, i * 0.1)));
    looseTether = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: "#ff5a4a", dashSize: 0.15, gapSize: 0.1 }));
    looseTether.computeLineDistances();
    looseTether.position.copy(tetherFrom);
    scene.add(looseTether);
    astroTarget.copy(airlockSpot);

    // the handrail route, west to east along the hull: camera site, airlock, cable clamp, sample tray
    const stops = [taskMarkers.task1?.spot, airlockSpot, taskMarkers.task2?.spot, taskMarkers.task3?.spot].filter((p): p is THREE.Vector3 => !!p && p.lengthSq() > 0);
    if (stops.length > 1) {
      route = new THREE.CatmullRomCurve3(stops, false, "centripetal");
      const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints(route.getSpacedPoints(120)), new THREE.LineDashedMaterial({ color: "#ffd34d", dashSize: 0.25, gapSize: 0.2, transparent: true, opacity: 0.45 }));
      guide.computeLineDistances();
      scene.add(guide);
    }
  }

  /* ---------------------------- picking ---------------------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered: ObjectId | null = null;
  const pickAt = (e: PointerEvent): ObjectId | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(
      pickables.map((p) => p.root),
      true,
    );
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.objectId) o = o.parent;
      if (o) return o.userData.objectId as ObjectId;
    }
    return null;
  };
  let downAt: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) {
      const id = pickAt(e);
      if (id) opts.onPick(id);
    }
    downAt = null;
  };
  const onMove = (e: PointerEvent) => {
    const id = pickAt(e);
    if (id !== hovered) {
      hovered = id;
      renderer.domElement.style.cursor = id ? "pointer" : "grab";
      opts.onHover(id);
    }
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.style.cursor = "grab";

  /* ---------------------------- walking ---------------------------- */
  // W A S D move you; drag still looks around (and is all a touch screen needs). Space and F belong to ScenarioRun.
  // Inside, you walk the module and bump into the walls and the clickable equipment. Outside, W and S move you
  // along the handrail route between the airlock and the task sites, and A and D turn the view.
  const keys = new Set<string>();
  const WALK_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD"];
  const onKeyDown = (e: KeyboardEvent) => {
    if (!WALK_KEYS.includes(e.code) || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
    keys.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const clearKeys = () => keys.clear();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearKeys);

  /** where the camera may stand inside the module, and the equipment it can't pass through (filled once loaded) */
  const ROOM = new THREE.Box3(new THREE.Vector3(-1.6, -1.9, -7.3), new THREE.Vector3(1.6, 1.9, 7.3));
  const LOOK = new THREE.Box3(new THREE.Vector3(-2.1, -2.2, -7.8), new THREE.Vector3(2.1, 2.2, 7.8));
  const solids: THREE.Box3[] = [];
  /** outside: the handrail route through the airlock and the task sites, and how far along it you are (0..1) */
  let route: THREE.CatmullRomCurve3 | null = null;
  let along = -1;
  const step3 = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();
  const goal = new THREE.Vector3();

  function walk(dt: number) {
    if (!ready || keys.size === 0) return;
    const ax = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const ay = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    if (interior) {
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) return;
      fwd.normalize();
      side.crossVectors(fwd, camera.up).normalize();
      step3.copy(fwd).multiplyScalar(ay).addScaledVector(side, ax);
      if (step3.lengthSq() === 0) return;
      step3.setLength(2.2 * dt);
      const here = camera.position.clamp(ROOM.min, ROOM.max); // scroll-zoom may have left you a little outside the walking space
      // slide along a wall: try the full step, then each axis on its own. Already inside a box (zoomed into it)? You can walk out.
      for (const s of [step3, new THREE.Vector3(step3.x, 0, 0), new THREE.Vector3(0, 0, step3.z)]) {
        const next = here.clone().add(s);
        if (!ROOM.containsPoint(next) || solids.some((b) => b.containsPoint(next) && !b.containsPoint(here))) continue;
        camera.position.copy(next);
        controls.target.add(s).clamp(LOOK.min, LOOK.max);
        return;
      }
      return;
    }
    if (!route) return;
    if (ax) {
      // turn the view around the point you're looking at
      const off = camera.position.clone().sub(controls.target).applyAxisAngle(camera.up, -ax * 1.4 * dt);
      camera.position.copy(controls.target).add(off);
    }
    if (ay) {
      if (along < 0) along = nearestOnRoute(controls.target);
      along = THREE.MathUtils.clamp(along + (ay * 3.2 * dt) / route.getLength(), 0, 1);
    }
  }

  /** outside: glide the view to its spot on the handrail route, keeping the camera's offset */
  function followRoute(dt: number) {
    if (!route || along < 0) return;
    route.getPointAt(along, goal);
    step3.subVectors(goal, controls.target).multiplyScalar(1 - Math.exp(-dt * 6));
    controls.target.add(step3);
    camera.position.add(step3);
  }

  function nearestOnRoute(p: THREE.Vector3) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= 200; i++) {
      const d = route!.getPointAt(i / 200, goal).distanceToSquared(p);
      if (d < bestD) (bestD = d), (best = i / 200);
    }
    return best;
  }

  /* ---------------------------- sizing ---------------------------- */
  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  // don't draw while the view is scrolled off-screen
  let onScreen = true;
  const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
  io.observe(host);

  /* ---------------------------- frame loop ---------------------------- */
  const clock = new THREE.Clock();
  const lightColor = new THREE.Color("#eaf3ff");
  const tmp = new THREE.Color();
  const glow = new THREE.Color();
  let flicker = 0;
  let doorOpen = 0;
  let waterLevel = has("waterUnit") ? 0.03 : 1;
  // the first seconds decide whether this device can afford high quality
  let sampled = 0;
  let sampleTime = 0;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!onScreen || document.hidden) return;
    const time = clock.elapsedTime;
    const v = getView();
    const val = (k: string, d = 0) => v.values[k] ?? d;

    if (ready && !low && sampled < 150) {
      // skip the first frames (shaders compiling), then average 120
      if (++sampled > 30) sampleTime += dt;
      if (sampled === 150 && sampleTime / 120 > 1 / 38) {
        low = true;
        resize();
        opts.onAutoLow?.();
      }
    }

    // ready / hover glow on clickable objects
    for (const p of pickables) {
      const k = p.id === hovered ? 0.55 : v.ready.has(p.id) ? 0.12 + 0.1 * Math.sin(time * 4) : 0;
      glow.setRGB(0.25 * k, 0.75 * k, 1 * k);
      for (const { m, base } of p.mats) m.emissive.copy(base).add(glow);
    }

    // astronaut: drifts to where it's needed, with a slow weightless sway
    astro.group.position.lerp(astroTarget, 1 - Math.exp(-dt * 1.4));
    astro.group.position.y += Math.sin(time * 0.9) * 0.0015;
    astro.group.rotation.z = Math.sin(time * 0.5) * 0.06;
    astro.group.rotation.y = Math.sin(time * 0.31) * 0.22;
    astro.group.rotation.x = Math.sin(time * 0.23) * 0.05;

    let lightTarget = STATUS_LIGHT.green;
    let lightPower = 1;

    if (sc.look === "co2" || sc.look === "smoke") {
      const co2 = sc.look === "smoke" ? 0.4 + val("co") / 60 : val("co2", 0.4); // smoke: 80 ppm CO looks as thick as 1.7 % CO2
      const thick = clamp01((co2 - 0.4) / 1.3);
      if (haze) {
        const f = low ? 0.35 : 1;
        haze.geometry.setDrawRange(0, Math.floor(hazeCount * f * (0.15 + 0.85 * thick)));
        (haze.material as THREE.PointsMaterial).opacity = 0.08 + 0.42 * thick;
        haze.rotation.z = time * 0.02;
        haze.position.y = Math.sin(time * 0.3) * 0.1;
      }
      lightTarget = STATUS_LIGHT[v.status];
      if (v.status === "red") lightPower = 0.55 + 0.45 * (Math.sin(time * 7) > 0 ? 1 : 0.2);
      if (scrubberLed) scrubberLed.color.set(v.flags.scrubberOn ? "#3ee6a0" : "#ff3b2f");
      if (scrubberFan && v.flags.scrubberOn) scrubberFan.rotation.x += dt * 12;
      astro.visorMat.color.lerp(tmp.set(co2 > 1 ? "#e0b67a" : "#d9a441"), 0.05);
    }

    if (sc.look === "radiation") {
      const storm = clamp01(val("doseRate") / 6);
      const pulse = storm * (0.65 + 0.35 * Math.sin(time * 6));
      for (const m of windowMats) m.color.copy(tmp.set("#ffffff").lerp(new THREE.Color("#ffd27a"), storm).multiplyScalar(1 + pulse * 3));
      for (const f of flares) {
        f.visible = !low && storm > 0.01;
        (f.material as THREE.SpriteMaterial).opacity = pulse;
        f.scale.setScalar(1.2 + pulse * 2.4);
      }
      if (flareLight) flareLight.intensity = pulse * 14;
      if (storm > 0.2) {
        lightTarget = STATUS_LIGHT.amber;
        lightPower = 0.75;
      }
      // move into the shelter through the hatch
      const inside = !!v.flags.sheltered;
      astroTarget.set(inside ? 0 : -0.4, inside ? -0.6 : -0.5, inside ? -9.3 : 0.8);
      const passing = inside ? astro.group.position.z > -8.6 : astro.group.position.z < -7.4;
      doorOpen += ((passing ? 1 : 0) - doorOpen) * (1 - Math.exp(-dt * 3));
      if (hatchLamp) hatchLamp.color.set(inside ? "#3ee6a0" : "#5cc8ff");
    }

    if ((sc.look === "co2" || sc.look === "smoke") && hatchDoor) doorOpen += ((v.flags.hatchOpen ? 1 : 0) - doorOpen) * (1 - Math.exp(-dt * 2));
    if (hatchDoor) hatchDoor.rotation.y = -doorOpen * 1.7;

    if (sc.look === "dehydration") {
      const dry = clamp01((99.3 - val("hydration", 99.5)) / 3);
      lightTarget = tmp.set("#ffb36b");
      lightPower = 0.6 - dry * 0.15;
      // the visor fogs as you dry out
      astro.visorMat.color.lerp(new THREE.Color("#d9a441").lerp(new THREE.Color("#f4f6fa"), dry), 0.08);
      astro.visorMat.metalness = 0.85 - dry * 0.7;
      astro.visorMat.roughness = 0.18 + dry * 0.7;
      waterLevel += ((v.flags.waterEmpty ? 0.03 : 0.85) - waterLevel) * (1 - Math.exp(-dt * 2));
      if (water) {
        water.scale.y = Math.max(0.02, waterLevel);
        water.position.y = -0.55 + (1.1 * water.scale.y) / 2;
      }
    }

    let blur = 0;
    if (sc.look === "sleep") {
      const tired = clamp01((val("sleepDebt", 1) - 2) / 8);
      blur = tired * 2.6;
      flicker -= dt;
      if (flicker <= 0 && Math.random() < (0.01 + tired * 0.06) * (dt * 60)) flicker = 0.06 + Math.random() * 0.1;
      lightPower = flicker > 0 ? 0.25 : 0.9 - tired * 0.25;
      // the window shows a sunrise every few seconds, unless the shade is closed
      const sunrise = Math.max(0, Math.sin(time * 1.4)) ** 6;
      if (shadeMesh) shadeMesh.visible = !!v.flags.shade;
      for (const m of windowMats) m.color.setScalar(1 + sunrise * 2.5);
    }

    // apply light colour and power
    if (interior) {
      lightColor.lerp(lightTarget, 1 - Math.exp(-dt * 3));
      if (lightMat) {
        lightMat.emissive.copy(lightColor);
        lightMat.emissiveIntensity = 1.6 * lightPower;
      }
      points.forEach((p, i) => {
        p.color.copy(lightColor);
        p.intensity = POINT[i] * lightPower;
      });
      hemi.color.copy(lightColor);
      hemi.intensity = HEMI * lightPower;
      scene.environmentIntensity = ENV * lightPower;
    }
    renderer.domElement.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";

    if (sc.look === "spacewalk" && ready) {
      if (earth) earth.rotation.y += dt * 0.004;
      if (stars) stars.geometry.setDrawRange(0, low ? 600 : 1800);
      // where the astronaut goes: the next open task, or back to the airlock
      let target = airlockSpot;
      if (!v.flags.returning && v.flags.tethered) {
        for (const id of ["task1", "task2", "task3"] as ObjectId[]) {
          const m = taskMarkers[id];
          if (m && !v.flags[id]) {
            target = m.spot;
            break;
          }
        }
      }
      astroTarget.copy(target);
      for (const id of ["task1", "task2", "task3"] as ObjectId[]) {
        const m = taskMarkers[id];
        if (!m) continue;
        const done = !!v.flags[id];
        m.ring.color.set(done ? "#3ee6a0" : v.ready.has(id) ? "#ffb347" : "#5b6578");
        m.ring.opacity = done ? 0.9 : 0.55 + 0.35 * Math.sin(time * 3);
      }
      // tether curve from the airlock to the suit
      const tethered = !!v.flags.tethered;
      if (tether) {
        tether.visible = tethered;
        const b = astro.group.position.clone().add(new THREE.Vector3(0, -0.1, -0.2));
        const mid = tetherFrom.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 1.2 + Math.sin(time) * 0.15, 0.4));
        const pts = new THREE.QuadraticBezierCurve3(tetherFrom, mid, b).getPoints(39);
        const arr = tether.geometry.getAttribute("position") as THREE.BufferAttribute;
        pts.forEach((p, i) => arr.setXYZ(i, p.x, p.y, p.z));
        arr.needsUpdate = true;
      }
      if (looseTether) {
        looseTether.visible = !tethered;
        looseTether.rotation.z = Math.sin(time * 1.3) * 0.15;
      }
      if (hatchLamp) hatchLamp.color.set(v.flags.returning ? "#3ee6a0" : "#5cc8ff");
      // a red tint creeps into the visor as suit CO2 climbs
      const bad = clamp01((val("suitCO2", 1.5) - 5) / 4);
      astro.visorMat.color.copy(new THREE.Color("#d9a441").lerp(new THREE.Color("#ff5a4a"), bad * (0.6 + 0.4 * Math.sin(time * 5))));
    }

    walk(dt);
    followRoute(dt);
    controls.update();
    if (interior) {
      // stay inside the module: the walls have no outside
      camera.position.set(THREE.MathUtils.clamp(camera.position.x, -1.9, 1.9), THREE.MathUtils.clamp(camera.position.y, -2.0, 2.0), THREE.MathUtils.clamp(camera.position.z, -7.3, 7.3));
      camera.lookAt(controls.target);
    }
    if (sc.look === "sleep") {
      // sway after the controls, so it never builds up in the camera position
      const tired = clamp01((val("sleepDebt", 1) - 2) / 8);
      camera.rotateZ(Math.sin(time * 0.7) * 0.05 * tired);
      camera.rotateX(Math.sin(time * 0.45) * 0.025 * tired);
    }
    if (low) renderer.render(scene, camera);
    else composer.render(dt);
  });

  return {
    setLow(l: boolean) {
      low = l;
      sampled = 150; // the user chose: stop measuring
      resize();
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
          mat.dispose();
        }
      });
      envTex.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
