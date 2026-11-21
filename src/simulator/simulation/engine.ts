/*
 * Scenario simulator: the rule-based model.
 *
 * Pure functions, no React and no 3D. Each step:
 *   1. works out every vital's rate of change (its own rate + matching rules + integrations),
 *   2. moves the values forward, clamped to their min and max,
 *   3. fires timed events, logs vitals that cross into amber or red,
 *   4. stops at the next decision point and waits for a choice,
 *   5. ends the run on success (time's up), failure (too long in the red) or an "end" effect.
 * A simplified educational model, not a physiological one.
 */

import type { Action, Band, Choice, Decision, Effect, Scenario, VitalDef } from "./types";

export type Status = "green" | "amber" | "red";

export type LogEntry = {
  t: number;
  kind: "event" | "alert" | "decision" | "action" | "end";
  text: string;
  detail?: string;
  mistake?: boolean;
  best?: boolean;
  /** for a wrong choice: the best choice at that decision */
  instead?: string;
  level?: "info" | "warn" | "alert";
};

export type SimState = {
  t: number;
  values: Record<string, number>;
  rates: Record<string, number>;
  flags: Record<string, boolean>;
  /** when each flag was first turned on */
  flagTimes: Record<string, number>;
  log: LogEntry[];
  /** points lost to choices and actions (0 or negative) */
  choiceScore: number;
  /** total time units spent in the red */
  redTime: number;
  /** time units in the red in a row */
  redRun: number;
  nextEvent: number;
  nextDecision: number;
  pending: Decision | null;
  /** chosen choice id per decision id */
  choices: Record<string, string>;
  /** last use time per action id */
  used: Record<string, number>;
  lastStatus: Record<string, Status>;
  ended: null | "success" | "fail";
};

const RANK: Record<Status, number> = { green: 0, amber: 1, red: 2 };
export const worse = (a: Status, b: Status): Status => (RANK[b] > RANK[a] ? b : a);

export function statusOf(v: number, band: Band): Status {
  if (v >= band.green[0] && v <= band.green[1]) return "green";
  if (v >= band.amber[0] && v <= band.amber[1]) return "amber";
  return "red";
}

/** A vital's value as the crew sees it (after any shelter or shielding scale). */
export function shown(s: SimState, v: VitalDef): number {
  const raw = s.values[v.key];
  return v.scale && s.flags[v.scale.flag] ? raw * v.scale.factor : raw;
}

export function vitalStatus(s: SimState, v: VitalDef): Status {
  return statusOf(shown(s, v), v.band);
}

/** The worst status of the vitals shown in the overlay. */
export function overallStatus(s: SimState, sc: Scenario): Status {
  return sc.vitals.filter((v) => v.show !== false).reduce<Status>((w, v) => worse(w, vitalStatus(s, v)), "green");
}

/** start: changes to starting values carried over from the previous quest, e.g. { heartRate: 8 }. */
export function createSim(sc: Scenario, start: Record<string, number> = {}): SimState {
  const values: Record<string, number> = {};
  const rates: Record<string, number> = {};
  for (const v of sc.vitals) {
    values[v.key] = v.start + (start[v.key] ?? 0);
    rates[v.key] = v.rate;
  }
  const s: SimState = {
    t: 0,
    values,
    rates,
    flags: { ...(sc.flags ?? {}) },
    flagTimes: {},
    log: [],
    choiceScore: 0,
    redTime: 0,
    redRun: 0,
    nextEvent: 0,
    nextDecision: 0,
    pending: null,
    choices: {},
    used: {},
    lastStatus: {},
    ended: null,
  };
  for (const v of sc.vitals) s.lastStatus[v.key] = vitalStatus(s, v);
  fireEvents(s, sc);
  return s;
}

function clampVital(s: SimState, v: VitalDef) {
  s.values[v.key] = Math.min(v.max, Math.max(v.min, s.values[v.key]));
}

