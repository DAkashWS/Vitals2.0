// Records every simulator line with Kokoro on this computer (free, no account, no limits) and saves it as a
// small MP3 in public/audio/voices, then refreshes the manifest. Run from the repo root:
//   node tools/voices/record.mjs            all lines
//   node tools/voices/record.mjs <id>...     just these lines
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { KokoroTTS } from "kokoro-js";
import { Mp3Encoder } from "@breezystack/lamejs";

// One voice per speaker: men and women, all different.
const CAST = {
  "Mission Control": "am_michael",
  "Cmdr. Varga": "bf_emma",
  "Dr. Okafor": "af_heart",
  Reyes: "am_puck",
  Sato: "bm_george",
};

const lines = JSON.parse(execFileSync(process.execPath, ["tools/voices/lines.mjs"], { encoding: "utf8" }));
const only = new Set(process.argv.slice(2));
const todo = only.size ? lines.filter((l) => only.has(l.id)) : lines;
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" });

function mp3(samples, rate) {
  const enc = new Mp3Encoder(1, rate, 64); // mono, 64 kbps: clear speech, small files
  const pcm = Int16Array.from(samples, (s) => Math.max(-32768, Math.min(32767, Math.round(s * 32767))));
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(enc.encodeBuffer(pcm.subarray(i, i + 1152)));
  chunks.push(enc.flush());
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

let n = 0;
for (const l of todo) {
  const voice = CAST[l.who] ?? CAST["Mission Control"];
  const audio = await tts.generate(l.speech, { voice, speed: 0.95 });
  writeFileSync(`public/audio/voices/${l.id}.mp3`, mp3(audio.audio, audio.sampling_rate));
  console.log(`${++n}/${todo.length} ${l.id} (${l.who}, ${voice}, ${(audio.audio.length / audio.sampling_rate).toFixed(1)} s)`);
}
execFileSync(process.execPath, ["tools/voices/manifest.mjs"], { stdio: "inherit" });
