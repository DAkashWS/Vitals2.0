// After recording: list which lines have a clip in public/audio/voices, for the game to look up by text.
// Run from the repo root: node tools/voices/manifest.mjs   ->  writes src/simulator/voices.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const lines = JSON.parse(execFileSync(process.execPath, ["tools/voices/lines.mjs"], { encoding: "utf8" }));
const clips = {};
const missing = [];
for (const l of lines) {
  const file = `audio/voices/${l.id}.mp3`;
  if (existsSync(`public/${file}`)) clips[l.text] = [file, l.who];
  else missing.push(l.id);
}
writeFileSync("src/simulator/voices.json", JSON.stringify(clips, null, 1) + "\n");
console.log(`${Object.keys(clips).length} of ${lines.length} lines have a voice clip.`);
if (missing.length) console.log(`Not recorded yet (${missing.length}): ${missing.join(", ")}`);
