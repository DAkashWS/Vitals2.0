import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { Minus, Plus, Radio, RotateCcw } from "lucide-react";
import { Shell } from "@/live/LivePage";
import { ChatPanel, type ChatScope } from "@/sections/Assistant";
import HygieneCard from "@/hygiene/HygieneCard";
import { GlyphTile, StatusDot } from "@/components/ui/glyph";
import {
  cabinFactors,
  CABIN_ITEMS,
  DEFAULT_CABIN,
  hygieneResult,
  itemStatus,
  PERSONAL,
  target,
  valueOf,
  type Cabin,
  type Item,
  type Status,
  type Values,
} from "@/hygiene/model";

/*
 * Hygiene & sanitation (#/hygiene): your hygiene vital card with a score scaled to your cabin,
 * a daily checklist for personal hygiene and cabin sanitation, and a hygiene-only chatbot.
 * Scoring lives in model.ts. Everything is kept in this browser only.
 */

const STATUS_WORD: Record<Status, string> = { NORMAL: "On track", WATCH: "To do", ACT: "Act now" };
const STATUS_TEXT: Record<Status, string> = { NORMAL: "text-ok", WATCH: "text-watch", ACT: "text-act" };
const STATUS_RING: Record<Status, string> = { NORMAL: "border-ok/40", WATCH: "border-watch/50", ACT: "border-act/60" };
const STATUS_BG: Record<Status, string> = { NORMAL: "bg-ok/10", WATCH: "bg-watch/10", ACT: "bg-act/10" };

/* ---------------- storage (this browser only) ---------------- */

const today = () => new Date().toISOString().slice(0, 10);
function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: it just isn't remembered */
  }
}
function loadValues(): Values {
  const s = read<{ date: string; values: Values } | null>("vitals-hygiene", null);
  return s && s.date === today() ? s.values : {};
}
type LiveCabin = { humidity: number | null; airQuality: number | null; at: number; device: string; demo?: boolean };
/** Cabin readings the Live monitor saved in the last 15 minutes, if any. */
function liveCabin(): LiveCabin | null {
  const l = read<LiveCabin | null>("vitals-cabin-live", null);
  return l && Date.now() - l.at < 15 * 60 * 1000 && (l.humidity != null || l.airQuality != null) ? l : null;
}

/* ---------------- tiles ---------------- */

