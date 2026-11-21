import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Shell } from "@/live/LivePage";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/sync";
import { ago, ageOf, alertsOf, readinessOf, STALE_MS, type Board, type LogEntry, type Member } from "@/lib/crewLink";
import type { Level } from "@/lib/crewDb";
import { StudentHistory } from "@/teacher/StudentHistory";

/*
 * Teacher dashboard (#/teacher): for teachers and school nurses. Every student's shared status (the same
 * summary Student Link shows: status, key vitals, last sync) grouped by class, the students who need
 * attention first, and recent "need help" / "watch" check-ins from class logs. The database functions
 * teacher_overview() and teacher_checkins() refuse anyone who isn't a teacher or school nurse.
 */

type Row = Member & { class_id: string | null; class_name: string };
type Checkin = { id: number; user_id: string; display_name: string; class_name: string; kind: "help" | "watch"; body: string; created_at: string };

const card = "rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6";
const DOT: Record<Level, string> = { green: "bg-ok", yellow: "bg-watch", red: "bg-act" };
const LABEL: Record<Level, string> = { green: "Fine", yellow: "Watch", red: "Act now" };
const num = (v: unknown) => (v == null ? null : Number(v));
const NO_CLASS = "__none";

async function load(): Promise<{ rows: Row[]; checkins: Checkin[] } | string> {
  if (!supabase) return "Accounts aren't set up on this copy of the site.";
  if (!navigator.onLine) return "No connection. The teacher dashboard needs the internet.";
  const [o, c] = await Promise.all([withTimeout(supabase.rpc("teacher_overview")), withTimeout(supabase.rpc("teacher_checkins", { hours: 48 }))]);
  if (o === "timeout" || c === "timeout") return "The database took too long to answer. Try again.";
  if (o.error) return o.error.message;
  if (c.error) return c.error.message;
  const rows = (o.data as Record<string, unknown>[]).map(
    (r): Row => ({
      user_id: String(r.user_id),
      display_name: String(r.display_name ?? ""),
      job: String(r.job ?? ""),
      crew_number: String(r.crew_number ?? ""),
      role: "member",
      joined_at: "",
      status: (r.status as Level | null) ?? null,
      heart: num(r.heart),
      spo2: num(r.spo2),
      room_temp: num(r.room_temp),
      humidity: num(r.humidity),
      ecg: num(r.ecg),
      sleep: num(r.sleep),
      water: num(r.water),
      exercise: num(r.exercise),
      air: num(r.air),
      updated_at: (r.updated_at as string | null) ?? null,
      class_id: (r.class_id as string | null) ?? null,
      class_name: String(r.class_name ?? ""),
    }),
  );
  return { rows, checkins: c.data as Checkin[] };
}

function Tile({ icon, big, small, tone }: { icon: GlyphName; big: string; small: string; tone?: "red" | "amber" | "green" }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-400/[0.08] via-transparent to-transparent p-6">
      <GlyphTile name={icon} tone={tone} />
      <p className="mt-5 text-4xl font-bold tracking-tight text-white">{big}</p>
      <p className="mt-1.5 text-sm leading-snug text-white/60">{small}</p>
    </div>
  );
}

function Value({ v, unit, digits = 0 }: { v: number | null; unit: string; digits?: number }) {
  return <span className="tabular-nums">{v == null ? "—" : `${v.toFixed(digits)}${unit}`}</span>;
}

