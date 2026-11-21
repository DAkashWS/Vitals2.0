/*
 * Crew Link: crew members link their crew cards into one crew, watch everyone's live status on one
 * board, check in, and keep a shared crew log. The page is src/crewlink/CrewLinkPage.tsx.
 *
 * The database (supabase/schema.sql, "Crew Link") decides who sees what: only members of a crew can read
 * its board and log, and crews are made, joined and left only through its functions.
 *
 * Built for missions far from Earth like the rest of VITALS: the last board and log are kept on the device,
 * and log entries written with no connection wait in an outbox and are sent when the link is back.
 * Without accounts (or before the database is set up) the page can show a simulated demo crew instead.
 */
import { crew as TEAM } from "@/content";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/sync";
import type { Level } from "@/lib/crewDb";

export type Crew = { id: string; name: string; mission: string; code: string; created_at: string };
export type Member = {
  user_id: string;
  display_name: string;
  job: string;
  crew_number: string;
  role: "lead" | "member";
  joined_at: string;
  status: Level | null;
  heart: number | null;
  spo2: number | null;
  room_temp: number | null;
  humidity: number | null;
  ecg: number | null;
  sleep: number | null;
  water: number | null;
  exercise: number | null;
  air: number | null;
  updated_at: string | null;
};
export type LogKind = "note" | "ok" | "watch" | "help" | "buddy";
export type LogEntry = { id: string; user_id: string; display_name: string; kind: LogKind; body: string; created_at: string; pending?: boolean };
export type Invited = { user_id: string; display_name: string; crew_number: string; created_at: string };
export type Board = { crew: Crew; members: Member[]; log: LogEntry[]; invited?: Invited[] };
/** A crew card to pick when making a crew: any account that has built its card. */
export type CardPick = { user_id: string; display_name: string; job: string; crew_number: string; in_crew: boolean };
/** An invitation waiting for you. */
export type Invite = { crew: string; crew_name: string; mission: string; invited_by: string; members: number; created_at: string };

/** Why the board couldn't load: not set up in the database yet, no connection, or something else. */
export type LoadError = { kind: "setup" | "offline" | "other"; message: string };

const CACHE = "vitals2-crew-link";
const OUTBOX = "vitals2-crew-link-outbox";

/* ------------------------------------------------------------------ */
/*  Reading the board                                                  */
/* ------------------------------------------------------------------ */

function errorOf(e: { message?: string; code?: string } | "timeout"): LoadError {
  if (e === "timeout" || !navigator.onLine) return { kind: "offline", message: "No connection." };
  // missing function or table: the Crew Link part of supabase/schema.sql hasn't been run yet
  if (e.code === "PGRST202" || e.code === "42883" || e.code === "42P01" || e.code === "PGRST205") return { kind: "setup", message: e.message ?? "" };
  if (!e.code) return { kind: "offline", message: e.message ?? "No connection." };
  return { kind: "other", message: e.message ?? "Something went wrong." };
}

/** Your crew, its members and the latest log. null if you're not in a crew. */
export async function loadBoard(): Promise<Board | null> {
  if (!supabase) throw { kind: "setup", message: "Accounts aren't set up on this copy of the site." } satisfies LoadError;
  const crewRes = await withTimeout(supabase.from("crews").select("*").maybeSingle());
  if (crewRes === "timeout" || crewRes.error) throw errorOf(crewRes === "timeout" ? "timeout" : crewRes.error);
  const crew = crewRes.data as Crew | null;
  if (!crew) {
    // the roster call tells a missing setup apart from "no crew yet"
    const probe = await withTimeout(supabase.rpc("crew_roster"));
    if (probe === "timeout" || probe.error) throw errorOf(probe === "timeout" ? "timeout" : probe.error);
    saveCache(null);
    return null;
  }
  const [roster, log, invited] = await Promise.all([
    withTimeout(supabase.rpc("crew_roster")),
    withTimeout(supabase.from("crew_log").select("id, user_id, display_name, kind, body, created_at").order("created_at", { ascending: false }).limit(60)),
    withTimeout(supabase.rpc("crew_invited")),
  ]);
  if (roster === "timeout" || roster.error) throw errorOf(roster === "timeout" ? "timeout" : roster.error);
  if (log === "timeout" || log.error) throw errorOf(log === "timeout" ? "timeout" : log.error);
  const board: Board = {
    crew,
    members: (roster.data as Member[]).map((m) => ({
      ...m,
      heart: num(m.heart),
      spo2: num(m.spo2),
      room_temp: num(m.room_temp),
      humidity: num(m.humidity),
      ecg: num(m.ecg),
      sleep: num(m.sleep),
      water: num(m.water),
      exercise: num(m.exercise),
      air: num(m.air),
    })),
    log: (log.data as LogEntry[]).map((l) => ({ ...l, id: String(l.id) })),
    // the invited list is a nicety: never let it stop the board loading
    invited: invited !== "timeout" && !invited.error ? (invited.data as Invited[]) : [],
  };
  saveCache(board);
  return board;
}