/** `onChange` takes an update from the previous value, so fast repeated clicks all count. */
function Tile({ item, value, cabin, onChange }: { item: Item; value: number | undefined; cabin: Cabin; onChange: (update: (prev: number) => number) => void }) {
  const st = itemStatus(item, value, cabin);
  const v = valueOf(item, value);
  const btn = "h-9 rounded-full border border-white/15 px-4 text-sm font-medium text-white/85 hover:border-primary/60";
  const big = item.kind === "count" ? String(v) : item.kind === "check" ? (v ? "Done" : "Not yet") : item.options[v];
  const goal = target(item, cabin);

  return (
    <div className={`flex flex-col rounded-3xl border bg-[#ffffff]/95 p-6 ${STATUS_RING[st]}`}>
      <div className="flex items-start justify-between gap-3">
        <GlyphTile name={item.icon} tone={st === "ACT" ? "red" : st === "NORMAL" ? "green" : "emerald"} />
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BG[st]} ${STATUS_TEXT[st]}`}>
          <StatusDot status={st} className="!h-1.5 !w-1.5 !shadow-none" /> {STATUS_WORD[st]}
        </span>
      </div>
      <p className="mt-5 text-[15px] font-medium text-white/65">{item.label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className={`font-semibold tabular-nums tracking-tight text-white ${item.kind === "count" ? "text-5xl" : "text-3xl"}`}>{big}</span>
        {item.kind === "count" && <span className="text-base font-medium text-white/45">{item.unit}</span>}
      </p>
      <p className="mt-3 flex-1 text-[14px] leading-relaxed text-white/50">
        {goal && <span className="mr-1 text-white/75">{goal}.</span>}
        {item.why}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.kind === "count" && (
          <>
            <LiquidButton size="sm" type="button" aria-label={`One less: ${item.label}`} onClick={() => onChange((p) => Math.max(0, p - 1))} className={`${btn} px-3`}>
              <Minus className="h-4 w-4" aria-hidden="true" />
            </LiquidButton>
            <LiquidButton size="sm" type="button" aria-label={`One more: ${item.label}`} onClick={() => onChange((p) => Math.min(99, p + 1))} className={`${btn} bg-primary/10 px-3`}>
              <Plus className="h-4 w-4" aria-hidden="true" />
            </LiquidButton>
          </>
        )}
        {item.kind === "check" && (
          <LiquidButton size="sm" type="button" onClick={() => onChange((p) => (p ? 0 : 1))} className={v ? btn : "h-9 rounded-full bg-primary/25 px-4 text-sm font-semibold text-white"}>
            {v ? "Undo" : "Mark done"}
          </LiquidButton>
        )}
        {item.kind === "test" &&
          item.options.map((o, i) => (
            <LiquidButton size="sm"
              key={o}
              type="button"
              aria-pressed={v === i}
              onClick={() => onChange(() => i)}
              className={`h-9 rounded-full border px-3.5 text-sm font-medium ${
                v === i ? (i === 0 ? "border-ok/60 bg-ok/15 text-ok" : i === 2 ? "border-act/60 bg-act/15 text-act" : "border-watch/60 bg-watch/15 text-watch") : "border-white/15 text-white/70 hover:border-primary/60"
              }`}
            >
              {o}
            </LiquidButton>
          ))}
      </div>
    </div>
  );
}

/* ---------------- cabin setup ---------------- */

const field = "h-10 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 text-[15px] text-white placeholder:text-white/35 focus:border-primary/70 focus:outline-none";

function CabinPanel({ name, setName, cabin, setCabin }: { name: string; setName: (s: string) => void; cabin: Cabin; setCabin: Dispatch<SetStateAction<Cabin>> }) {
  const live = liveCabin();
  const num = (s: string, lo: number, hi: number, d: number) => {
    const n = Math.round(Number(s));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6">
      <h2 className="text-xl font-semibold tracking-tight">Your class</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-white/60">Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 28))} placeholder="Your name" className={field} autoComplete="given-name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-white/60">Class</span>
          <input value={cabin.name} onChange={(e) => setCabin({ ...cabin, name: e.target.value.slice(0, 32) })} placeholder="e.g. Class 8B" className={field} />
        </label>
        <div>
          <span className="mb-1.5 block text-sm text-white/60">Students at your table</span>
          <div className="flex h-10 items-center gap-2">
            <LiquidButton size="sm" type="button" aria-label="Fewer students" onClick={() => setCabin((c) => ({ ...c, crew: Math.max(1, c.crew - 1) }))} className="grid h-10 w-10 place-items-center border border-white/15 p-0 hover:border-primary/60">
              <Minus className="h-4 w-4" aria-hidden="true" />
            </LiquidButton>
            <span className="w-10 text-center text-xl font-semibold tabular-nums">{cabin.crew}</span>
            <LiquidButton size="sm" type="button" aria-label="More students" onClick={() => setCabin((c) => ({ ...c, crew: Math.min(8, c.crew + 1) }))} className="grid h-10 w-10 place-items-center border border-white/15 p-0 hover:border-primary/60">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </LiquidButton>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm text-white/60">Humidity %</span>
            <input inputMode="numeric" value={cabin.humidity} onChange={(e) => setCabin({ ...cabin, humidity: num(e.target.value, 0, 100, cabin.humidity), source: "typed" })} className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-white/60">Air +% vs clean</span>
            <input inputMode="numeric" value={cabin.airQuality} onChange={(e) => setCabin({ ...cabin, airQuality: num(e.target.value, 0, 999, cabin.airQuality), source: "typed" })} className={field} />
          </label>
        </div>
      </div>
      {live ? (
        <LiquidButton size="sm"
          type="button"
          onClick={() => setCabin({ ...cabin, humidity: live.humidity ?? cabin.humidity, airQuality: live.airQuality ?? cabin.airQuality, source: "live" })}
          className="inline-flex items-center gap-2 rounded-full border border-ok/40 bg-ok/10 px-4 py-2 text-sm text-ok hover:border-ok"
        >
          <Radio className="h-4 w-4" aria-hidden="true" />
          {cabin.source === "live" ? "Using" : "Use"} {live.demo ? "demo" : "live"} sensor values ({live.humidity ?? "–"}% RH, air +{live.airQuality ?? "–"}%)
        </LiquidButton>
      ) : (
        <p className="text-sm text-white/45">Pair a sensor on the Live monitor page to fill humidity and air quality in automatically.</p>
      )}
      <ul className="space-y-1.5 border-t border-white/10 pt-4 text-[14px] leading-relaxed text-white/60">
        {cabinFactors(cabin).map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden="true">›</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- chatbot scope ---------------- */

const HYGIENE_SCOPE: ChatScope = {
  name: "Hygiene assistant",
  inputId: "hygiene-input",
  placeholder: "Ask about hygiene, cleaning, water or waste…",
  hello: (
    <>
      Hi, I'm the VITALS hygiene assistant. Ask me how to keep yourself and the cabin clean in space: washing up without
      a sink, cleaning routines, mould, water, food safety, the toilet and the rubbish. I can also help with a rash, an
      upset stomach or sore gums.
    </>
  ),
  suggestions: ["How do I wash my hands in space?", "Is there mould on the space station?", "Where does the rubbish go?", "How is drinking water kept clean?", "I have an upset stomach", "I have a rash"],
  followUps: ["How do I wash my hands in space?", "How do astronauts clean the station?", "What should I do if a crewmate is ill?", "How is food kept safe in space?"],
  unknownText:
    "I only cover hygiene and sanitation, and I don't have that in my library yet. Try one of these, or ask the main VITALS assistant about other health questions. If someone is unwell, tell the commander and contact the flight surgeon.",
  library: (p) => p.id.startsWith("hygiene-") || p.id.startsWith("cabin-air-water-food"),
  topics: ["skin", "stomach", "tooth", "cut", "eye", "nausea"],
  tone: "emerald",
  avatar: "soap",
  greet: "Hi! I'm the hygiene assistant. Ask me how to stay clean in space, like washing without a sink, mould, water or the rubbish.",
};

/* ---------------- the page ---------------- */

export default function HygienePage() {
  const [values, setValues] = useState<Values>(loadValues);
  const [cabin, setCabin] = useState<Cabin>(() => {
    const saved = read<Cabin>("vitals-hygiene-cabin", DEFAULT_CABIN);
    const live = liveCabin();
    // Fresh readings from a paired sensor are used automatically unless you typed your own.
    return live && saved.source !== "typed"
      ? { ...saved, humidity: live.humidity ?? saved.humidity, airQuality: live.airQuality ?? saved.airQuality, source: "live" }
      : saved;
  });
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("vitals-name") ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => write("vitals-hygiene", { date: today(), values }), [values]);
  useEffect(() => write("vitals-hygiene-cabin", cabin), [cabin]);
  useEffect(() => {
    try {
      if (name.trim()) localStorage.setItem("vitals-name", name.trim());
    } catch {
      /* not remembered */
    }
  }, [name]);

  const result = useMemo(() => hygieneResult(values, cabin), [values, cabin]);
  const set = (item: Item) => (update: (prev: number) => number) => setValues((s) => ({ ...s, [item.id]: update(valueOf(item, s[item.id])) }));

  return (
    <Shell
      className="font-display"
      eyebrow="Hygiene & sanitation"
      title="Keep yourself and the classroom clean."
      intro="In a full classroom, germs pass from hand to desk to hand in minutes. Your score adapts to your class."
      back={{ label: "Back to VITALS" }}
    >
      <div className="space-y-16">
        {/* ---------- your hygiene card + cabin ---------- */}
        <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,460px)_1fr]">
          <div className="space-y-4">
            <HygieneCard name={name.trim() || "Student"} cabin={cabin} result={result} />
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 ${STATUS_RING[result.status]} ${STATUS_BG[result.status]}`}>
              <p className={`flex items-center gap-2.5 text-base font-semibold ${STATUS_TEXT[result.status]}`}>
                <StatusDot status={result.status} />
                {result.status === "ACT"
                  ? "Something needs attention now"
                  : result.onTrack === result.total
                    ? "All done for today"
                    : `${result.total - result.onTrack} ${result.total - result.onTrack === 1 ? "thing" : "things"} left today`}
              </p>
              <LiquidButton size="sm" type="button" onClick={() => setValues({})} className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-white/80 hover:border-primary/60">
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> New day
              </LiquidButton>
            </div>
          </div>
          <CabinPanel name={name} setName={setName} cabin={cabin} setCabin={setCabin} />
        </section>

        <section>
          <h2 className="mb-5 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <GlyphTile name="soap" tone="emerald" size="sm" /> Personal hygiene
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PERSONAL.map((i) => (
              <Tile key={i.id} item={i} value={values[i.id]} cabin={cabin} onChange={set(i)} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-5 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <GlyphTile name="room" tone="emerald" size="sm" /> Classroom sanitation
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CABIN_ITEMS.map((i) => (
              <Tile key={i.id} item={i} value={values[i.id]} cabin={cabin} onChange={set(i)} />
            ))}
          </div>
        </section>

        <section className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <h2 className="mb-4 flex items-center gap-3 text-2xl font-semibold tracking-tight">
              <GlyphTile name="chat" tone="emerald" size="sm" /> Hygiene assistant
            </h2>
            <p className="max-w-[46ch] leading-relaxed text-white/65">
              No sink? No shower? Mould behind the panels? Ask anything about staying clean in space.
            </p>
          </div>
          <div className="min-w-0 font-sans">
            <ChatPanel scope={HYGIENE_SCOPE} />
          </div>
        </section>

        <p className="border-t border-white/10 pt-6 text-xs leading-relaxed text-white/45">
          The targets and weights are draft values for the demo, based on general school hygiene guidance, and
          still need the team's review. Your name, class and log are kept in this browser only; the log
          starts fresh each day.
        </p>
      </div>
    </Shell>
  );
}
