// Balance check for every simulator quest. Run from the repo root (Node 22.6+ strips the engine's types):
//   node tools/balance.mjs
// Plays each quest three ways and fails (exit 1) unless:
//   best     best choice at every decision + every helpful action as soon as it's ready  -> success
//   nothing  no actions, and at each decision a choice that changes nothing (else the worst) -> fail
//   worst    lowest-scoring choice at every decision, no actions                         -> fail
import { readFileSync, readdirSync } from "node:fs";
import { actionReady, choose, createSim, debrief, doAction, step } from "../src/simulator/simulation/engine.ts";

const dir = "src/simulator/scenarios";
// helpful actions that are only right at the right moment (the finishing action is used near the end, below)
const AVOID = ["leave-shelter", "head-back"];
const withCrew = (sc) => (sc.story ? { ...sc, events: [...sc.events, ...sc.story.crew.map((c) => ({ at: c.at, text: c.text }))].sort((a, b) => a.at - b.at) } : sc);
const quests = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => withCrew(JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))))
  .sort((a, b) => a.order - b.order);

function play(sc, how, carryBad) {
  const c = sc.story?.carry;
  const s = createSim(sc, c && carryBad ? { [c.key]: c.bad } : {});
  for (let i = 0; i < 100000 && !s.ended; i++) {
    if (s.pending) {
      const cs = s.pending.choices;
      const worst = cs.reduce((w, x) => (x.score < w.score ? x : w));
      const pick = how === "best" ? (cs.find((x) => x.best) ?? cs[0]) : how === "nothing" ? (cs.find((x) => !x.best && !x.effect) ?? worst) : worst;
      choose(s, sc, pick);
      continue;
    }
    if (how === "best") for (const a of sc.actions) if (!AVOID.includes(a.id) && !a.mistake && (a.score ?? 0) >= 0 && !a.effect?.end && actionReady(s, a)) doAction(s, sc, a);
    // the quest's own finishing action (e.g. entering the airlock) once everything else is done
    if (how === "best" && s.t > sc.duration * 0.9) for (const a of sc.actions) if (a.effect?.end === "success" && actionReady(s, a)) doAction(s, sc, a);
    step(s, sc, 0.25);
  }
  return { ended: s.ended, t: +s.t.toFixed(1), score: debrief(s, sc).score };
}

let bad = 0;
for (const sc of quests) {
  const r = { best: play(sc, "best"), bestCarryBad: play(sc, "best", true), nothing: play(sc, "nothing"), worst: play(sc, "worst") };
  const ok = r.best.ended === "success" && r.bestCarryBad.ended === "success" && r.nothing.ended === "fail" && r.worst.ended === "fail";
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${sc.id.padEnd(18)} ` + Object.entries(r).map(([k, v]) => `${k}: ${v.ended} @${v.t} (${v.score})`).join(" | "));
}
process.exit(bad ? 1 : 0);
