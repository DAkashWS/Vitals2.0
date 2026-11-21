/*
 * Hygiene & sanitation scoring.
 *
 * Every item has a weight. Your cabin changes the weights and targets:
 *   - more crew sharing the cabin  -> hand cleaning, surfaces, toilet and waste count for more,
 *                                     and the hand-cleaning target goes up
 *   - damp air (humidity >= 60 %)  -> the mould & damp check counts double (triple from 70 %)
 *   - dry air (humidity <= 30 %)   -> skin care counts double
 *   - poor air quality (> 20 %)    -> surfaces and waste count more
 * The score is the weighted share of items done, out of 100. A failed water or mould check,
 * or a week in the same clothes, makes the status red whatever the score.
 *
 * DRAFT values for the demo: the team (Vishnu) should review the targets and weights.
 */

import type { GlyphName } from "@/components/ui/glyph";

export type Status = "NORMAL" | "WATCH" | "ACT";

export type Cabin = {
  name: string;
  crew: number; // people sharing the cabin, 1-8
  humidity: number; // %
  airQuality: number; // % worse than clean air (MQ-135 estimate)
  source: "typed" | "live";
};

export const DEFAULT_CABIN: Cabin = { name: "Crew quarters 1", crew: 4, humidity: 45, airQuality: 10, source: "typed" };

export type Item =
  | { id: string; kind: "count"; icon: GlyphName; label: string; unit: string; why: string; weight: number }
  | { id: string; kind: "check"; icon: GlyphName; label: string; why: string; weight: number }
  | { id: string; kind: "test"; icon: GlyphName; label: string; why: string; weight: number; options: [string, string, string] };

export const PERSONAL: Item[] = [
  { id: "hands", kind: "count", icon: "soap", label: "Hand cleaning", unit: "times today", weight: 3, why: "Before food, after the toilet, after exercise and cleaning, and before touching your face." },
  { id: "teeth", kind: "count", icon: "toothbrush", label: "Teeth brushed", unit: "times today", weight: 2, why: "There's no dentist on board. Brush, then swallow edible toothpaste or spit into a towel." },
  { id: "floss", kind: "check", icon: "floss", label: "Flossed", weight: 1, why: "Sore or bleeding gums are much harder to treat far from Earth." },
  { id: "wipe", kind: "check", icon: "towel", label: "Body wipe-down", weight: 1.5, why: "No showers in space: wet wipes and no-rinse soap keep skin healthy." },
  { id: "skin", kind: "check", icon: "lotion", label: "Skin moisturised", weight: 1, why: "Dry cabin air cracks skin, and cracked skin lets infections in." },
  { id: "clothes", kind: "count", icon: "shirt", label: "Days in the same clothes", unit: "days", weight: 1, why: "There's no laundry: change clothes on schedule and bag the worn ones." },
];

export const CABIN_ITEMS: Item[] = [
  { id: "surfaces", kind: "check", icon: "sponge", label: "Shared surfaces wiped", weight: 2, why: "Handrails, table and exercise equipment: sweat and germs don't fall away in weightlessness." },
  { id: "food", kind: "check", icon: "plate", label: "Food area cleaned", weight: 1.5, why: "Catch crumbs and droplets, bag leftovers, and wipe the table after eating." },
  { id: "toilet", kind: "check", icon: "toilet", label: "Toilet cleaned & checked", weight: 2, why: "Clean the seat and funnel, close lids and valves, and check for leaks." },
  { id: "waste", kind: "check", icon: "bin", label: "Waste bagged & stowed", weight: 1.5, why: "Seal wet waste tightly so smells and germs can't float out." },
  { id: "water", kind: "test", icon: "tap", label: "Water quality check", weight: 3, options: ["Passed", "Not done", "Failed"], why: "Cloudy, smelly or strange-tasting water: don't drink it, report it and use stored water." },
  { id: "mould", kind: "test", icon: "germ", label: "Mould & damp check", weight: 2, options: ["All clear", "Not done", "Found some"], why: "Look behind panels and around vents for condensation, damp patches or musty smells." },
];

export const ALL_ITEMS = [...PERSONAL, ...CABIN_ITEMS];

/** count: n; check: 1 done / 0 not; test: 0 good, 1 not done, 2 bad */
export type Values = Record<string, number>;

export const valueOf = (item: Item, v: number | undefined) => v ?? (item.kind === "test" ? 1 : item.id === "clothes" ? 1 : 0);

