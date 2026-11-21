/* Screen 3: the debrief. Timeline of what happened, score, mistakes, and the best action at each decision. */
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { clock, debrief, type LogEntry, type SimState } from "@/simulator/simulation/engine";
import type { Scenario } from "@/simulator/simulation/types";
import { Badge, Disclaimer, glass } from "./ui";
import { hush, speak } from "./voice";
import { sfx } from "@/lib/sound";

const KIND: Record<LogEntry["kind"], { icon: GlyphName; label: string }> = {
  event: { icon: "satellite", label: "Event" },
  alert: { icon: "warning", label: "Alert" },
  decision: { icon: "timeline", label: "Decision" },
  action: { icon: "check", label: "Action" },
  end: { icon: "trophy", label: "End" },
};

const GRADE_TONE = { A: "text-emerald-300", B: "text-cyan-300", C: "text-amber-300", D: "text-rose-400" } as const;

export default function Debrief({ scenario: sc, state, onRetry, onOther }: { scenario: Scenario; state: SimState; onRetry: () => void; onOther: () => void }) {
  const d = debrief(state, sc);
  const outcome = d.outcome === "success" ? sc.successText : sc.failText;
  useEffect(() => {
    sfx(d.outcome === "success" ? "win" : "lose");
    speak(outcome);
    return hush;
  }, [outcome]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-6">
      {/* score */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className={`${glass} p-7`}>
          <div className="flex items-center justify-between">
            <GlyphTile name="trophy" tone={d.outcome === "success" ? "green" : "red"} size="lg" />
            <Badge className={d.outcome === "success" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-rose-300/30 bg-rose-400/10 text-rose-200"}>
              {d.outcome === "success" ? "Completed" : "Failed"}
            </Badge>
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-cyan-200/60">Score</p>
          <p className="mt-1 flex items-baseline gap-4">
            <span className="font-mono text-7xl font-bold tabular-nums tracking-tight text-white">{d.score}</span>
            <span className={`font-mono text-4xl font-bold ${GRADE_TONE[d.grade]}`}>{d.grade}</span>
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-white/70">{d.outcome === "success" ? sc.successText : sc.failText}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <LiquidButton type="button" onClick={onRetry} className="inline-flex h-11 items-center gap-2 bg-cyan-400/20 px-5 text-sm font-semibold text-white">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again with a different choice
            </LiquidButton>
            <LiquidButton type="button" onClick={onOther} className="inline-flex h-11 items-center gap-2 px-5 text-sm text-white/80">
              Choose another scenario
            </LiquidButton>
          </div>
        </section>

        {/* best actions */}
        <section className={`${glass} p-7`}>
          <h2 className="flex items-center gap-3 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100">
            <Glyph name="check" className="h-5 w-5 text-emerald-300" /> Recommended best actions
          </h2>
          <ol className="mt-5 space-y-4">
            {d.best.map((b) => {
              const right = b.yours === b.label;
              return (
                <li key={b.title} className="border-l-2 border-emerald-300/40 pl-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">{b.title}</p>
                  <p className="mt-1 font-semibold text-white">{b.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">{b.why}</p>
                  {b.yours && !right && <p className="mt-1.5 text-sm text-rose-300/90">You chose: {b.yours}</p>}
                  {right && <p className="mt-1.5 text-sm text-emerald-300/90">You got this one right.</p>}
                </li>
              );
            })}
            {d.keySteps.map((k) => (
              <li key={k.label} className="border-l-2 border-cyan-300/40 pl-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Key step</p>
                <p className="mt-1 font-semibold text-white">{k.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{k.why}</p>
                <p className={`mt-1.5 text-sm ${k.done && !k.late ? "text-emerald-300/90" : "text-rose-300/90"}`}>{k.done ? (k.late ? "Done, but too late." : "Done in time.") : "Not done."}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* mistakes */}
      <section className={`${glass} p-7`}>
        <h2 className="flex items-center gap-3 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100">
          <Glyph name="warning" className="h-5 w-5 text-rose-300" /> Mistakes flagged
        </h2>
        {d.mistakes.length === 0 ? (
          <p className="mt-4 text-[15px] text-emerald-200/90">None. A clean run.</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {d.mistakes.map((m, i) => (
              <li key={i} className="rounded-2xl border border-rose-400/25 bg-rose-500/[0.06] p-4">
                <p className="font-semibold text-rose-100">{m.text}</p>
                {m.why && <p className="mt-1 text-sm leading-relaxed text-white/60">{m.why}</p>}
                {m.instead && (
                  <p className="mt-2.5 flex gap-2 text-sm leading-relaxed text-emerald-200/90">
                    <Glyph name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>
                      <span className="font-semibold">What to do instead:</span> {m.instead}
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* timeline */}
      <section className={`${glass} p-7`}>
        <h2 className="flex items-center gap-3 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100">
          <Glyph name="timeline" className="h-5 w-5 text-cyan-300" /> Timeline
        </h2>
        <ol className="relative mt-5 space-y-4 border-l border-cyan-300/20 pl-6">
          {state.log.map((e, i) => {
            const k = KIND[e.kind];
            const tone = e.mistake ? "text-rose-300" : e.best ? "text-emerald-300" : e.level === "alert" ? "text-rose-300" : e.level === "warn" ? "text-amber-300" : "text-cyan-300";
            return (
              <li key={i} className="relative">
                <span className="absolute -left-[33px] top-0.5 grid h-4 w-4 place-items-center rounded-full border border-cyan-300/30 bg-[#06102a]">
                  <span className={`h-1.5 w-1.5 rounded-full ${e.mistake || e.level === "alert" ? "bg-rose-400" : e.best ? "bg-emerald-400" : "bg-cyan-300"}`} />
                </span>
                <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">
                  <span className="text-cyan-200/70">{clock(e.t, sc.timeUnit)}</span>
                  <Glyph name={k.icon} className={`h-3.5 w-3.5 ${tone}`} /> {k.label}
                  {e.mistake && <Badge className="border-rose-400/40 bg-rose-500/10 text-rose-200">Mistake</Badge>}
                  {e.best && <Badge className="border-emerald-300/40 bg-emerald-400/10 text-emerald-200">Best choice</Badge>}
                </p>
                <p className="mt-1 text-[15px] text-white/85">{e.text}</p>
                {e.detail && <p className="mt-0.5 text-sm leading-relaxed text-white/55">{e.detail}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      <Disclaimer />
    </div>
  );
}
