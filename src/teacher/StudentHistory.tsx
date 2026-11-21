import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { GlyphTile } from "@/components/ui/glyph";
import { loadHistory, type History } from "@/lib/history";

/*
 * Head nurse only: one student's full saved history, read from the same rows the student sees on their own
 * account (so both always match): averages, every saved reading, and which ones were nurse-station checks.
 */

const card = "rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6";
const PERIODS = [
  [7, "7 days"],
  [30, "30 days"],
  [90, "3 months"],
  [365, "1 year"],
] as const;
const COLS: { key: "heart" | "spo2" | "ecg" | "room" | "humidity" | "sleep" | "water" | "exercise"; label: string; unit: string }[] = [
  { key: "heart", label: "Heart", unit: " bpm" },
  { key: "spo2", label: "SpO2", unit: "%" },
  { key: "ecg", label: "ECG", unit: " bpm" },
  { key: "room", label: "Room", unit: "°C" },
  { key: "humidity", label: "Humidity", unit: "%" },
  { key: "sleep", label: "Sleep", unit: " h" },
  { key: "water", label: "Water", unit: " L" },
  { key: "exercise", label: "Exercise", unit: " min" },
];

export type HistoryStudent = { user_id: string; display_name: string; class_name: string; crew_number: string; updated_at: string | null };

export function StudentHistory({ student, onClose }: { student: HistoryStudent; onClose: () => void }) {
  const [days, setDays] = useState(30);
  const [hist, setHist] = useState<History | null | "error">(null);
  const box = useRef<HTMLElement>(null);
  useEffect(() => box.current?.scrollIntoView({ behavior: "smooth", block: "start" }), [student.user_id]);
  // reloads when the student syncs a new reading (updated_at changes live on the dashboard)
  useEffect(() => {
    let alive = true;
    setHist(null);
    void loadHistory(student.user_id, days).then((h) => alive && setHist(h ?? "error"));
    return () => {
      alive = false;
    };
  }, [student.user_id, days, student.updated_at]);
  const when = (t: number) => new Date(t).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const h = hist && hist !== "error" ? hist : null;
  const cols = h ? COLS.filter((c) => h.rows.some((r) => Number(r.data[c.key]) > 0)) : [];

  return (
    <section ref={box} className={`${card} scroll-mt-6 border-sky-300/30`} aria-label={`${student.display_name}'s health history`}>
      <div className="flex flex-wrap items-start gap-4">
        <GlyphTile name="stethoscope" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Health history · head nurse</p>
          <h2 className="truncate text-xl font-semibold text-white">{student.display_name || "Unnamed"}</h2>
          <p className="text-sm text-white/55">{[student.class_name || "No class", student.crew_number].filter(Boolean).join(" · ")}</p>
        </div>
        <LiquidButton size="icon" type="button" aria-label="Close the history" onClick={onClose} className="h-10 w-10 text-white">
          <X className="h-4 w-4" />
        </LiquidButton>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {PERIODS.map(([d, label]) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${days === d ? "border-sky-300/60 bg-sky-400/10 text-sky-300" : "border-white/15 text-white/65 hover:bg-white/[0.05]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {hist === null && <p className="mt-5 text-sm text-white/55">Loading their history…</p>}
      {hist === "error" && <p className="mt-5 text-sm text-act">Couldn't load this student's history. Check the connection and try again.</p>}
      {h && (
        <>
          <p className="mt-5 text-sm text-white/60">
            {h.checks} saved reading{h.checks === 1 ? "" : "s"} · {h.nurseChecks} nurse check{h.nurseChecks === 1 ? "" : "s"}
            {h.lastNurseAt ? ` · last nurse check ${when(h.lastNurseAt)}` : ""}. The student sees the same history on their account.
          </p>
          {!h.rows.length && <p className="mt-4 text-sm text-white/55">No saved readings in this period.</p>}
          {!!h.averages.length && (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {h.averages.map((a) => (
                <div key={a.key} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <dt className="text-xs uppercase tracking-[0.15em] text-white/50">{a.label} · average</dt>
                  <dd className="mt-1 text-2xl font-semibold text-white">
                    {a.avg}
                    <span className="ml-1 text-sm font-normal text-white/50">{a.unit}</span>
                  </dd>
                  <dd className="text-xs text-white/45">{a.n > 1 ? `Range ${a.min} to ${a.max} · ${a.n} readings` : "1 reading"}</dd>
                </div>
              ))}
            </dl>
          )}
          {!!h.rows.length && (
            <div className="mt-5 max-h-[420px] overflow-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 bg-[#ffffff] text-xs uppercase tracking-[0.14em] text-white/45">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Taken</th>
                    <th className="py-2 pr-3 font-medium">By</th>
                    {cols.map((c) => (
                      <th key={c.key} className="py-2 pr-3 font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {h.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-3 text-white/80">{when(r.at)}</td>
                      <td className="py-2.5 pr-3">
                        {r.nurse ? <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-xs font-semibold text-sky-300">Nurse</span> : <span className="text-xs text-white/50">Student</span>}
                      </td>
                      {cols.map((c) => {
                        const v = Number(r.data[c.key]);
                        return (
                          <td key={c.key} className="py-2.5 pr-3 text-white/80">
                            {Number.isFinite(v) && v > 0 ? `${Math.round(v * 10) / 10}${c.unit}` : <span className="text-white/30">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