export function applyEffect(s: SimState, sc: Scenario, e: Effect | undefined) {
  if (!e) return;
  for (const [k, x] of Object.entries(e.set ?? {})) s.values[k] = x;
  for (const [k, x] of Object.entries(e.add ?? {})) s.values[k] = (s.values[k] ?? 0) + x;
  for (const [k, x] of Object.entries(e.rate ?? {})) s.rates[k] = x;
  for (const [k, x] of Object.entries(e.rateAdd ?? {})) s.rates[k] = (s.rates[k] ?? 0) + x;
  for (const [k, on] of Object.entries(e.flags ?? {})) {
    s.flags[k] = on;
    if (on && s.flagTimes[k] == null) s.flagTimes[k] = s.t;
  }
  for (const v of sc.vitals) clampVital(s, v);
  if (e.end) finish(s, sc, e.end);
}

function fireEvents(s: SimState, sc: Scenario) {
  while (s.nextEvent < sc.events.length && sc.events[s.nextEvent].at <= s.t + 1e-9) {
    const ev = sc.events[s.nextEvent++];
    s.log.push({ t: ev.at, kind: "event", text: ev.text, level: ev.level ?? "info" });
    applyEffect(s, sc, ev.effect);
  }
}

function finish(s: SimState, sc: Scenario, how: "success" | "fail") {
  if (s.ended) return;
  s.ended = how;
  s.pending = null;
  s.log.push({ t: s.t, kind: "end", text: how === "success" ? sc.successText : sc.failText, level: how === "success" ? "info" : "alert" });
}

/** Rates in effect right now: each vital's own rate, plus every rule whose condition holds, plus integrations. */
function currentRates(s: SimState, sc: Scenario): Record<string, number> {
  const r = { ...s.rates };
  for (const rule of sc.rules ?? []) {
    if (rule.flag && !s.flags[rule.flag]) continue;
    if (rule.notFlag && s.flags[rule.notFlag]) continue;
    if (rule.key) {
      const v = s.values[rule.key];
      if (rule.above != null && !(v > rule.above)) continue;
      if (rule.below != null && !(v < rule.below)) continue;
    }
    for (const [k, x] of Object.entries(rule.rateAdd)) r[k] = (r[k] ?? 0) + x;
  }
  for (const v of sc.vitals) {
    if (!v.integrates) continue;
    const src = sc.vitals.find((x) => x.key === v.integrates!.key);
    const srcVal = src ? shown(s, src) : s.values[v.integrates.key];
    r[v.key] = (r[v.key] ?? 0) + srcVal * v.integrates.factor;
  }
  return r;
}

/** Move the simulation forward by up to `dt` time units. Stops early at a decision point. */
export function step(s: SimState, sc: Scenario, dt: number) {
  if (s.ended || s.pending || dt <= 0) return;
  let left = dt;
  while (left > 1e-9 && !s.ended && !s.pending) {
    const nextDec = s.nextDecision < sc.decisions.length ? sc.decisions[s.nextDecision].at : Infinity;
    const nextEv = s.nextEvent < sc.events.length ? sc.events[s.nextEvent].at : Infinity;
    // small sub-steps keep the rules responsive, and land exactly on events and decisions
    const h = Math.min(left, 0.25, Math.max(1e-6, nextDec - s.t), Math.max(1e-6, nextEv - s.t), Math.max(1e-6, sc.duration - s.t));
    const r = currentRates(s, sc);
    for (const v of sc.vitals) {
      s.values[v.key] += (r[v.key] ?? 0) * h;
      clampVital(s, v);
    }
    s.t += h;
    left -= h;

    // time in the red
    const st = overallStatus(s, sc);
    if (st === "red") {
      s.redTime += h;
      s.redRun += h;
    } else s.redRun = 0;

    // log vitals crossing into amber or red
    for (const v of sc.vitals) {
      if (v.show === false) continue;
      const now = vitalStatus(s, v);
      if (RANK[now] > RANK[s.lastStatus[v.key]]) {
        s.log.push({
          t: s.t,
          kind: "alert",
          text: `${v.label} ${now === "red" ? "is in the red" : "needs watching"}: ${shown(s, v).toFixed(v.decimals)} ${v.unit}`.trim(),
          level: now === "red" ? "alert" : "warn",
        });
      }
      s.lastStatus[v.key] = now;
    }

    fireEvents(s, sc);
    if (s.ended) break;
    if (s.redRun >= sc.failAfterRed) {
      finish(s, sc, "fail");
      break;
    }
    if (s.t >= sc.duration - 1e-9) {
      finish(s, sc, "success");
      break;
    }
    if (s.nextDecision < sc.decisions.length && s.t >= sc.decisions[s.nextDecision].at - 1e-9) {
      s.pending = sc.decisions[s.nextDecision];
    }
  }
}

