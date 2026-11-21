/*
 * Recorded voices for the simulator: Mission Control and the four crew, recorded by
 * tools/voices (lines.mjs lists them, manifest.mjs writes voices.json). Clips are found by the exact text
 * the game shows, so a line edited without re-recording simply plays silent. One clip plays at a time.
 */
import type { Decision, Scenario } from "@/simulator/simulation/types";
import clips from "@/simulator/voices.json";

const CLIPS: Record<string, string[]> = clips; // [file, who]
const CREW_LINE = /^(.+?): "(.*)"$/;
let on = true;
let current: HTMLAudioElement | null = null;

// These two must build the same text as tools/voices/lines.mjs, or the clips won't be found.
export const briefingLine = (sc: Scenario) => [sc.story?.intro, sc.briefing, sc.story ? `Your goal: ${sc.story.goal}` : ""].filter(Boolean).join(" ");
export const promptLine = (d: Decision) => `${d.title}${/[.?!]$/.test(d.title) ? "" : "."} ${d.prompt}`;

/** A crew event reads 'Reyes: "…"': split it into speaker and line. Other lines keep their text. */
export function voiceLine(text: string): { who: string | null; line: string } {
  const m = CREW_LINE.exec(text);
  if (m) return { who: m[1], line: m[2] };
  return { who: CLIPS[text]?.[1] ?? null, line: text };
}

export function hush() {
  current?.pause();
  current = null;
}

export function setVoiceOn(v: boolean) {
  on = v;
  if (!v) hush();
}

/** Plays this line's recording, if it has one; reports its length so the subtitle can stay up until it ends. */
export function speak(line: string, onLength?: (ms: number) => void) {
  const clip = CLIPS[line];
  if (!clip || !on) return;
  hush();
  const a = new Audio(import.meta.env.BASE_URL + clip[0]);
  current = a;
  if (onLength) a.addEventListener("loadedmetadata", () => onLength(a.duration * 1000), { once: true });
  a.play().catch(() => {
    /* autoplay blocked or file missing: the subtitle still shows */
  });
}
