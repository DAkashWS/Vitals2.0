/*
 * Crew cards database (IndexedDB, in this browser).
 *
 *   crew      one record per card: the team's cards, plus "your card" made from your own readings
 *   meta      housekeeping: which version of the team's readings is stored, and your latest readings
 *
 * The team's readings live in src/content.ts. When they change, bump TEAM_VERSION and the
 * stored team cards are rewritten on the next visit; cards people added themselves are kept.
 * A crew card's status (green / yellow / red) is always worked out from its readings, using
 * the same ranges as the Readings section, never typed in by hand.
 */

import { crew as TEAM, readings as RANGES } from "@/content";

export type CrewReadings = {
  heart?: number;
  spo2?: number;
  ecg?: number;
  /** room temperature, °C (from the sensor's DHT11) */
  room?: number;
  /** room humidity, % (from the sensor's DHT11) */
  humidity?: number;
  sleep?: number;
  /** water drunk today, litres (daily log) */
  water?: number;
  /** exercise today, minutes (daily log) */
  exercise?: number;
  air?: number;
};

export type CrewCard = {
  id: string;
  name: string;
  role: string;
  crewId: string;
  readings: CrewReadings;
  /** "team" cards come from content.ts; "self" is the card you add from your own readings */
  kind: "team" | "self";
  /** where your readings came from, e.g. "VITALS demo device" */
  source?: string;
  updatedAt: number;
};

/** Your latest readings, saved by the Live monitor. */
export type MyReadings = { name: string; source: string; readings: CrewReadings; at: number };

