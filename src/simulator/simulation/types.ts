/*
 * Scenario simulator: the shape of a scenario file (src/simulator/scenarios/*.json).
 *
 * Everything a scenario does is data: vitals with start values and rates of change,
 * timed events, decision points with choices, and actions on clickable objects in the
 * 3D scene. The engine (engine.ts) only applies these rules, so a new scenario is a new
 * JSON file and nothing else. Time is counted in the scenario's own unit ("min" or "h").
 */

/** Values inside `green` are fine, inside `amber` need watching, anything else is red. */
export type Band = { green: [number, number]; amber: [number, number] };

export type VitalDef = {
  key: string;
  label: string;
  unit: string;
  start: number;
  /** change per time unit, before any effects or rules */
  rate: number;
  min: number;
  max: number;
  decimals: number;
  band: Band;
  /** shown in the overlay; hidden vitals still drive rules */
  show?: boolean;
  /** this value grows by another vital's value × factor each time unit (e.g. dose from dose rate) */
  integrates?: { key: string; factor: number };
  /** while a flag is set, the value is multiplied by `factor` (e.g. a storm shelter cuts the dose rate) */
  scale?: { flag: string; factor: number };
};

/** What a choice, action or event does to the simulation. */
export type Effect = {
  /** set values outright */
  set?: Record<string, number>;
  /** add to values once */
  add?: Record<string, number>;
  /** replace rates of change */
  rate?: Record<string, number>;
  /** add to rates of change */
  rateAdd?: Record<string, number>;
  /** turn flags on or off (flags drive the 3D scene and unlock actions) */
  flags?: Record<string, boolean>;
  /** end the scenario now */
  end?: "success" | "fail";
};

/** A rule that runs every step while its condition holds: "if CO2 > 1 %, heart rate climbs". */
export type Rule = {
  key?: string;
  above?: number;
  below?: number;
  flag?: string;
  notFlag?: string;
  rateAdd: Record<string, number>;
};

export type Choice = {
  id: string;
  label: string;
  /** what happens, shown after the choice */
  feedback: string;
  effect?: Effect;
  /** 0 for the best choice, negative for weaker ones */
  score: number;
  best?: boolean;
  mistake?: boolean;
};

export type Decision = {
  id: string;
  at: number;
  title: string;
  prompt: string;
  choices: Choice[];
};

export type ObjectId = "scrubber" | "waterUnit" | "hatch" | "medKit" | "bed" | "window" | "task1" | "task2" | "task3" | "airlock";

export type Action = {
  id: string;
  object: ObjectId;
  label: string;
  message: string;
  effect?: Effect;
  /** only available while this flag is set */
  requires?: string;
  /** hidden once this flag is set */
  hideIf?: string;
  once?: boolean;
  /** time units before it can be used again */
  cooldown?: number;
  score?: number;
  mistake?: boolean;
};

export type TimedEvent = { at: number; text: string; level?: "info" | "warn" | "alert"; effect?: Effect };

/** Something the crew should have done, and by when. Checked in the debrief. */
export type KeyStep = { flag: string; by: number; label: string; why: string };

/** The quest's place in the mission story. */
export type Story = {
  /** mission day */
  day: number;
  /** why this is happening */
  intro: string;
  /** the one thing to achieve */
  goal: string;
  /** short messages from the crew, at these times */
  crew: { at: number; who: string; text: string }[];
  /** what the previous quest changes here: a vital starts better (good) or worse (bad) */
  carry?: { from: string; key: string; good: number; bad: number; goodText: string; badText: string };
};

export type Scenario = {
  id: string;
  order: number;
  title: string;
  short: string;
  difficulty: "Easy" | "Medium" | "Hard";
  icon: string;
  setting: "interior" | "exterior";
  /** which 3D effects to run */
  look: "co2" | "smoke" | "radiation" | "dehydration" | "sleep" | "spacewalk";
  timeUnit: "min" | "h";
  /** real seconds per time unit at 1× speed */
  secondsPerUnit: number;
  duration: number;
  briefing: string;
  story?: Story;
  objects: ObjectId[];
  flags?: Record<string, boolean>;
  vitals: VitalDef[];
  rules?: Rule[];
  events: TimedEvent[];
  decisions: Decision[];
  actions: Action[];
  keySteps: KeyStep[];
  /** time units in the red, in a row, before the scenario fails */
  failAfterRed: number;
  /** score lost per time unit in the red */
  redPenalty: number;
  successText: string;
  failText: string;
};
