/*
 * Screen 1: the mission. A quest log, the tutorial (how to play), the quests in story order
 * (all open from the start, in any order) and, once all are passed, the mission debrief.
 */
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { List2, type ListItem } from "@/components/ui/list-2";
import { useAuth } from "@/lib/auth";
import type { Scenario } from "@/simulator/simulation/types";
import { Badge, carryFor, DIFFICULTY, Disclaimer, glass, loadBest, type Best } from "./ui";
import { ShinyButton } from "@/components/ui/shiny-button";

/** the mission debrief comes on this day, after the last quest */
const DEBRIEF_DAY = 60;
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const inWords = (n: number) => WORDS[n] ?? String(n);

const realTime = (s: Scenario) => `about ${Math.round((s.duration * s.secondsPerUnit) / 60 + 0.4)} min`;

const TUTORIAL: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "clipboard", title: "Read the briefing", text: "Every quest opens with the mission day, what's going on, and the one goal you have to reach." },
  { icon: "heartPulse", title: "Watch the vitals", text: "Green is fine, amber is a warning. Stay in the red too long and the quest ends." },
  { icon: "simulator", title: "Act on the station", text: "Drag to look around, W A S D to move. Glowing objects can be clicked: refill the water, fix the scrubber, take shelter." },
  { icon: "timeline", title: "Make the call", text: "The clock stops at each decision point. Pick what the best crews would do." },
  { icon: "delay", title: "Control time", text: "Space pauses or plays. F fast-forwards at 4× through the quiet parts." },
  { icon: "trophy", title: "It all carries forward", text: "How well you pass one quest changes how you start the next. Replay any quest: your best run counts." },
];

const CREW: { icon: GlyphName; name: string; role: string }[] = [
  { icon: "helmet", name: "Cmdr. Ilse Varga", role: "Commander" },
  { icon: "gear", name: "Tomás Reyes", role: "Flight engineer" },
  { icon: "stethoscope", name: "Dr. Amara Okafor", role: "Medical officer" },
  { icon: "flask", name: "Kenji Sato", role: "Science lead" },
];

