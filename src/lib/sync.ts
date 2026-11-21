/*
 * Sync: uploads readings saved on this device to the signed-in person's account.
 *
 * Built for missions far from Earth: everything is saved on the device first, so VITALS keeps
 * working with no connection. Readings wait in the outbox (src/lib/crewDb.ts) and go up when a
 * connection is there: every 30 s, when the browser comes back online, and right after a new
 * reading is queued. Each reading carries an ID made on the device, so a re-send never stores it twice.
 *
 * Uploads go to:
 *   readings      the full history, readable only by the owner
 *   crew_status   name, job, current status and the latest readings, also readable by commanders and crewmates
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { crewIdFor, describe, getCard, getMeta, listOutbox, putCard, removeOutbox, setMeta, setOutboxOwner, type CrewReadings } from "@/lib/crewDb";
import type { Profile } from "@/lib/auth";

export type SyncState = {
  mode: "guest" | "online" | "offline" | "syncing" | "error";
  waiting: number;
  lastSync: number | null;
  message?: string;
};

let state: SyncState = { mode: "guest", waiting: 0, lastSync: readLast() };
const listeners = new Set<(s: SyncState) => void>();
let userId: string | null = null;
let profile: Profile | null = null;
let running = false;

function readLast(): number | null {
  try {
    return Number(localStorage.getItem("vitals-last-sync")) || null;
  } catch {
    return null;
  }
}

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

/**
 * A database call that gives up after `ms`. On a connection with no internet, Supabase retries the login
 * renewal before every call, which can hold a save up for minutes; the caller then falls back to the device.
 */
export const withTimeout = <T,>(p: PromiseLike<T>, ms = 8000): Promise<T | "timeout"> =>
  Promise.race([Promise.resolve(p), new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms))]);

/*
 * Profile and baseline edits made with no connection, for one account: kept on the device until they
 * reach the account (src/lib/auth.tsx saveProfile writes them, syncNow sends them).
 */
const PENDING_KEY = "vitals-profile-pending";

export function pendingProfile(uid: string): Record<string, unknown> | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as { uid: string; patch: Record<string, unknown> } | null;
    return p?.uid === uid ? p.patch : null;
  } catch {
    return null;
  }
}

/** Adds an edit to the ones waiting; false if this device can't store it. */
export function addPendingProfile(uid: string, patch: Record<string, unknown>): boolean {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ uid, patch: { ...(pendingProfile(uid) ?? {}), ...patch } }));
  } catch {
    return false;
  }
  void syncNow();
  return true;
}

/** Sends waiting profile edits; cleared only if nothing new was added meanwhile. */
async function pushProfile(uid: string) {
  const patch = pendingProfile(uid);
  if (!supabase || !patch) return;
  const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
  if (error) throw error;
  if (JSON.stringify(pendingProfile(uid)) === JSON.stringify(patch)) localStorage.removeItem(PENDING_KEY);
}

/**
 * Your own crew card on a device that doesn't have it yet (a new phone after signing in): rebuilt once from
 * your latest reading in the account. A card you remove isn't brought back on that device.
 */
async function restoreCard(uid: string) {
  const flag = `card-restored-${uid}`;
  if (!supabase || !profile || (await getMeta(flag))) return;
  if (!(await getCard("self"))) {
    const { data, error } = await supabase.from("readings").select("taken_at, source, data").order("taken_at", { ascending: false }).limit(1);
    if (error) throw error;
    const r = data?.[0] as { taken_at: string; source: string; data: CrewReadings } | undefined;
    if (r) {
      const name = profile?.display_name || "You";
      await putCard({ id: "self", name, role: "Student", crewId: profile?.crew_id || crewIdFor(name), readings: r.data, kind: "self", source: r.source, updatedAt: Date.parse(r.taken_at) });
    }
  }
  await setMeta(flag, true);
}

