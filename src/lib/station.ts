/*
 * Nurse station: on the nurse's-room computer, the school nurse (or a teacher) checks one student at a
 * time. This remembers which student is being checked (for this browser tab only) and saves that
 * student's readings to their own record through the database function nurse_save_reading().
 */
import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/sync";
import { describe, getMyReadings } from "@/lib/crewDb";

export type StationStudent = { id: string; display_name: string; job: string; crew_number: string; class_name: string };

const KEY = "vitals2-station-student";
let current: StationStudent | null = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
})();
let since = Date.now();
const listeners = new Set<() => void>();

export function stationStudent(): StationStudent | null {
  return current;
}

/** Starts checking a student (or clears it with null, for the next student). */
export function setStationStudent(s: StationStudent | null) {
  current = s;
  since = Date.now();
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
    // the daily log (sleep, water, exercise) belongs to the student being checked: start each one fresh
    localStorage.removeItem("vitals2-daily-log");
  } catch {
    /* storage blocked: kept for this page view only */
  }
  listeners.forEach((l) => l());
}

export function useStationStudent(): StationStudent | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    stationStudent,
  );
}

/** Students the nurse can pick: everyone with a student card (teacher_overview, nurse and teachers only). */
export async function loadStudents(): Promise<StationStudent[] | string> {
  if (!supabase) return "Accounts aren't set up on this copy of the site.";
  if (!navigator.onLine) return "No connection. The nurse station needs the internet to find students.";
  const r = await withTimeout(supabase.rpc("teacher_overview"));
  if (r === "timeout") return "The database took too long to answer. Try again.";
  if (r.error) return r.error.message;
  return (r.data as Record<string, unknown>[]).map((x) => ({
    id: String(x.user_id),
    display_name: String(x.display_name ?? ""),
    job: String(x.job ?? ""),
    crew_number: String(x.crew_number ?? ""),
    class_name: String(x.class_name ?? ""),
  }));
}

/** Saves the readings on screen now to the student being checked. Returns null when saved, or why not. */
export async function saveForStudent(): Promise<string | null> {
  const s = current;
  if (!s) return "Choose a student first.";
  if (!supabase) return "Accounts aren't set up on this copy of the site.";
  if (!navigator.onLine) return "No connection. Connect to the internet to save.";
  const m = await getMyReadings().catch(() => undefined);
  // only readings taken since this student was chosen
  if (!m || m.at < since || !Object.keys(m.readings).length) return "No readings yet for this student. Wait a few seconds for the sensor, then save.";
  const status = describe({ id: s.id, name: s.display_name, role: s.job, crewId: s.crew_number, readings: m.readings, kind: "self", updatedAt: m.at }).status;
  const r = await withTimeout(supabase.rpc("nurse_save_reading", { student: s.id, src: m.source, data: m.readings, status }));
  if (r === "timeout") return "Saving took too long. Try again.";
  if (r.error) return r.error.message;
  return null;
}