/** How to play: the steps on a numbered rail, so the order reads at a glance. */
function Tutorial({ day, onStart }: { day: number; onStart: () => void }) {
  return (
    <section className="py-6">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/80">Tutorial</p>
      <h2 className="mb-8 text-3xl font-semibold tracking-tight md:mb-10 md:text-4xl">How to play.</h2>
      <ol className="relative flex flex-col gap-3">
        <span aria-hidden="true" className="absolute bottom-12 left-5 top-12 w-px bg-gradient-to-b from-transparent via-cyan-300/25 to-transparent sm:left-6" />
        {TUTORIAL.map((t, i) => (
          <motion.li
            key={t.title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ type: "spring", stiffness: 260, damping: 30, delay: Math.min(i, 6) * 0.05 }}
            className="relative flex items-start gap-4 sm:gap-6"
          >
            <span className="relative z-10 mt-4 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cyan-300/25 bg-[#fff5f5] font-mono text-xs font-semibold text-cyan-200 sm:h-12 sm:w-12 sm:text-sm">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1 rounded-2xl border border-cyan-300/12 bg-white/[0.03] p-4 transition-colors duration-300 hover:border-cyan-300/30 hover:bg-white/[0.055] sm:p-5">
              <div className="flex items-start gap-3.5">
                <GlyphTile name={t.icon} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white">{t.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-white/65">{t.text}</p>
                </div>
              </div>
              {i === TUTORIAL.length - 1 && (
                <ShinyButton onClick={onStart} className="mt-4 h-10 px-5 text-sm">
                  <span>Start Day {day}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ShinyButton>
              )}
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

const GRADE = (score: number) => (score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D");
const VERDICT: Record<string, string> = {
  A: "An exemplary mission. You caught every problem early and came home healthy. Cleared for the next flight.",
  B: "A strong mission. A few close calls, all handled. Cleared, with notes for training.",
  C: "You made it home, but several problems went too far before you acted. More simulator time before the next flight.",
  D: "You got through, barely. Too many warnings were missed. Replay the quests and bring those grades up.",
};

/** The last day: the report card for the whole mission, with the flight surgeon's verdict and mail from home. */
function MissionDebrief({ scenarios, best, name }: { scenarios: Scenario[]; best: Record<string, Best>; name: string }) {
  const avg = Math.round(scenarios.reduce((n, s) => n + best[s.id].score, 0) / scenarios.length);
  const grade = GRADE(avg);
  return (
    <section className={`${glass} p-7 sm:p-9`}>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-300/90">Day {DEBRIEF_DAY} · Mission debrief</p>
      <div className="mt-3 flex flex-wrap items-center gap-5">
        <GlyphTile name="trophy" size="lg" tone={grade === "A" || grade === "B" ? "green" : "amber"} />
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Mission 61:4 complete.</h2>
          <p className="mt-1 text-white/65">
            {name}, here is your record for all {inWords(scenarios.length)} quests.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-6xl font-bold text-emerald-300">{grade}</p>
          <p className="font-mono text-xs uppercase tracking-wider text-white/50">{avg} / 100 overall</p>
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {scenarios.map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-cyan-200/60">Day {s.story?.day}</p>
            <p className="mt-1 font-semibold">{s.title}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {best[s.id].grade} <span className="text-sm font-normal text-white/50">{best[s.id].score}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-start gap-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.06] p-5">
        <GlyphTile name="stethoscope" tone="green" />
        <div>
          <p className="font-semibold">Flight surgeon's report</p>
          <p className="mt-1 text-[15px] leading-relaxed text-white/70">{VERDICT[grade]}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ["Cmdr. Varga", "I'd fly with you again. You never once made me ask twice."],
          ["Dr. Okafor", "Your numbers told the story before you did. That's what the monitor is for."],
          ["Home", "We watched the station pass over tonight and waved. See you on the ground."],
        ].map(([who, text]) => (
          <div key={who} className="rounded-2xl border border-white/10 bg-[#ffffff]/80 p-5">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-cyan-200/60">
              <Glyph name="envelope" className="h-4 w-4" /> {who} · sent 22 min ago
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-white/75">"{text}"</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ScenarioSelect({ scenarios, onPick }: { scenarios: Scenario[]; onPick: (s: Scenario) => void }) {
  const [best] = useState(loadBest);
  const { profile } = useAuth();
  const name = profile?.display_name || "Student";
  const done = scenarios.filter((s) => best[s.id]?.success).length;
  const allDone = done === scenarios.length;

  // every quest can be played straight away, in any order
  const quests: ListItem[] = scenarios.map((s) => {
    const b = best[s.id];
    const carry = carryFor(s, best);
    return {
      icon: <GlyphTile name={s.icon as GlyphName} size="lg" tone={b?.success ? "green" : "sky"} />,
      title: s.title,
      category: (
        <span className="flex flex-wrap items-center gap-2">
          <Badge className="border-cyan-300/30 bg-cyan-400/10 text-cyan-100">Day {s.story?.day}</Badge>
          <Badge className={DIFFICULTY[s.difficulty]}>{s.difficulty}</Badge>
          <span>{realTime(s)}</span>
          {b && (
            <Badge className={b.success ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-white/20 bg-white/5 text-white/60"}>
              Best {b.grade} · {b.score}
            </Badge>
          )}
        </span>
      ),
      description: (
        <>
          {s.story?.intro ?? s.short}
          {carry && <span className={`mt-1.5 block text-sm font-normal ${carry.good ? "text-emerald-300/90" : "text-amber-300/90"}`}>Carried over: {carry.text}</span>}
        </>
      ),
      action: { label: b ? "Play again" : "Start", onClick: () => onPick(s) },
    };
  });

  return (
    <div className="space-y-6">
      <div className={`${glass} p-6`}>
        <div className="flex flex-wrap items-center gap-5">
          <GlyphTile name="trophy" size="lg" tone={allDone ? "green" : "amber"} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200/60">Mission 61:4 · {DEBRIEF_DAY} days on the station</p>
            <p className="mt-1 text-2xl font-semibold">
              {done} of {scenarios.length} quests completed
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 sm:w-56" role="progressbar" aria-valuemin={0} aria-valuemax={scenarios.length} aria-valuenow={done} aria-label="Quests completed">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all duration-700" style={{ width: `${(done / scenarios.length) * 100}%` }} />
          </div>
        </div>
        <p className="mt-5 text-[15px] leading-relaxed text-white/70">
          You are <strong className="text-white">{name}</strong>
          {profile?.crew_id ? <span className="font-mono text-sm text-white/50"> · {profile.crew_id}</span> : null}, the newest member of a five-person student. {inWords(scenarios.length).replace(/^./, (c) => c.toUpperCase())} things go wrong
          in {DEBRIEF_DAY} days, each one caused by the last. Earth is too far away to fix them for you.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CREW.map((c) => (
            <li key={c.name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <GlyphTile name={c.icon} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{c.name}</span>
                <span className="block text-xs text-white/50">{c.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {allDone && <MissionDebrief scenarios={scenarios} best={best} name={name} />}

      <Tutorial day={scenarios[0].story?.day ?? 1} onStart={() => onPick(scenarios[0])} />
      <List2 eyebrow="The mission" heading={`${scenarios.length} bad days to survive.`} items={quests} />

      {!allDone && (
        <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5 text-white/55">
          <GlyphTile name="lockDoor" tone="amber" />
          <p>
            <strong className="text-white/80">Day {DEBRIEF_DAY} · Mission debrief.</strong> Pass all {inWords(scenarios.length)} quests to get your report card, the flight surgeon's verdict and your mail from home.
          </p>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
