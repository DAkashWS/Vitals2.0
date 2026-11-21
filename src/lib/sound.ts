/*
 * Sound effects and ambience, all made with Web Audio: no sound files to download, so they work offline.
 * Browsers only allow sound after a click; every effect here follows one (Begin, a choice, the checkup button).
 * setSoundOn(false) silences everything, including the ambience.
 */

export type Sfx = "action" | "good" | "bad" | "decision" | "win" | "lose" | "scan" | "normal" | "watch" | "act";
export type Ambience = "cabin" | "suit";

let ctx: AudioContext | null = null;
let on = true;
let bed: { stop: () => void } | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null; // no Web Audio: everything stays silent, the visuals still work
  }
  return on && ctx?.state !== "closed" ? ctx : null;
}

export const unlockAudio = () => void audio();

export function setSoundOn(v: boolean) {
  on = v;
  if (!v) ambience(null);
}

/** One note: frequency (optionally gliding to `to`), start offset and length in seconds, wave shape and loudness. */
function note(a: AudioContext, freq: number, at: number, len: number, type: OscillatorType, vol: number, to?: number, lowpass?: number) {
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + len);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  let out: AudioNode = gain;
  if (lowpass) {
    const f = a.createBiquadFilter();
    f.frequency.value = lowpass;
    gain.connect(f);
    out = f;
  }
  osc.connect(gain);
  out.connect(a.destination);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

/** The red-alarm beep, repeated by the simulator while a vital is in the red. */
export function beep() {
  const a = audio();
  if (!a) return;
  note(a, 880, 0, 0.16, "square", 0.05);
  note(a, 660, 0.16, 0.16, "square", 0.05);
}

export function sfx(kind: Sfx) {
  const a = audio();
  if (!a) return;
  switch (kind) {
    case "action": // something done on the station: a soft confirm
      note(a, 660, 0, 0.09, "sine", 0.05);
      note(a, 990, 0.07, 0.12, "sine", 0.05);
      break;
    case "good": // the best choice: a bright rising chime
      [1047, 1319, 1568].forEach((f, i) => note(a, f, i * 0.08, 0.4, "triangle", 0.045));
      break;
    case "bad": // a mistake: a low falling buzz
      note(a, 220, 0, 0.32, "sawtooth", 0.05, 140, 900);
      break;
    case "decision": // the clock stops: an attention ding-dong
      note(a, 1047, 0, 0.3, "sine", 0.07);
      note(a, 784, 0.2, 0.45, "sine", 0.07);
      break;
    case "win": // quest complete
      [523, 659, 784, 1047].forEach((f, i) => note(a, f, i * 0.11, i === 3 ? 0.8 : 0.3, "triangle", 0.06));
      break;
    case "lose": // quest failed
      [392, 311, 262].forEach((f, i) => note(a, f, i * 0.18, i === 2 ? 0.9 : 0.35, "triangle", 0.06));
      break;
    case "scan": // the body scanner sweeping
      note(a, 300, 0, 1.4, "sine", 0.025, 1200);
      break;
    case "normal": // one reading checked: fine
      note(a, 880, 0, 0.14, "sine", 0.04);
      break;
    case "watch": // one reading checked: keep an eye on it
      note(a, 660, 0, 0.12, "triangle", 0.05);
      note(a, 660, 0.16, 0.12, "triangle", 0.05);
      break;
    case "act": // one reading checked: act now
      note(a, 440, 0, 0.14, "square", 0.04, undefined, 1400);
      note(a, 370, 0.18, 0.22, "square", 0.04, undefined, 1400);
      break;
  }
}

/** A quiet background bed: the cabin's fans and hum, or breathing inside a spacesuit. null stops it. */
export function ambience(kind: Ambience | null) {
  bed?.stop();
  bed = null;
  const a = kind && audio();
  if (!a) return;
  // two seconds of brown noise, looped: the base of both beds
  const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) data[i] = last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
  const noise = a.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const filter = a.createBiquadFilter();
  const level = a.createGain();
  const nodes: AudioScheduledSourceNode[] = [noise];
  if (kind === "cabin") {
    filter.type = "lowpass";
    filter.frequency.value = 420;
    level.gain.value = 0.35;
    const hum = a.createOscillator(); // the station's electrical hum
    const humGain = a.createGain();
    hum.frequency.value = 58;
    humGain.gain.value = 0.012;
    hum.connect(humGain).connect(a.destination);
    nodes.push(hum);
  } else {
    filter.type = "bandpass";
    filter.frequency.value = 700;
    filter.Q.value = 0.7;
    level.gain.value = 0;
    const breath = a.createOscillator(); // one slow breath in and out about every 4.5 s
    const depth = a.createGain();
    breath.frequency.value = 0.22;
    depth.gain.value = 0.5;
    breath.connect(depth).connect(level.gain);
    nodes.push(breath);
  }
  noise.connect(filter).connect(level).connect(a.destination);
  nodes.forEach((n) => n.start());
  bed = { stop: () => nodes.forEach((n) => n.stop()) };
}