function Dashboard({ nurse }: { nurse: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [data, setData] = useState<{ rows: Row[]; checkins: Checkin[] } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cls, setCls] = useState<string>("all");
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    setBusy(true);
    const r = await load();
    setBusy(false);
    setNow(Date.now());
    if (typeof r === "string") return setErr(r);
    setErr("");
    setData(r);
  }, []);

  useEffect(() => {
    void refresh();
    // new readings arrive live; check-ins are refreshed every minute
    const timer = setInterval(() => void refresh(), 60_000);
    const ch = supabase
      ?.channel("teacher-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "crew_status" }, () => void refresh())
      .subscribe();
    return () => {
      clearInterval(timer);
      if (ch) void supabase?.removeChannel(ch);
    };
  }, [refresh]);

  const classes = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.rows ?? []) m.set(r.class_id ?? NO_CLASS, r.class_id ? r.class_name || "Unnamed class" : "No class yet");
    return [...m.entries()].sort((a, b) => (a[0] === NO_CLASS ? 1 : b[0] === NO_CLASS ? -1 : a[1].localeCompare(b[1])));
  }, [data]);

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => cls === "all" || (r.class_id ?? NO_CLASS) === cls), [data, cls]);
  const checkins = useMemo(() => {
    const ids = new Set(rows.map((r) => r.user_id));
    return (data?.checkins ?? []).filter((c) => ids.has(c.user_id));
  }, [data, rows]);
  const alerts = useMemo(() => {
    const log: LogEntry[] = checkins.map((c) => ({ id: String(c.id), user_id: c.user_id, display_name: c.display_name, kind: c.kind, body: c.body, created_at: c.created_at }));
    const board: Board = { crew: { id: "teacher", name: "", mission: "", code: "", created_at: "" }, members: rows, log };
    return alertsOf(board, now).map((a) => ({ ...a, text: a.text.replace("Their buddy should check in.", "Check in with them today.") }));
  }, [rows, checkins, now]);
  const ready = readinessOf(rows, now);
  const quiet = rows.filter((r) => ageOf(r, now) > STALE_MS).length;
  const redCount = new Set(alerts.filter((a) => a.level === "red").map((a) => a.who)).size;
  const sorted = useMemo(() => {
    const rank = (r: Row) => (r.status === "red" ? 0 : r.status === "yellow" ? 1 : ageOf(r, now) > STALE_MS ? 2 : 3);
    return [...rows].sort((a, b) => rank(a) - rank(b) || a.display_name.localeCompare(b.display_name));
  }, [rows, now]);

  if (!data && !err) return <p className="text-white/60">Loading the teacher dashboard…</p>;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-2">
        {[["all", "All students"] as [string, string], ...classes].map(([id, name]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCls(id)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${cls === id ? "border-sky-300/60 bg-sky-400/10 font-semibold text-white" : "border-white/15 bg-white/[0.03] text-white/75 hover:text-white"}`}
          >
            {name}
          </button>
        ))}
        <LiquidButton size="icon" type="button" aria-label="Refresh the dashboard" onClick={() => void refresh()} className="ml-auto h-10 w-10 text-white">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        </LiquidButton>
      </div>
      {err && <p className="rounded-2xl border border-rose-300/30 bg-rose-400/[0.06] px-5 py-3 text-sm text-rose-300">{err}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon="people" big={String(rows.length)} small="students with a student card" />
        <Tile icon="heartPulse" big={`${ready.pct}%`} small={`fine and synced in the last 15 min (${ready.ready} of ${ready.total})`} tone="green" />
        <Tile icon="warning" big={String(redCount)} small="need you now: a red reading or asked for help" tone="red" />
        <Tile icon="hourglass" big={String(quiet)} small="haven't synced for over an hour" tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card} aria-labelledby="t-attention">
          <h2 id="t-attention" className="flex items-center gap-3 text-lg font-semibold">
            <GlyphTile name="warning" size="sm" tone="red" /> Needs attention
          </h2>
          {!alerts.length && <p className="mt-4 text-sm text-white/55">Everyone looks fine right now.</p>}
          <ul className="mt-4 space-y-2">
            {alerts.map((a, i) => (
              <li key={i} className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm ${a.level === "red" ? "border-act/30 bg-act/[0.06]" : "border-watch/30 bg-watch/[0.06]"}`}>
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[a.level]}`} />
                <span>
                  <b className="text-white">{a.who}</b> <span className="text-white/70">{a.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={card} aria-labelledby="t-checkins">
          <h2 id="t-checkins" className="flex items-center gap-3 text-lg font-semibold">
            <GlyphTile name="chat" size="sm" /> Check-ins (last 48 hours)
          </h2>
          {!checkins.length && <p className="mt-4 text-sm text-white/55">No one has asked for help or flagged a problem.</p>}
          <ul className="mt-4 space-y-2">
            {checkins.map((c) => (
              <li key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-x-2">
                  <span className={`h-2 w-2 rounded-full ${c.kind === "help" ? "bg-act" : "bg-watch"}`} />
                  <b className="text-white">{c.display_name || "A student"}</b>
                  <span className="text-white/50">{c.kind === "help" ? "needs help" : "is not feeling great"}</span>
                  <span className="ml-auto text-xs text-white/40">
                    {c.class_name || "No class"} · {ago(now - Date.parse(c.created_at))} ago
                  </span>
                </p>
                {c.body && <p className="mt-1 text-white/70">“{c.body}”</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {nurse && open && (() => {
        const st = data?.rows.find((x) => x.user_id === open);
        return st ? <StudentHistory student={{ user_id: st.user_id, display_name: st.display_name, class_name: st.class_name, crew_number: st.crew_number, updated_at: st.updated_at ?? null }} onClose={() => setOpen(null)} /> : null;
      })()}

      <section className={card} aria-labelledby="t-students">
        <h2 id="t-students" className="flex items-center gap-3 text-lg font-semibold">
          <GlyphTile name="clipboard" size="sm" /> All students
        </h2>
        <p className="mt-2 text-sm text-white/55">
          {nurse
            ? "Each student's latest summary, most urgent first. Click a student to see their full health history."
            : "Each student's shared summary, most urgent first. Their full reading history is kept for them and the school nurse."}
        </p>
        {!sorted.length && <p className="mt-4 text-sm text-white/55">No students here yet. Students appear once they've built their student card.</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.14em] text-white/45">
              <tr>
                <th className="py-2 pr-3 font-medium">Student</th>
                <th className="py-2 pr-3 font-medium">Class</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Heart</th>
                <th className="py-2 pr-3 font-medium">SpO2</th>
                <th className="py-2 pr-3 font-medium">Room</th>
                <th className="py-2 pr-3 font-medium">Sleep</th>
                <th className="py-2 pr-3 font-medium">Water</th>
                <th className="py-2 font-medium">Last sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sorted.map((r) => {
                const age = ageOf(r, now);
                return (
                  <tr key={r.user_id}>
                    <td className="py-3 pr-3">
                      {nurse ? (
                        <button type="button" onClick={() => setOpen(r.user_id)} className="block text-left font-bold text-sky-300 underline-offset-4 hover:underline">
                          {r.display_name || "Unnamed"}
                        </button>
                      ) : (
                        <b className="block text-white">{r.display_name || "Unnamed"}</b>
                      )}
                      <span className="text-xs text-white/45">{r.job}</span>
                    </td>
                    <td className="py-3 pr-3 text-white/70">{r.class_name || "—"}</td>
                    <td className="py-3 pr-3">
                      {r.status ? (
                        <span className="inline-flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${DOT[r.status]}`} />
                          {LABEL[r.status]}
                        </span>
                      ) : (
                        <span className="text-white/40">No readings</span>
                      )}
                    </td>
                    <td className="py-3 pr-3"><Value v={r.heart} unit=" bpm" /></td>
                    <td className="py-3 pr-3"><Value v={r.spo2} unit="%" /></td>
                    <td className="py-3 pr-3"><Value v={r.room_temp} unit="°C" digits={1} /></td>
                    <td className="py-3 pr-3"><Value v={r.sleep} unit=" h" digits={1} /></td>
                    <td className="py-3 pr-3"><Value v={r.water} unit=" L" digits={1} /></td>
                    <td className={`py-3 ${age > STALE_MS ? "text-watch" : "text-white/55"}`}>{age === Infinity ? "never" : `${ago(age)} ago`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function TeacherPage() {
  const { enabled, profile } = useAuth();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const teacher = profile?.role === "commander" || profile?.role === "flight_surgeon";
  return (
    <Shell
      eyebrow={profile?.role === "flight_surgeon" ? "School nurse dashboard" : "Teacher dashboard"}
      title="Your whole school, at a glance."
      intro="Who's fine, who needs checking on, and who has asked for help, live from your students' sensors and class check-ins."
      back={{ label: "Back to VITALS" }}
    >
      {!enabled ? (
        <p className={`${card} text-white/70`}>Accounts aren't set up on this copy of the site, so there's no teacher dashboard here.</p>
      ) : teacher ? (
        <Dashboard nurse={profile?.role === "flight_surgeon"} />
      ) : (
        <div className={`${card} max-w-2xl`}>
          <h2 className="flex items-center gap-3 text-lg font-semibold">
            <GlyphTile name="lockDoor" size="sm" /> For teachers and school nurses
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/70">
            This dashboard shows every student's health summary, so only accounts with the teacher or school nurse role can open it. If you're a
            teacher or the school nurse, ask your school's VITALS administrator to give your account that role.
          </p>
        </div>
      )}
    </Shell>
  );
}