const DB_NAME = "vitals";
const TEAM_VERSION = 6;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is not available"));
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("crew")) db.createObjectStore("crew", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      // version 2: readings waiting to be uploaded to the signed-in person's account (see src/lib/sync.ts)
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "client_id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: "crew" | "meta" | "outbox", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => {
          db.close();
          resolve(req ? req.result : undefined);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export const teamCards = (): CrewCard[] =>
  TEAM.map((m) => ({ id: `team-${m.crewId.slice(-4)}`, name: m.name, role: m.role, crewId: m.crewId, readings: m.readings, kind: "team" as const, updatedAt: 0 }));

/** Writes the team's cards when they're missing or out of date. */
async function seed() {
  const v = await run<number>("meta", "readonly", (s) => s.get("teamVersion"));
  if (v === TEAM_VERSION) return;
  const old = (await run<CrewCard[]>("crew", "readonly", (s) => s.getAll())) ?? [];
  await run("crew", "readwrite", (s) => {
    for (const c of old) if (c.kind === "team") s.delete(c.id);
    for (const c of teamCards()) s.put(c);
  });
  await run("meta", "readwrite", (s) => s.put(TEAM_VERSION, "teamVersion"));
}

/** Every card: the team first (in team order), then cards people added. */
export async function listCrew(): Promise<CrewCard[]> {
  await seed();
  const all = (await run<CrewCard[]>("crew", "readonly", (s) => s.getAll())) ?? [];
  const order = (c: CrewCard) => (c.kind === "team" ? TEAM.findIndex((m) => m.crewId === c.crewId) : 1000 + c.updatedAt / 1e13);
  return all.sort((a, b) => order(a) - order(b));
}

export const putCard = (c: CrewCard) => run("crew", "readwrite", (s) => s.put(c));
export const deleteCard = (id: string) => run("crew", "readwrite", (s) => s.delete(id));
export const getCard = (id: string) => run<CrewCard>("crew", "readonly", (s) => s.get(id));
export const getMeta = (key: string) => run<unknown>("meta", "readonly", (s) => s.get(key));
export const setMeta = (key: string, value: unknown) => run("meta", "readwrite", (s) => s.put(value, key));

export const saveMyReadings = async (r: MyReadings) => {
  await run("meta", "readwrite", (s) => s.put(r, "myReadings"));
  // while someone is signed in, keep one reading a minute for their history (uploaded by src/lib/sync.ts)
  if (outboxOwner && Date.now() - lastQueued >= 60_000 && Object.keys(r.readings).length) {
    lastQueued = Date.now();
    await queueReading({ client_id: crypto.randomUUID(), user_id: outboxOwner, taken_at: new Date(r.at).toISOString(), source: r.source, data: r.readings });
    onQueued?.();
  }
};

/* ------------------------------------------------------------------ */
/*  Outbox: readings waiting to be uploaded                            */
/* ------------------------------------------------------------------ */

export type OutboxItem = { client_id: string; user_id: string; taken_at: string; source: string; data: CrewReadings };

let outboxOwner: string | null = null;
let lastQueued = 0;
let onQueued: (() => void) | null = null;

/** Set by sync.ts: whose account new readings belong to (null when signed out), and what to do when one is queued. */
export function setOutboxOwner(userId: string | null, queued?: () => void) {
  outboxOwner = userId;
  onQueued = queued ?? null;
}

export const queueReading = (item: OutboxItem) => run("outbox", "readwrite", (s) => s.put(item));
export const listOutbox = async (userId: string) => ((await run<OutboxItem[]>("outbox", "readonly", (s) => s.getAll())) ?? []).filter((i) => i.user_id === userId);
export const removeOutbox = (ids: string[]) =>
  run("outbox", "readwrite", (s) => {
    for (const id of ids) s.delete(id);
  });
export const getMyReadings = () => run<MyReadings>("meta", "readonly", (s) => s.get("myReadings"));

/* ------------------------------------------------------------------ */
/*  Turning readings into what the card shows                          */
/* ------------------------------------------------------------------ */

export type Level = "green" | "yellow" | "red";
const RANK: Record<Level, number> = { green: 0, yellow: 1, red: 2 };

function band(key: string) {
  const r = RANGES.find((x) => x.key === key);
  if (!r) return null;
  const p = (s: string) => s.split(/[–-]/).map(Number) as [number, number];
  return { green: p(r.green), yellow: p(r.yellow) };
}
const BANDS = {
  heart: band("heartRate"),
  spo2: band("spo2"),
  ecg: band("heartRate"),
  room: band("roomTemp"),
  humidity: band("humidity"),
  sleep: band("sleep"),
  water: band("waterIntake"),
  exercise: band("exercise"),
  air: { green: [0, 19] as [number, number], yellow: [0, 50] as [number, number] },
};
const LABEL: Record<keyof CrewReadings, string> = { heart: "heart rate", spo2: "SpO2", ecg: "ECG heart rate", room: "room temperature", humidity: "humidity", sleep: "sleep", water: "water", exercise: "exercise", air: "air quality" };
const UNIT: Record<keyof CrewReadings, string> = { heart: " bpm", spo2: "%", ecg: " bpm", room: " °C", humidity: "%", sleep: " h", water: " L", exercise: " min", air: "% vs clean" };

/** Green, yellow or red for one reading, from the same ranges as the Readings section. */
export function levelOf(key: keyof CrewReadings, v: number): Level {
  const b = BANDS[key];
  if (!b) return "green";
  if (v >= b.green[0] && v <= b.green[1]) return "green";
  if (v >= b.yellow[0] && v <= b.yellow[1]) return "yellow";
  return "red";
}

/** Status, a one-line note and the readings for the back of the card. Only readings that exist are shown. */
export function describe(c: CrewCard): { status: Level; statusNote: string; baselines: { label: string; value: string }[] } {
  const r = c.readings;
  const keys = (Object.keys(LABEL) as (keyof CrewReadings)[]).filter((k) => r[k] != null);
  let status: Level = "green";
  const flagged: string[] = [];
  for (const k of keys) {
    const l = levelOf(k, r[k]!);
    if (l !== "green") flagged.push(`${LABEL[k]} ${r[k]}${UNIT[k]}`);
    if (RANK[l] > RANK[status]) status = l;
  }
  const from = c.kind === "self" && c.source ? ` From ${c.source}.` : "";
  const statusNote =
    status === "green"
      ? `All readings in the green.${from}`
      : `${status === "red" ? "Act" : "Watch"}: ${flagged.join(", ")}.${status === "red" ? " Tell the flight surgeon." : ""}${from}`;
  const fmt: Record<keyof CrewReadings, (v: number) => string> = {
    heart: (v) => `${Math.round(v)}`,
    spo2: (v) => `${Math.round(v)}%`,
    ecg: (v) => `${Math.round(v)}`,
    room: (v) => `${v.toFixed(1)}°`,
    humidity: (v) => `${Math.round(v)}%`,
    sleep: (v) => `${v.toFixed(1)}h`,
    water: (v) => `${v.toFixed(1)}L`,
    exercise: (v) => `${Math.round(v)}m`,
    air: (v) => `+${Math.round(v)}%`,
  };
  const SHORT: Record<keyof CrewReadings, string> = { heart: "Heart", spo2: "SpO2", ecg: "ECG", room: "Room", humidity: "Humidity", sleep: "Sleep", water: "Water", exercise: "Exercise", air: "Air" };
  return { status, statusNote, baselines: keys.map((k) => ({ label: SHORT[k], value: fmt[k](r[k]!) })) };
}

/** A stable 16-digit crew ID made from a name, in the team's 2026 1114 0061 xxxx style. */
/** A new account's crew number: "2026" then 12 random digits. The database checks it's unique. */
export function randomCrewId(): string {
  const n = crypto.getRandomValues(new Uint32Array(3));
  return `2026 ${Array.from(n, (x) => String(x % 10000).padStart(4, "0")).join(" ")}`;
}

export function crewIdFor(name: string): string {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `2026 1114 0061 ${String(h % 10000).padStart(4, "0")}`;
}