const num = (v: unknown) => (v == null ? null : Number(v));

function saveCache(b: Board | null) {
  try {
    if (b) localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), board: b }));
    else localStorage.removeItem(CACHE);
  } catch {
    /* just not kept for offline */
  }
}

/** The last board this device loaded, for when there's no connection. */
export function cachedBoard(): { at: number; board: Board } | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? "null");
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Making, joining and leaving a crew                                 */
/* ------------------------------------------------------------------ */

async function call(fn: string, args?: Record<string, unknown>): Promise<string | null> {
  if (!supabase) return "Accounts aren't set up on this copy of the site.";
  if (!navigator.onLine) return "You need a connection to do this. Everything else keeps working offline.";
  const res = await withTimeout(supabase.rpc(fn, args));
  if (res === "timeout") return "The VITALS server didn't answer. Try again in a moment.";
  if (res.error) return errorOf(res.error).kind === "setup" ? "Student Link isn't switched on in the database yet." : res.error.message;
  return null;
}

export const createCrew = (name: string, members: string[]) => call("create_crew", { crew_name: name, members });
export const joinCrew = (code: string) => call("join_crew", { invite: code });
export const inviteToCrew = (members: string[]) => call("invite_to_crew", { members });
export const acceptInvite = (crew: string) => call("accept_invite", { target: crew });
export const declineInvite = (crew: string) => call("decline_invite", { target: crew });

/** Crew cards matching a name or any part of a crew number. Needs a connection. */
export async function searchCards(q: string): Promise<CardPick[] | string> {
  if (!supabase) return "Accounts aren't set up on this copy of the site.";
  if (!navigator.onLine) return "Connect to the internet to search student cards.";
  const res = await withTimeout(supabase.rpc("crew_directory", { search: q }));
  if (res === "timeout") return "The VITALS server didn't answer. Try again in a moment.";
  if (res.error) return errorOf(res.error).kind === "setup" ? "Student Link isn't switched on in the database yet." : res.error.message;
  return res.data as CardPick[];
}

/** Invitations waiting for you (empty when offline or not set up). */
export async function loadInvites(): Promise<Invite[]> {
  if (!supabase || !navigator.onLine) return [];
  const res = await withTimeout(supabase.rpc("my_invites"));
  return res === "timeout" || res.error ? [] : (res.data as Invite[]);
}

/** "48213-90375" as it's typed: digits only, a dash after the fifth. */
export function formatCrewCode(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
export async function leaveCrew() {
  const err = await call("leave_crew");
  if (!err) saveCache(null);
  return err;
}

/* ------------------------------------------------------------------ */
/*  The crew log, with an outbox for entries written offline           */
/* ------------------------------------------------------------------ */

type Outgoing = { crew: string; user_id: string; display_name: string; kind: LogKind; body: string; client_id: string; created_at: string };

function readOutbox(): Outgoing[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX) ?? "[]");
  } catch {
    return [];
  }
}
function writeOutbox(items: Outgoing[]) {
  try {
    localStorage.setItem(OUTBOX, JSON.stringify(items));
  } catch {
    /* can't keep it: it's sent now or not at all */
  }
}

/** Entries still waiting to be sent, shown in the log as "waiting to send". */
export function pendingLog(uid: string): LogEntry[] {
  return readOutbox()
    .filter((o) => o.user_id === uid)
    .map((o) => ({ id: o.client_id, user_id: o.user_id, display_name: o.display_name, kind: o.kind, body: o.body, created_at: o.created_at, pending: true }));
}

