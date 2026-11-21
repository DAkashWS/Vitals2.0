/*
 * A student's saved readings from their account (Supabase), including the ones the school nurse saved
 * for them at the nurse station. Used for "your latest readings" and "your averages" on the account page,
 * so a check in the nurse's room shows up on the student's own account on any device.
 */
import { supabase } from "@/lib/supabase";
import type { CrewReadings, MyReadings } from "@/lib/crewDb";

export type Average = { key: keyof CrewReadings; label: string; unit: string; avg: number; min: number; max: number; n: number };
export type Saved = { at: number; source: string; nurse: boolean; data: CrewReadings };
export type History = { rows: Saved[]; latest: MyReadings | null; averages: Average[]; checks: number; nurseChecks: number; lastNurseAt: number | null; days: number };

const KEYS: { key: keyof CrewReadings; label: string; unit: string; dp: number }[] = [
  { key: "heart", label: "Heart rate", unit: "bpm", dp: 0 },
  { key: "spo2", label: "Blood oxygen", unit: "%", dp: 0 },
  { key: "ecg", label: "ECG heart rate", unit: "bpm", dp: 0 },
  { key: "room", label: "Room temperature", unit: "°C", dp: 1 },
  { key: "humidity", label: "Humidity", unit: "%", dp: 0 },
  { key: "air", label: "Air quality", unit: "", dp: 0 },
  { key: "sleep", label: "Sleep", unit: "h", dp: 1 },
  { key: "water", label: "Water", unit: "L", dp: 1 },
  { key: "exercise", label: "Exercise", unit: "min", dp: 0 },
];

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

/** The last `days` days of this account's readings, summarised. Null if it can't be loaded. */
export async function loadHistory(userId: string, days = 30): Promise<History | null> {
  if (!supabase || !navigator.onLine) return null;
  const from = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from("readings")
    .select("taken_at, source, data")
    .eq("user_id", userId)
    .gte("taken_at", from)
    .order("taken_at", { ascending: false })
    .limit(1000);
  if (error || !data) return null;
  const rows = data as { taken_at: string; source: string; data: CrewReadings }[];
  const nurse = rows.filter((r) => (r.source ?? "").includes("(nurse station)"));
  const averages: Average[] = [];
  for (const k of KEYS) {
    const vals = rows.map((r) => Number(r.data?.[k.key])).filter((v) => Number.isFinite(v) && v > 0);
    if (!vals.length) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    averages.push({ key: k.key, label: k.label, unit: k.unit, avg: round(avg, k.dp), min: round(Math.min(...vals), k.dp), max: round(Math.max(...vals), k.dp), n: vals.length });
  }
  const top = rows[0];
  return {
    rows: rows.map((r) => ({ at: Date.parse(r.taken_at), source: r.source ?? "", nurse: (r.source ?? "").includes("(nurse station)"), data: r.data ?? {} })),
    latest: top ? { name: "", source: top.source, readings: top.data ?? {}, at: Date.parse(top.taken_at) } : null,
    averages,
    checks: rows.length,
    nurseChecks: nurse.length,
    lastNurseAt: nurse[0] ? Date.parse(nurse[0].taken_at) : null,
    days,
  };
}
