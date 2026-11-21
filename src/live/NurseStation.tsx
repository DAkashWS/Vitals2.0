import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { ShinyButton } from "@/components/ui/shiny-button";
import { Glyph, GlyphTile } from "@/components/ui/glyph";
import { loadStudents, saveForStudent, setStationStudent, type StationStudent } from "@/lib/station";

/*
 * Nurse station (on the Live monitor, for the school nurse and teachers): choose the student being
 * checked, take their readings with the sensor, save them to that student's record, then move on to
 * the next student. One student at a time, on the nurse's-room computer.
 */

const card = "rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6";

/** Search and pick the student who is in the nurse's room now. */
export function StudentPicker() {
  const [list, setList] = useState<StationStudent[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const load = async () => {
    setErr("");
    const r = await loadStudents();
    if (typeof r === "string") setErr(r);
    else setList(r);
  };
  useEffect(() => {
    void load();
  }, []);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return (list ?? []).filter(
      (s) => !t || s.display_name.toLowerCase().includes(t) || s.class_name.toLowerCase().includes(t) || (digits && s.crew_number.replace(/\D/g, "").includes(digits)),
    );
  }, [list, q]);

  return (
    <div className={`${card} max-w-3xl`}>
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <GlyphTile name="people" size="sm" /> Who is being checked?
      </h2>
      <p className="mt-2 text-sm text-white/60">Search by name, class or student ID. Their readings are saved to their own record, not yours.</p>
      <div className="mt-4 flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, class or student ID"
          aria-label="Search students"
          className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/40 focus:border-sky-300/70 focus:outline-none"
        />
        <LiquidButton size="icon" type="button" aria-label="Reload the student list" onClick={() => void load()} className="h-11 w-11 text-white">
          <RefreshCw className="h-4 w-4" />
        </LiquidButton>
      </div>
      {err && <p className="mt-4 text-sm text-act">{err}</p>}
      {!list && !err && <p className="mt-4 text-sm text-white/55">Loading students…</p>}
      {list && !shown.length && <p className="mt-4 text-sm text-white/55">{list.length ? "No student matches that." : "No students yet. Students appear once they've built their student card."}</p>}
      <ul className="mt-4 max-h-[420px] divide-y divide-white/10 overflow-y-auto">
        {shown.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => setStationStudent(s)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-white/[0.05]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sm font-bold text-sky-300">
                {s.display_name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-white">{s.display_name || "Unnamed"}</b>
                <span className="block truncate text-xs text-white/50">{[s.class_name || "No class", s.job].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="hidden font-mono text-xs text-white/45 sm:block">{s.crew_number}</span>
              <Glyph name="play" className="h-4 w-4 text-sky-300" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Who is being checked, with Save and Next student. */
export function NurseBar({ student, paired }: { student: StationStudent; paired: boolean }) {
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; text?: string }>({ kind: "idle" });
  useEffect(() => setState({ kind: "idle" }), [student.id]);
  const save = async () => {
    setState({ kind: "saving" });
    const err = await saveForStudent();
    setState(err ? { kind: "error", text: err } : { kind: "saved", text: `Saved to ${student.display_name}'s record at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` });
  };
  return (
    <div className="-mt-4 mb-12 rounded-3xl border border-sky-300/30 bg-gradient-to-r from-sky-400/[0.08] to-transparent p-5">
      <div className="flex flex-wrap items-center gap-4">
        <GlyphTile name="stethoscope" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Nurse station · checking</p>
          <p className="truncate text-xl font-semibold text-white">{student.display_name || "Unnamed"}</p>
          <p className="truncate text-sm text-white/55">{[student.class_name || "No class", student.crew_number].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {paired && (
            <ShinyButton onClick={() => void save()} disabled={state.kind === "saving"} className="h-10 px-5 text-sm">
              {state.kind === "saving" ? "Saving…" : "Save to their record"}
            </ShinyButton>
          )}
          <LiquidButton size="sm" type="button" onClick={() => setStationStudent(null)} className="h-10 px-4 text-sm text-white/80">
            {state.kind === "saved" ? "Next student" : "Change student"}
          </LiquidButton>
        </div>
      </div>
      {state.text && <p className={`mt-3 text-sm ${state.kind === "error" ? "text-act" : "text-ok"}`}>{state.text}</p>}
      {!paired && <p className="mt-3 text-sm text-white/55">Pair the sensor below, then take {student.display_name || "the student"}'s readings.</p>}
    </div>
  );
}
