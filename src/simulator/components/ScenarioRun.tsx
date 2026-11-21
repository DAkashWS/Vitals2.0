/*
 * Screen 2: the 3D scenario. Owns the simulation clock:
 *   - each animation frame advances the rule-based model (engine.ts) by real time × speed,
 *   - the 3D scene (scene3d.ts) reads the model every frame and shows its effects,
 *   - the React overlay (vitals, controls, actions, decisions) refreshes ~10 times a second.
 * Space pauses or plays, F toggles fast-forward.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { FastForward, MousePointer2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { actionReady, choose, clock, createSim, doAction, overallStatus, shown, step, vitalStatus, type SimState } from "@/simulator/simulation/engine";
import type { Action, Choice, ObjectId, Scenario } from "@/simulator/simulation/types";
import { useAuth } from "@/lib/auth";
import { createScene, type SceneHandle, type SceneView } from "./scene3d";
import { ambience, beep, setSoundOn, sfx, unlockAudio } from "@/lib/sound";
import { briefingLine, hush, promptLine, setVoiceOn, speak, voiceLine } from "./voice";
import { Badge, DIFFICULTY, Disclaimer, STATUS_BORDER, STATUS_DOT, STATUS_TEXT, glassSolid, type Carry } from "./ui";

const OBJECT_LABEL: Record<ObjectId, string> = {
  scrubber: "CO2 scrubber",
  waterUnit: "Water unit",
  hatch: "Hatch",
  medKit: "Medical kit",
  bed: "Sleep station",
  window: "Window",
  task1: "Task 1: camera",
  task2: "Task 2: cable clamp",
  task3: "Task 3: samples",
  airlock: "Airlock",
};
const objectLabel = (sc: Scenario, id: ObjectId) =>
  id === "hatch" && sc.look === "radiation" ? "Storm shelter hatch" : id === "scrubber" && sc.look === "smoke" ? "Air scrubber" : OBJECT_LABEL[id];

/** `who`: the speaker, shown above a voiced line as its subtitle */
type Toast = { text: string; tone: "good" | "bad" | "info"; who?: string | null };
const TOAST_STYLE: Record<Toast["tone"], string> = {
  good: "border-emerald-300/40 bg-emerald-950/80 text-emerald-50",
  bad: "border-rose-400/50 bg-rose-950/80 text-rose-50",
  info: "border-cyan-300/30 bg-[#fff5f5]/90 text-cyan-50",
};

function loadLow() {
  try {
    return localStorage.getItem("vitals2-sim-low") === "1";
  } catch {
    return false;
  }
}