/** How many hand cleanings count as "on track" for this cabin. */
export const handsTarget = (c: Cabin) => Math.min(8, 5 + Math.floor((c.crew - 1) / 2));
export const TEETH_TARGET = 2;

export function target(item: Item, c: Cabin): string {
  if (item.id === "hands") return `Green: ${handsTarget(c)} or more for a cabin of ${c.crew}`;
  if (item.id === "teeth") return "Green: twice a day";
  if (item.id === "clothes") return "Green: 3 days or fewer";
  return "";
}

/** 0 to 1: how much of this item is done. */
export function itemScore(item: Item, raw: number | undefined, c: Cabin): number {
  const v = valueOf(item, raw);
  if (item.id === "hands") return Math.min(1, v / handsTarget(c));
  if (item.id === "teeth") return Math.min(1, v / TEETH_TARGET);
  if (item.id === "clothes") return v <= 3 ? 1 : v <= 6 ? 0.5 : 0;
  if (item.kind === "check") return v ? 1 : 0;
  return v === 0 ? 1 : 0; // test
}

export function itemStatus(item: Item, raw: number | undefined, c: Cabin): Status {
  const v = valueOf(item, raw);
  if (item.id === "clothes") return v <= 3 ? "NORMAL" : v <= 6 ? "WATCH" : "ACT";
  if (item.kind === "test") return v === 0 ? "NORMAL" : v === 2 ? "ACT" : "WATCH";
  return itemScore(item, raw, c) >= 1 ? "NORMAL" : "WATCH";
}

/** The item's weight in this cabin, and why it changed. */
export function weight(item: Item, c: Cabin): number {
  let w = item.weight;
  const crowd = 1 + 0.2 * (c.crew - 1);
  if (["hands", "surfaces", "toilet", "waste"].includes(item.id)) w *= crowd;
  if (item.id === "mould") w *= c.humidity >= 70 ? 3 : c.humidity >= 60 ? 2 : 1;
  if (item.id === "skin" && c.humidity <= 30) w *= 2;
  if (["surfaces", "waste"].includes(item.id)) w *= c.airQuality > 50 ? 1.6 : c.airQuality > 20 ? 1.3 : 1;
  return w;
}

/** Plain-language list of how this cabin changes the score. */
export function cabinFactors(c: Cabin): string[] {
  const out: string[] = [];
  if (c.crew > 1)
    out.push(`${c.crew} people share this cabin, so hand cleaning, surfaces, the toilet and waste count ${Math.round(20 * (c.crew - 1))}% more, and the hand-cleaning target is ${handsTarget(c)}.`);
  else out.push("You have this cabin to yourself, so shared-area tasks carry their normal weight.");
  if (c.humidity >= 70) out.push(`Humidity is ${c.humidity}%: very damp, so the mould & damp check counts triple.`);
  else if (c.humidity >= 60) out.push(`Humidity is ${c.humidity}%: damp, so the mould & damp check counts double.`);
  else if (c.humidity <= 30) out.push(`Humidity is ${c.humidity}%: dry, so skin care counts double.`);
  else out.push(`Humidity is ${c.humidity}%: comfortable, no change.`);
  if (c.airQuality > 50) out.push(`Air quality is +${c.airQuality}% worse than clean air, so surfaces and waste count 60% more.`);
  else if (c.airQuality > 20) out.push(`Air quality is +${c.airQuality}% worse than clean air, so surfaces and waste count 30% more.`);
  else out.push(`Air quality is good (+${c.airQuality}%), no change.`);
  return out;
}

export type Result = { score: number; status: Status; onTrack: number; total: number; grade: string };

export function hygieneResult(values: Values, c: Cabin): Result {
  let sum = 0;
  let total = 0;
  let red = false;
  let onTrack = 0;
  for (const item of ALL_ITEMS) {
    const w = weight(item, c);
    total += w;
    sum += w * itemScore(item, values[item.id], c);
    const st = itemStatus(item, values[item.id], c);
    if (st === "ACT") red = true;
    if (st === "NORMAL") onTrack++;
  }
  const score = Math.round((100 * sum) / total);
  const status: Status = red ? "ACT" : score >= 85 ? "NORMAL" : "WATCH";
  const grade = red ? "Needs attention now" : score >= 85 ? "Excellent" : score >= 60 ? "Good, keep going" : score >= 30 ? "Getting there" : "Day just started";
  return { score, status, onTrack, total: ALL_ITEMS.length, grade };
}
