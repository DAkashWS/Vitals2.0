// Every simulator line that gets a recorded voice, with its speaker. Run: node tools/voices/lines.mjs
// Prints JSON: [{ id, who, text, speech }]. `text` is what the game shows and the key it looks the clip up by;
// `speech` is what the voice says (units spelled out). `--stats` prints counts instead.
import { readFileSync, readdirSync } from "node:fs";

const dir = "src/simulator/scenarios";
const SPOKEN = [
  [/(\d) ?°C/g, "$1 degrees Celsius"],
  [/(\d) ?%/g, "$1 percent"],
  [/(\d) ?ml\b/g, "$1 millilitres"],
  [/(\d) ?km\b/g, "$1 kilometres"],
];
const spoken = (t) => SPOKEN.reduce((s, [re, to]) => s.replace(re, to), t);
const lines = new Map();
const add = (id, who, text) => {
  if (!lines.has(text)) lines.set(text, { id, who, text, speech: spoken(text) });
};

for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const sc = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  add(`${sc.id}-briefing`, "Mission Control", [sc.story?.intro, sc.briefing, sc.story ? `Your goal: ${sc.story.goal}` : ""].filter(Boolean).join(" "));
  sc.events.forEach((e, i) => add(`${sc.id}-event-${i}`, "Mission Control", e.text));
  (sc.story?.crew ?? []).forEach((c, i) => add(`${sc.id}-crew-${i}`, c.who, c.text));
  for (const d of sc.decisions) {
    add(`${sc.id}-${d.id}-prompt`, "Mission Control", `${d.title}${/[.?!]$/.test(d.title) ? "" : "."} ${d.prompt}`);
    for (const c of d.choices) add(`${sc.id}-${d.id}-${c.id}`, "Mission Control", c.feedback);
  }
  add(`${sc.id}-success`, "Mission Control", sc.successText);
  add(`${sc.id}-fail`, "Mission Control", sc.failText);
}

const out = [...lines.values()];
if (process.argv[2] === "--stats") {
  const by = {};
  for (const l of out) (by[l.who] ??= { lines: 0, chars: 0 }), by[l.who].lines++, (by[l.who].chars += l.speech.length);
  console.log({ total: out.length, chars: out.reduce((n, l) => n + l.speech.length, 0), by });
} else console.log(JSON.stringify(out, null, 1));