export default function ScenarioRun({
  scenario: sc,
  previous,
  carry,
  onDone,
}: {
  scenario: Scenario;
  /** choices from the last attempt, marked "Last time" so a retry can try something different */
  previous: Record<string, string> | null;
  /** what the previous quest changed about this start */
  carry: Carry | null;
  onDone: (s: SimState) => void;
}) {
  const sim = useRef<SimState>(createSim(sc, carry?.start));
  const { profile } = useAuth();
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 4>(1);
  const [low, setLow] = useState(loadLow);
  const [sound, setSound] = useState(true);
  const [hover, setHover] = useState<ObjectId | null>(null);
  /** the 3D models: still downloading, ready, or failed to load */
  const [models, setModels] = useState<"loading" | "ready" | "error">("loading");
  const [menu, setMenu] = useState<{ id: ObjectId; actions: Action[] } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle | null>(null);
  const toastTimer = useRef(0);

  const s = sim.current;
  const running = started && !paused && !s.pending && !s.ended;
  const status = overallStatus(s, sc);

  const say = useCallback((t: Toast) => {
    const { who, line } = voiceLine(t.text);
    const hideAfter = (ms: number) => {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), ms);
    };
    setToast({ ...t, text: line, who });
    hideAfter(6500);
    speak(line, (ms) => hideAfter(Math.max(6500, ms + 1200)));
  }, []);

  // Sound: follow the switch, read the briefing, chime and read each decision, play the cabin or suit
  // ambience while the quest runs, and stop it all when leaving.
  useEffect(() => {
    setVoiceOn(sound);
    setSoundOn(sound);
  }, [sound]);
  useEffect(() => {
    speak(briefingLine(sc));
    return hush;
  }, [sc]);
  useEffect(() => {
    if (!s.pending) return;
    sfx("decision");
    speak(promptLine(s.pending));
  }, [s.pending]);
  useEffect(() => {
    if (!started) return;
    ambience(sc.look === "spacewalk" ? "suit" : "cabin");
    return () => ambience(null);
  }, [started, sc, sound]);

  // Which objects have something to do right now (they glow in the scene).
  const readyObjects = (st: SimState) => new Set(sc.actions.filter((a) => actionReady(st, a)).map((a) => a.object));

  const runAction = useCallback(
    (a: Action) => {
      if (!doAction(sim.current, sc, a)) return;
      sfx(a.mistake ? "bad" : "action");
      setMenu(null);
      say({ text: a.message, tone: a.mistake ? "bad" : "good" });
      refresh();
    },
    [sc, say],
  );

  const pick = useCallback(
    (id: ObjectId) => {
      const st = sim.current;
      if (!started || st.ended) return;
      const list = sc.actions.filter((a) => a.object === id && actionReady(st, a));
      if (list.length === 1) runAction(list[0]);
      else if (list.length > 1) setMenu({ id, actions: list });
      else say({ text: `${objectLabel(sc, id)}: nothing to do here right now.`, tone: "info" });
    },
    [sc, started, runAction, say],
  );
  const pickRef = useRef(pick);
  pickRef.current = pick;

  // Build the 3D scene once per scenario.
  useEffect(() => {
    if (!host.current) return;
    const getView = (): SceneView => {
      const st = sim.current;
      return { t: st.t, values: st.values, flags: st.flags, status: overallStatus(st, sc), ready: readyObjects(st) };
    };
    scene.current = createScene(host.current, sc, getView, {
      low: loadLow(),
      onPick: (id) => pickRef.current(id),
      onHover: setHover,
      onStatus: setModels,
      onAutoLow: () => setLow(true), // frames were slow: the scene already dropped to low graphics
    });
    document.body.dataset.immersive = "1"; // hides the floating site nav, which would cover the action buttons
    return () => {
      delete document.body.dataset.immersive;
      scene.current?.dispose();
      scene.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc]);

  useEffect(() => {
    scene.current?.setLow(low);
    try {
      localStorage.setItem("vitals2-sim-low", low ? "1" : "0");
    } catch {
      /* fine: the choice lasts for this visit only */
    }
  }, [low]);

  // The simulation clock.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    let logLen = sim.current.log.length;
    const tick = (now: number) => {
      const st = sim.current;
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      step(st, sc, (dt * speed) / sc.secondsPerUnit);
      // new events and alerts pop up as messages
      if (st.log.length > logLen) {
        const e = st.log[st.log.length - 1];
        if (e.kind === "event" || e.kind === "alert") say({ text: e.text, tone: e.level === "info" ? "info" : "bad" });
        if (e.level === "alert") beep();
        logLen = st.log.length;
      }
      if (st.pending || st.ended || now - lastUi > 100) {
        lastUi = now;
        refresh();
      }
      if (!st.pending && !st.ended) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, sc, say]);

  // Alarm while anything is in the red.
  useEffect(() => {
    if (!sound || !running || status !== "red") return;
    beep();
    const id = window.setInterval(beep, 1400);
    return () => window.clearInterval(id);
  }, [sound, running, status]);

  // Keyboard: space = pause/play, F = fast-forward.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || (e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "f" || e.key === "F") setSpeed((v) => (v === 1 ? 4 : 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started]);

  const onChoose = (c: Choice) => {
    choose(sim.current, sc, c);
    sfx(c.best ? "good" : c.mistake ? "bad" : "action");
    say({ text: c.feedback, tone: c.best ? "good" : c.mistake ? "bad" : "info" });
    refresh();
  };

  const shownActions = sc.actions.filter((a) => !(a.hideIf && s.flags[a.hideIf]));
  const progress = Math.min(1, s.t / sc.duration);
  const visibleVitals = sc.vitals.filter((v) => v.show !== false);
  const recent = useMemo(() => s.log.slice(-3).reverse(), [s.log.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {sc.story && (
        <p className="mb-3 flex items-center gap-2 text-sm text-cyan-50/90">
          <Glyph name="check" className="h-4 w-4 shrink-0 text-cyan-300" />
          <span>
            <strong>Goal:</strong> {sc.story.goal}
          </span>
        </p>
      )}
      <div className={`${glassSolid} relative overflow-hidden !rounded-[28px] ${STATUS_BORDER[status]}`}>
        {/* the 3D canvas */}
        <div ref={host} className="h-[68svh] min-h-[440px] w-full sm:h-[72svh] lg:h-[640px]" aria-label={`3D view: ${sc.title}. Drag to look around, W A S D to move; click glowing objects to act.`} />

        {/* hover label */}
        {hover && started && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-cyan-300/30 bg-[#fff5f5]/85 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-cyan-100">
            {objectLabel(sc, hover)}
            {sc.actions.some((a) => a.object === hover && actionReady(s, a)) ? " · click to act" : ""}
          </div>
        )}

        {/* vitals overlay: small, top left */}
        <div className="pointer-events-none absolute left-3 top-3 w-[min(250px,calc(100%-1.5rem))] space-y-1.5 sm:left-4 sm:top-4">
          <div className="rounded-2xl border border-cyan-300/20 bg-[#fff5f5]/90 px-3.5 py-2.5">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-200/70">
              <span>{sc.timeUnit === "h" ? "Clock" : "Mission clock"}</span>
              <span className="text-cyan-50">{clock(s.t, sc.timeUnit)}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-cyan-300/80" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
          {visibleVitals.map((v) => {
            const st = vitalStatus(s, v);
            return (
              <div key={v.key} className={`flex items-center justify-between gap-3 rounded-2xl border bg-[#fff5f5]/90 px-3.5 py-2 ${STATUS_BORDER[st]}`}>
                <span className="flex items-center gap-2 text-xs text-white/70">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[st]}`} aria-hidden="true" />
                  {v.label}
                </span>
                <span className={`font-mono text-sm font-semibold tabular-nums ${STATUS_TEXT[st]}`}>
                  {shown(s, v).toFixed(v.decimals)} <span className="text-[11px] font-normal text-white/45">{v.unit}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* controls: top right */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-2 sm:right-4 sm:top-4">
          <div className="flex gap-1.5 rounded-full border border-cyan-300/20 bg-[#fff5f5]/90 p-1.5">
            <LiquidButton distort={false} size="icon" type="button" aria-label={paused ? "Play" : "Pause"} disabled={!started || !!s.ended} onClick={() => setPaused((p) => !p)} className="h-9 w-9 text-white">
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </LiquidButton>
            <LiquidButton distort={false}
              size="icon"
              type="button"
              aria-label={speed === 4 ? "Normal speed" : "Fast-forward"}
              aria-pressed={speed === 4}
              disabled={!started || !!s.ended}
              onClick={() => setSpeed((v) => (v === 1 ? 4 : 1))}
              className={`h-9 w-9 text-white ${speed === 4 ? "bg-cyan-400/30" : ""}`}
            >
              <FastForward className="h-4 w-4" />
            </LiquidButton>
            <LiquidButton distort={false} size="icon" type="button" aria-label={sound ? "Mute sound and voices" : "Turn sound and voices on"} onClick={() => setSound((v) => !v)} className="h-9 w-9 text-white">
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </LiquidButton>
          </div>
          <LiquidButton distort={false} size="sm" type="button" aria-pressed={low} onClick={() => setLow((v) => !v)} className={`h-8 px-3 font-mono text-[11px] uppercase tracking-wider text-white/85 ${low ? "bg-cyan-400/25" : ""}`}>
            {low ? "Low graphics: on" : "Low graphics: off"}
          </LiquidButton>
          {speed === 4 && running && <Badge className="border-cyan-300/30 bg-cyan-400/10 text-cyan-100">4× speed</Badge>}
          {paused && started && !s.pending && !s.ended && <Badge className="border-white/20 bg-white/10 text-white/80">Paused</Badge>}
        </div>

        {/* toast message */}
        {toast && started && !s.pending && (
          <div role="status" className={`absolute bottom-24 left-1/2 w-[min(560px,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-xl sm:bottom-28 ${TOAST_STYLE[toast.tone]}`}>
            {toast.who && <span className="mb-0.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">{toast.who}</span>}
            {toast.text}
          </div>
        )}

        {/* actions: bottom */}
        {started && !s.ended && (
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap justify-center gap-2 sm:inset-x-4 sm:bottom-4">
            {(menu ? menu.actions : shownActions).map((a) => {
              const ok = actionReady(s, a);
              return (
                <LiquidButton distort={false}
                  key={a.id}
                  size="sm"
                  type="button"
                  disabled={!ok || !!s.pending}
                  onClick={() => runAction(a)}
                  className={`h-9 gap-2 px-3.5 text-xs text-white ${ok ? "bg-cyan-400/15" : "opacity-45"}`}
                >
                  <Glyph name={objectIcon(a.object)} className="h-4 w-4 text-cyan-300" /> {a.label}
                </LiquidButton>
              );
            })}
            {menu && (
              <LiquidButton distort={false} size="sm" type="button" onClick={() => setMenu(null)} className="h-9 px-3.5 text-xs text-white/70">
                Back
              </LiquidButton>
            )}
          </div>
        )}

        {/* briefing before the start. Header and Begin stay put, only the middle scrolls, so Begin is reachable on a short screen (tablet landscape). */}
        {!started && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#fffbfb]/85 p-4" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
            <div className={`${glassSolid} flex max-h-full w-full max-w-lg flex-col`}>
              <div className="flex shrink-0 items-start gap-4 px-6 pt-6 sm:px-7 sm:pt-7">
                <GlyphTile name={sc.icon as GlyphName} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-300/70">{sc.story ? `Day ${sc.story.day}` : "Mission"} · Briefing</p>
                  <h2 id="briefing-title" className="mt-1.5 text-2xl font-semibold tracking-tight text-cyan-50">{sc.title}</h2>
                </div>
                <Badge className={DIFFICULTY[sc.difficulty]}>{sc.difficulty}</Badge>
              </div>

              <div className="mx-6 mt-5 h-px shrink-0 bg-gradient-to-r from-cyan-300/30 via-cyan-300/10 to-transparent sm:mx-7" />

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-7">
              {sc.story && (
                <p className="text-[15px] leading-relaxed text-white">
                  {profile?.display_name ? `${profile.display_name}: ` : ""}
                  {sc.story.intro}
                </p>
              )}
              <p className="mt-3 text-[15px] leading-relaxed text-white/75">{sc.briefing}</p>
              {sc.story && (
                <div className="mt-5 flex gap-3 rounded-xl border border-l-[3px] border-cyan-300/25 border-l-cyan-300 bg-cyan-400/[0.08] px-4 py-3">
                  <Glyph name="check" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Your goal</p>
                    <p className="mt-1 text-sm leading-relaxed text-cyan-50">{sc.story.goal}</p>
                  </div>
                </div>
              )}
              {carry && (
                <div className={`mt-2 rounded-xl border border-l-[3px] px-4 py-3 ${carry.good ? "border-emerald-300/25 border-l-emerald-300 bg-emerald-400/[0.08]" : "border-amber-300/30 border-l-amber-300 bg-amber-400/[0.08]"}`}>
                  <p className={`font-mono text-[10px] uppercase tracking-[0.2em] ${carry.good ? "text-emerald-300/80" : "text-amber-300/80"}`}>Carried over</p>
                  <p className={`mt-1 text-sm leading-relaxed ${carry.good ? "text-emerald-100" : "text-amber-100"}`}>{carry.text}</p>
                </div>
              )}
              <ul className="mt-5 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] text-sm text-white/65">
                <li className="flex gap-3 px-4 py-2.5">
                  <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" /> Drag to look around, scroll to zoom. {sc.setting === "exterior" ? "W and S move you along the handrails, A and D turn." : "W A S D to move around the module."} Glowing objects can be clicked.
                </li>
                <li className="flex gap-3 px-4 py-2.5">
                  <Glyph name="timeline" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /> The clock stops at each decision point. Space pauses, F fast-forwards.
                </li>
                <li className="flex gap-3 px-4 py-2.5">
                  <Glyph name="trophy" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /> Time in the red costs points. You're scored at the end.
                </li>
              </ul>
              {models === "error" && (
                <p role="alert" className="mt-5 rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  The 3D station couldn't be loaded. Check your connection and reload the page. You can still play: the vitals, decisions and actions all work without it.
                </p>
              )}
              </div>

              <div className="shrink-0 border-t border-white/[0.07] px-6 pb-6 pt-5 sm:px-7 sm:pb-7">
                <LiquidButton distort={false}
                  type="button"
                  disabled={models === "loading"}
                  onClick={() => {
                    unlockAudio();
                    setStarted(true);
                  }}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 bg-cyan-400/20 text-base font-semibold text-white"
                >
                  {models === "loading" ? "Loading the station…" : (<><Play className="h-4 w-4" /> Begin</>)}
                </LiquidButton>
              </div>
            </div>
          </div>
        )}

        {/* decision point */}
        {s.pending && (
          <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-[#fffbfb]/80 p-4" role="dialog" aria-modal="true" aria-labelledby="decision-title">
            <div className={`${glassSolid} w-full max-w-xl p-6 sm:p-7`}>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300">Decision point · {clock(s.t, sc.timeUnit)}</p>
              <h2 id="decision-title" className="mt-3 font-mono text-lg font-semibold uppercase tracking-[0.1em] text-cyan-50 sm:text-xl">
                {s.pending.title}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-white/75">{s.pending.prompt}</p>
              <div className="mt-5 space-y-2.5">
                {s.pending.choices.map((c, i) => (
                  <LiquidButton distort={false}
                    key={c.id}
                    type="button"
                    onClick={() => onChoose(c)}
                    className="flex h-auto min-h-12 w-full items-center justify-start gap-3 whitespace-normal bg-white/[0.04] px-5 py-3 text-left text-[15px] font-medium text-white hover:bg-cyan-400/15"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cyan-300/40 font-mono text-xs text-cyan-200">{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1">{c.label}</span>
                    {previous?.[s.pending!.id] === c.id && <Badge className="border-white/20 bg-white/10 text-white/70">Last time</Badge>}
                  </LiquidButton>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* the end */}
        {s.ended && (
          <div className="absolute inset-0 grid place-items-center bg-[#fffbfb]/85 p-4">
            <div className={`${glassSolid} max-w-md p-7 text-center`}>
              <GlyphTile name={s.ended === "success" ? "trophy" : "warning"} tone={s.ended === "success" ? "green" : "red"} size="lg" />
              <h2 className="mt-5 font-mono text-xl font-semibold uppercase tracking-[0.12em] text-cyan-50">{s.ended === "success" ? "Scenario complete" : "Scenario failed"}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-white/75">{s.ended === "success" ? sc.successText : sc.failText}</p>
              <LiquidButton distort={false} type="button" onClick={() => onDone(sim.current)} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 bg-cyan-400/20 text-base font-semibold text-white">
                <Glyph name="timeline" className="h-4 w-4" /> See the debrief
              </LiquidButton>
            </div>
          </div>
        )}
      </div>

      {/* comms log under the view */}
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <ol className="space-y-1.5" aria-label="Latest messages">
          {recent.map((e, i) => (
            <li key={`${e.t}-${i}`} className={`flex gap-3 font-mono text-[12px] leading-relaxed ${i === 0 ? "text-cyan-50/90" : "text-cyan-50/45"}`}>
              <span className="shrink-0 text-cyan-300/70">{clock(e.t, sc.timeUnit)}</span>
              <span className={e.mistake || e.level === "alert" ? "text-rose-300/90" : ""}>{e.text}</span>
            </li>
          ))}
        </ol>
        <Disclaimer />
      </div>
    </div>
  );
}

function objectIcon(id: ObjectId): GlyphName {
  const map: Record<ObjectId, GlyphName> = {
    scrubber: "scrubber",
    waterUnit: "waterTank",
    hatch: "hatch",
    medKit: "medKit",
    bed: "moon",
    window: "sunrise",
    task1: "camera",
    task2: "gear",
    task3: "flask",
    airlock: "hatch",
  };
  return map[id];
}
