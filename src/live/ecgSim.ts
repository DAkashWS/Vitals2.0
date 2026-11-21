/*
 * Simulated ECG: the same heartbeat as firmware v3 (hardware/vitals_firmware_v3), built from
 * the team's 50-point sample beat (baseline 512). Each point lasts 12 ms, so the P-QRS-T
 * complex keeps a realistic width (PR 168 ms, QRS 96 ms, QT 300 ms) and the rest of the
 * beat is flat baseline; only above 100 bpm is it squeezed to fit. Used by the demo device.
 * Anything made here is marked "ecgSimulated": it is never a measurement and never counts towards the status.
 */

const TEMPLATE = [
  512, 512, 513, 516, 522, 530, 536, 538, 532, 522, // P wave
  515, 512, 512, 512, 512, 512, 498, 465, 560, 890, // Q, rising R
  995, 640, 395, 455, 505, 512, 512, 512, 514, 518, // R peak, S wave
  525, 540, 562, 585, 602, 608, 598, 578, 552, 530, // T wave
  516, 512, 512, 512, 512, 512, 512, 512, 512, 512, // back to baseline
];
const MS_PER_POINT = 12;
const PR_POINTS = 14;
const QRS_POINTS = 8;
const QT_POINTS = 25;

const msPerPoint = (bpm: number) => Math.min(MS_PER_POINT, 60000 / bpm / TEMPLATE.length);

/** Value of the beat `ms` milliseconds after it started, with the 512 baseline removed. */
function beat(ms: number, bpm: number): number {
  const pos = ms / msPerPoint(bpm);
  if (pos >= TEMPLATE.length - 1) return 0;
  const i = Math.floor(pos);
  return TEMPLATE[i] + (TEMPLATE[i + 1] - TEMPLATE[i]) * (pos - i) - 512;
}

/** PR, QRS, QT and QTc (Bazett) in ms for the simulated beat at this heart rate, like firmware v3. */
export function ecgIntervals(bpm: number) {
  const mpp = msPerPoint(bpm);
  const qt = Math.round(QT_POINTS * mpp);
  return {
    ecgPR: Math.round(PR_POINTS * mpp),
    ecgQRS: Math.round(QRS_POINTS * mpp),
    ecgQT: qt,
    ecgQTc: Math.round(qt / Math.sqrt(60 / bpm)),
  };
}

/** Makes 250 samples per call (one second at 250 Hz) following the given heart rate. */
export function makeEcgSimulator() {
  let ms = 0;
  let beatBpm = 72;
  return (bpm: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < 250; i++) {
      ms += 4;
      if (ms >= 60000 / beatBpm) {
        ms = 0;
        beatBpm = bpm + Math.round(Math.random() * 2 - 1); // small beat-to-beat variation
      }
      out.push(Math.round(beat(ms, beatBpm)));
    }
    return out;
  };
}