/** Adds an entry to the log: sent now, or kept and sent when the link is back. */
export async function postLog(e: Omit<Outgoing, "client_id" | "created_at">): Promise<void> {
  writeOutbox([...readOutbox(), { ...e, client_id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
  await flushLog(e.user_id);
}

let flushing = false;
/** Sends the signed-in person's waiting log entries, oldest first. Re-sends are ignored by client_id. */
export async function flushLog(uid: string): Promise<void> {
  if (!supabase || !uid || flushing || !navigator.onLine) return;
  // only your own: the database stamps each entry with whoever is signed in
  const items = readOutbox().filter((o) => o.user_id === uid);
  if (!items.length) return;
  flushing = true;
  try {
    const rows = items.map(({ crew, kind, body, client_id, display_name }) => ({ crew, kind, body, client_id, display_name }));
    const res = await withTimeout(supabase.from("crew_log").upsert(rows, { onConflict: "user_id,client_id", ignoreDuplicates: true }));
    // stored, or refused for good (e.g. you left that crew meanwhile): either way it shouldn't be sent again.
    // No error code means it never reached the server, so it stays for the next try.
    if (res !== "timeout" && (!res.error || res.error.code)) {
      const sent = new Set(items.map((i) => i.client_id));
      writeOutbox(readOutbox().filter((o) => !sent.has(o.client_id)));
    }
  } finally {
    flushing = false;
  }
}

/* ------------------------------------------------------------------ */
/*  Live updates                                                       */
/* ------------------------------------------------------------------ */

/** Calls onChange when a crewmate's status changes or the log gets a new entry. Returns the unsubscribe. */
export function subscribeBoard(crewId: string, onChange: () => void): () => void {
  if (!supabase) return () => undefined;
  const ch = supabase
    .channel(`crew-link-${crewId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "crew_status" }, onChange)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "crew_log", filter: `crew=eq.${crewId}` }, onChange)
    .subscribe();
  return () => void supabase?.removeChannel(ch);
}

/* ------------------------------------------------------------------ */
/*  Working things out from the board                                  */
/* ------------------------------------------------------------------ */

/** A crew member counts as live if they synced in the last 15 minutes, and out of touch after an hour. */
export const LIVE_MS = 15 * 60_000;
export const STALE_MS = 60 * 60_000;
export const ageOf = (m: Member, now: number) => (m.updated_at ? now - Date.parse(m.updated_at) : Infinity);

/**
 * Buddy pairs: each member looks out for one other, in the order they joined. With an odd number,
 * the last three form a trio. A buddy is the first to notice when someone's readings drift.
 */
export function buddiesOf(members: Member[]): Map<string, Member[]> {
  const order = [...members].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  const out = new Map<string, Member[]>();
  const group = (g: Member[]) => g.forEach((m) => out.set(m.user_id, g.filter((x) => x !== m)));
  for (let i = 0; i < order.length; i += 2) {
    if (order.length - i === 3) {
      group(order.slice(i, i + 3));
      break;
    }
    group(order.slice(i, i + 2));
  }
  return out;
}

export type Alert = { level: Level; who: string; text: string };

/** What the crew should look at: red and yellow statuses, help calls, and anyone out of touch. */
export function alertsOf(b: Board, now: number): Alert[] {
  const out: Alert[] = [];
  const recentHelp = new Map<string, LogEntry>();
  for (const l of b.log) if (l.kind === "help" && now - Date.parse(l.created_at) < 6 * 3600_000 && !recentHelp.has(l.user_id)) recentHelp.set(l.user_id, l);
  for (const m of b.members) {
    const name = m.display_name || "A student";
    const help = recentHelp.get(m.user_id);
    if (help) out.push({ level: "red", who: name, text: `asked for help${help.body ? `: "${help.body}"` : ""}. Go to them, and contact the school nurse if needed.` });
    if (m.status === "red") out.push({ level: "red", who: name, text: "has a reading in the red. Check on them now." });
    else if (m.status === "yellow") out.push({ level: "yellow", who: name, text: "has a reading to watch. Their buddy should check in." });
    const age = ageOf(m, now);
    if (age === Infinity) out.push({ level: "yellow", who: name, text: "hasn't shared any readings yet. Pair a sensor on the Live monitor." });
    else if (age > STALE_MS) out.push({ level: "yellow", who: name, text: `hasn't synced for ${ago(age)}. Their sensor may be off.` });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "red" ? -1 : 1));
}

/** Readiness: the share of the crew that is green and live right now. */
export function readinessOf(members: Member[], now: number) {
  const ready = members.filter((m) => m.status === "green" && ageOf(m, now) <= LIVE_MS).length;
  return { ready, total: members.length, pct: members.length ? Math.round((ready / members.length) * 100) : 0 };
}

/** The cabin as the crew's sensors see it: the average and spread of room temperature and humidity. */
export function cabinOf(members: Member[]) {
  const stat = (xs: number[]) => (xs.length ? { avg: xs.reduce((a, b) => a + b, 0) / xs.length, min: Math.min(...xs), max: Math.max(...xs), n: xs.length } : null);
  return {
    temp: stat(members.map((m) => m.room_temp).filter((v): v is number => v != null)),
    humidity: stat(members.map((m) => m.humidity).filter((v): v is number => v != null)),
  };
}

export function ago(ms: number): string {
  if (!isFinite(ms)) return "never";
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} days`;
}

/* ------------------------------------------------------------------ */
/*  Demo crew: the team's cards, simulated, for guests and previews    */
/* ------------------------------------------------------------------ */

const DEMO_SYNC_MIN = [0.2, 3, 1, 75, 0.5];

/** The Mission 61:4 team as a simulated crew. Vitals drift gently each time it's called. */
export function demoBoard(tick: number, now: number): Board {
  const wave = (i: number, amp: number) => Math.sin(tick / 3 + i * 1.7) * amp;
  const members: Member[] = TEAM.map((t, i) => {
    const r = t.readings;
    const heart = r.heart != null ? Math.round(r.heart - 14 + wave(i, 3)) : null;
    const spo2 = r.spo2 != null ? Math.min(100, Math.round(r.spo2 - (i === 2 ? 5 : 0) + wave(i + 3, 0.6))) : null;
    const room = r.room != null ? Math.round((r.room + wave(i + 5, 0.3)) * 10) / 10 : null;
    const humidity = Math.round(46 + i * 2 + wave(i + 7, 1.5));
    const status: Level = spo2 != null && spo2 < 95 ? "yellow" : "green";
    return {
      user_id: `demo-${i}`,
      display_name: t.name,
      job: t.role,
      crew_number: t.crewId,
      role: i === 0 ? "lead" : "member",
      joined_at: new Date(Date.UTC(2026, 10, 10, 9, i)).toISOString(),
      status,
      heart,
      spo2,
      room_temp: room,
      humidity,
      // the ECG counts the same heartbeats as the finger sensor, so it stays within a beat or two
      ecg: r.ecg != null && heart != null ? heart + Math.round(wave(i + 2, 1.2)) : null,
      sleep: r.sleep ?? null,
      water: Math.round((2.6 + i * 0.15 + wave(i + 9, 0.05)) * 10) / 10,
      exercise: 35 + i * 12,
      air: r.air ?? 0,
      updated_at: new Date(now - DEMO_SYNC_MIN[i % DEMO_SYNC_MIN.length] * 60_000).toISOString(),
    };
  });
  const at = (min: number) => new Date(now - min * 60_000).toISOString();
  const by = (i: number) => ({ user_id: `demo-${i}`, display_name: TEAM[i]?.name ?? "Class" });
  const log: LogEntry[] = [
    { id: "d1", ...by(1), kind: "ok", body: "Morning check-in. Slept well.", created_at: at(6) },
    { id: "d2", ...by(0), kind: "buddy", body: `Checked on ${TEAM[2]?.name}: SpO2 a little low, resting and drinking water.`, created_at: at(18) },
    { id: "d3", ...by(2), kind: "watch", body: "Slight headache after PE.", created_at: at(25) },
    { id: "d4", ...by(4), kind: "note", body: "Sensor box recalibrated. Room readings look steady.", created_at: at(52) },
    { id: "d5", ...by(3), kind: "ok", body: "All good before the maths test.", created_at: at(70) },
  ];
  return { crew: { id: "demo", name: "Class 8B", mission: "8B", code: "61402-02026", created_at: at(60 * 24 * 3) }, members, log };
}
