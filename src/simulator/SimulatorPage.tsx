/*
 * Scenario simulator (#/simulator), opened from the "Scenario simulator" card in the Modules tunnel.
 *   1. ScenarioSelect  pick one of the scenarios in /scenarios (JSON)
 *   2. ScenarioRun     play it in 3D, with decisions, actions, pause / play / fast-forward
 *   3. Debrief         timeline, score, mistakes, best actions, and a retry
 * Folders: /scenarios (data), /simulation (rule-based model), /components (screens and 3D scene).
 */
import { useEffect, useState } from "react";
import { Shell } from "@/live/LivePage";
import { SCENARIOS } from "./scenarios";
import type { Scenario } from "./simulation/types";
import { debrief, type SimState } from "./simulation/engine";
import { carryFor, loadBest, saveBest } from "./components/ui";
import ScenarioSelect from "./components/ScenarioSelect";
import ScenarioRun from "./components/ScenarioRun";
import Debrief from "./components/Debrief";

type Screen = { kind: "select" } | { kind: "run"; sc: Scenario; attempt: number } | { kind: "debrief"; sc: Scenario; state: SimState; attempt: number };

const navy = "bg-[radial-gradient(ellipse_at_top,rgba(254,226,226,0.7),rgba(255,251,251,0.96)_60%)]";

export default function SimulatorPage() {
  const [screen, setScreen] = useState<Screen>({ kind: "select" });
  /** the choices made last time, so a retry can show "Last time" */
  const [previous, setPrevious] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen.kind]);

  const toSelect = () => {
    setPrevious(null);
    setScreen({ kind: "select" });
  };

  if (screen.kind === "select") {
    return (
      <Shell
        eyebrow="Scenario simulator"
        title="Rehearse the bad days."
        intro="Seven emergencies, in 3D. Read the vitals, act on the station, make the call at each decision point, and see in the debrief what the best crews do."
        back={{ label: "Back to VITALS" }}
        className={navy}
      >
        <ScenarioSelect
          scenarios={SCENARIOS}
          onPick={(sc) => {
            setPrevious(null);
            setScreen({ kind: "run", sc, attempt: 1 });
          }}
        />
      </Shell>
    );
  }

  if (screen.kind === "run") {
    return (
      <Shell eyebrow={`Scenario simulator · ${screen.sc.difficulty}${screen.attempt > 1 ? ` · attempt ${screen.attempt}` : ""}`} title={screen.sc.title} back={{ label: "All scenarios", onClick: toSelect }} className={navy}>
        <ScenarioRun
          key={`${screen.sc.id}-${screen.attempt}`}
          scenario={screen.sc}
          carry={carryFor(screen.sc, loadBest())}
          previous={previous}
          onDone={(state) => {
            const d = debrief(state, screen.sc);
            saveBest(screen.sc.id, { score: d.score, grade: d.grade, success: d.outcome === "success" });
            setScreen({ kind: "debrief", sc: screen.sc, state, attempt: screen.attempt });
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell eyebrow="Scenario simulator · Debrief" title={screen.sc.title} back={{ label: "All scenarios", onClick: toSelect }} className={navy}>
      <Debrief
        scenario={screen.sc}
        state={screen.state}
        onRetry={() => {
          setPrevious(screen.state.choices);
          setScreen({ kind: "run", sc: screen.sc, attempt: screen.attempt + 1 });
        }}
        onOther={toSelect}
      />
    </Shell>
  );
}