/** Uploads everything waiting for the signed-in person. Safe to call any time. */
export async function syncNow(): Promise<void> {
  if (!supabase || !userId) return set({ mode: "guest", waiting: 0 });
  const uid = userId;
  const items = await listOutbox(uid);
  if (!navigator.onLine) return set({ mode: "offline", waiting: items.length });
  if (running) return;
  running = true;
  set({ mode: "syncing", waiting: items.length });
  try {
    // back from a long time offline the login has expired: renew it first, or the upload is refused
    await supabase.auth.getSession();
    // a missing card is a nicety: never let it hold up the readings
    await restoreCard(uid).catch(() => undefined);
    if (items.length) {
      // what commanders see: the latest reading's status and key vitals (first, so a failure keeps everything queued)
      const latest = items.reduce((a, b) => (a.taken_at > b.taken_at ? a : b));
      await pushStatus(latest.data);
      // a few hundred at a time, each batch cleared once it's stored, so a long offline stretch never
      // becomes one huge upload and a dropped link loses nothing (re-sends are ignored by client_id)
      for (let i = 0; i < items.length; i += 200) {
        const batch = items.slice(i, i + 200);
        const rows = batch.map((r) => ({ client_id: r.client_id, taken_at: r.taken_at, source: r.source, data: r.data }));
        const { error } = await supabase.from("readings").upsert(rows, { onConflict: "user_id,client_id", ignoreDuplicates: true });
        if (error) throw error;
        await removeOutbox(batch.map((r) => r.client_id));
        set({ waiting: items.length - i - batch.length });
      }
    }
    // profile and baseline edits made offline (after the readings, so a refused edit never holds them up)
    await pushProfile(uid);
    const now = Date.now();
    try {
      localStorage.setItem("vitals-last-sync", String(now));
    } catch {
      /* the time just isn't remembered */
    }
    set({ mode: "online", waiting: 0, lastSync: now, message: undefined });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    set({ mode: navigator.onLine ? "error" : "offline", waiting: state.waiting, message: msg });
  } finally {
    running = false;
  }
}

/** Writes the commander-visible summary: name, job, status and three key vitals. */
async function pushStatus(r: CrewReadings) {
  if (!supabase || !userId) return;
  const d = describe({ id: "self", name: "", role: "", crewId: "", readings: r, kind: "self", updatedAt: 0 });
  const core = {
    user_id: userId,
    display_name: profile?.display_name ?? "",
    job: profile?.job ?? "",
    crew_id: profile?.crew_id ?? "",
    status: d.status,
    heart: r.heart ?? null,
    spo2: r.spo2 ?? null,
    room_temp: r.room ?? null,
    humidity: r.humidity ?? null,
    updated_at: new Date().toISOString(),
  };
  // the rest of the latest readings, for the crew board in Crew Link
  const more = { ecg: r.ecg ?? null, sleep: r.sleep ?? null, water: r.water ?? null, exercise: r.exercise ?? null, air: r.air ?? null };
  let { error } = await supabase.from("crew_status").upsert({ ...core, ...more }, { onConflict: "user_id" });
  // a database that hasn't had the newer columns added yet (supabase/schema.sql): send what it has
  if (error?.code === "PGRST204") ({ error } = await supabase.from("crew_status").upsert(core, { onConflict: "user_id" }));
  if (error) throw error;
}

/** Called by the account system whenever who's signed in (or their profile) changes. */
export function setSyncUser(id: string | null, p: Profile | null) {
  userId = id;
  profile = p;
  setOutboxOwner(id, () => void syncNow());
  void syncNow();
}

let started = false;
/** Starts the background sync once: every 30 s, and whenever the browser comes back online. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.setInterval(() => void syncNow(), 30_000);
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("offline", () => set({ mode: userId ? "offline" : "guest" }));
}

export function useSyncState(): SyncState {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => void listeners.delete(setS);
  }, []);
  return s;
}

/** "Synced 2 min ago", "Offline · 14 readings waiting to send", … */
export function syncLabel(s: SyncState): string {
  const ago = (t: number) => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
  };
  const waiting = s.waiting ? ` · ${s.waiting} reading${s.waiting === 1 ? "" : "s"} waiting to send` : "";
  switch (s.mode) {
    case "guest":
      return "Guest mode · data stays on this device";
    case "offline":
      return `Offline${waiting || " · will sync when the link is back"}`;
    case "syncing":
      return `Syncing${waiting}…`;
    case "error":
      return `Couldn't sync yet${waiting} · will retry`;
    default:
      return s.lastSync ? `Synced ${ago(s.lastSync)}` : "Synced";
  }
}
