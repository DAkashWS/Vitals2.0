/*
 * Every scenario in this folder. To add one, drop a new JSON file here that follows
 * src/simulator/simulation/types.ts. It shows up on the selection screen, in `order`.
 */
import type { Scenario } from "@/simulator/simulation/types";

const files = import.meta.glob("./*.json", { eager: true, import: "default" }) as Record<string, Scenario>;

// The crew's story messages join the scenario's own events, so the engine plays them in the log like any other.
const withCrew = (sc: Scenario): Scenario =>
  sc.story ? { ...sc, events: [...sc.events, ...sc.story.crew.map((c) => ({ at: c.at, text: `${c.who}: "${c.text}"`, level: "info" as const }))].sort((a, b) => a.at - b.at) } : sc;

export const SCENARIOS: Scenario[] = Object.values(files)
  .map(withCrew)
  .sort((a, b) => a.order - b.order);

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id) ?? null;