export function choose(s: SimState, sc: Scenario, choice: Choice) {
  const d = s.pending;
  if (!d) return;
  s.choices[d.id] = choice.id;
  s.choiceScore += choice.score;
  const instead = choice.mistake ? d.choices.find((c) => c.best)?.label : undefined;
  s.log.push({ t: s.t, kind: "decision", text: `${d.title}: ${choice.label}`, detail: choice.feedback, mistake: choice.mistake, best: choice.best, instead });
  s.pending = null;
  s.nextDecision++;
  applyEffect(s, sc, choice.effect);
}

/** Can this action be used right now? */
export function actionReady(s: SimState, a: Action): boolean {
  if (s.ended) return false;
  if (a.requires && !s.flags[a.requires]) return false;
  if (a.hideIf && s.flags[a.hideIf]) return false;
  const last = s.used[a.id];
  if (last == null) return true;
  if (a.once) return false;
  return a.cooldown != null ? s.t - last >= a.cooldown : true;
}

export function doAction(s: SimState, sc: Scenario, a: Action): boolean {
  if (!actionReady(s, a)) return false;
  s.used[a.id] = s.t;
  s.choiceScore += a.score ?? 0;
  s.log.push({ t: s.t, kind: "action", text: a.label, detail: a.message, mistake: a.mistake });
  applyEffect(s, sc, a.effect);
  return true;
}

/* ------------------------------------------------------------------ */
/*  Debrief                                                            */
/* ------------------------------------------------------------------ */

export type Debrief = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  outcome: "success" | "fail";
  mistakes: { text: string; why: string; instead?: string }[];
  best: { title: string; label: string; why: string; yours: string | null }[];
  keySteps: { label: string; why: string; done: boolean; late: boolean }[];
};

export function debrief(s: SimState, sc: Scenario): Debrief {
  const keySteps = sc.keySteps.map((k) => {
    const at = s.flagTimes[k.flag];
    return { label: k.label, why: k.why, done: at != null, late: at != null && at > k.by };
  });
  const missed = keySteps.filter((k) => !k.done || k.late).length;
  const outcome = s.ended === "fail" ? "fail" : "success";
  let score = 100 + s.choiceScore - s.redTime * sc.redPenalty - missed * 15;
  if (outcome === "fail") score = Math.min(score, 40);
  score = Math.round(Math.max(0, Math.min(100, score)));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";

  const mistakes: Debrief["mistakes"] = [];
  for (const e of s.log) if (e.mistake) mistakes.push({ text: e.text, why: e.detail ?? "", instead: e.instead });
  for (const k of keySteps) {
    if (!k.done) mistakes.push({ text: `Missed: ${k.label}`, why: k.why });
    else if (k.late) mistakes.push({ text: `Too late: ${k.label}`, why: k.why });
  }
  if (s.redTime >= 1) {
    const u = sc.timeUnit === "h" ? "hours" : "minutes";
    mistakes.push({ text: `${Math.round(s.redTime)} ${u} with a vital in the red`, why: "A vital stayed in the danger zone. Act when it turns amber, before it reaches red." });
  }

  const best = sc.decisions.map((d) => {
    const b = d.choices.find((c) => c.best) ?? d.choices[0];
    const mine = d.choices.find((c) => c.id === s.choices[d.id]);
    return { title: d.title, label: b.label, why: b.feedback, yours: mine ? mine.label : null };
  });

  return { score, grade, outcome, mistakes, best, keySteps };
}

/** "T+00:12" for minutes, "Day 2 · 14:00" for hours. */
export function clock(t: number, unit: "min" | "h"): string {
  if (unit === "min") {
    const m = Math.floor(t);
    const sec = Math.floor((t - m) * 60);
    return `T+${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  const day = Math.floor(t / 24) + 1;
  const h = Math.floor(t % 24);
  const m = Math.floor(((t % 24) - h) * 60);
  return `Day ${day} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Short time label for the log and debrief. */
export function stamp(t: number, unit: "min" | "h"): string {
  return unit === "min" ? `${Math.floor(t)} min` : `${Math.floor(t)} h`;
}
