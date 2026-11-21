/* Small pieces shared by the simulator screens: the glass card look, difficulty badges, status colours. */
import type { ReactNode } from "react";
import type { Status } from "@/simulator/simulation/engine";
import type { Scenario } from "@/simulator/simulation/types";

export const glass = "rounded-3xl border border-cyan-300/15 bg-[#fff5f5]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md";
/** The same look without the backdrop blur, for anything over the live 3D view (a blur there is redrawn every frame). */
export const glassSolid = "rounded-3xl border border-cyan-300/15 bg-[#fff5f5]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";

export const DIFFICULTY: Record<Scenario["difficulty"], string> = {
  Easy: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
  Medium: "border-amber-300/30 bg-amber-400/10 text-amber-200",
  Hard: "border-rose-300/30 bg-rose-400/10 text-rose-200",
};

export const STATUS_TEXT: Record<Status, string> = { green: "text-emerald-300", amber: "text-amber-300", red: "text-rose-400" };
export const STATUS_DOT: Record<Status, string> = { green: "bg-emerald-400", amber: "bg-amber-400", red: "bg-rose-500 animate-pulse" };
export const STATUS_BORDER: Record<Status, string> = { green: "border-emerald-300/25", amber: "border-amber-300/40", red: "border-rose-400/60" };

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${className}`}>{children}</span>;
}

export function Disclaimer() {
  return (
    <p className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.18em] text-cyan-100/40">
      Educational simulation using simplified models. Not medical advice.
      <br />
      Spacesuit, station exterior and tools: NASA 3D Resources. Earth: NASA Blue Marble. NASA does not endorse this project.
    </p>
  );
}

/* Best result per quest, kept on this device. shortcut: local only, not in the account; move it to Supabase if scores should follow the crew member. */
export type Best = { score: number; grade: "A" | "B" | "C" | "D"; success: boolean };
const BEST_KEY = "vitals2-sim-best";

export function loadBest(): Record<string, Best> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}") as Record<string, Best>;
  } catch {
    return {};
  }
}

export function saveBest(id: string, b: Best) {
  const all = loadBest();
  const old = all[id];
  if (old && old.score >= b.score && (old.success || !b.success)) return;
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify({ ...all, [id]: { score: b.score, grade: b.grade, success: b.success || !!old?.success } }));
  } catch {
    /* storage blocked: the best score just isn't remembered */
  }
}

/** What the previous quest carries into this one: a better or worse start, from that quest's best run (B or better is good). */
export function carryFor(sc: Scenario, best: Record<string, Best>) {
  const c = sc.story?.carry;
  // every quest is open from the start: one whose earlier quest wasn't played starts neutral, not "bad"
  if (!c || !best[c.from]) return null;
  const good = (best[c.from]?.score ?? 0) >= 75;
  return { good, start: { [c.key]: good ? c.good : c.bad }, text: good ? c.goodText : c.badText };
}
export type Carry = NonNullable<ReturnType<typeof carryFor>>;
