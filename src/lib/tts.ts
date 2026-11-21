/*
 * "Text To Speech" and Read aloud for the chatbots, with the browser's own voices: instant, nothing to
 * download, and offline with the computer's system voices. Online it prefers the browser's high-quality
 * network voices (Edge's "Natural" ones, Chrome's "Google" ones).
 *
 * Each chatbot has a man's or a woman's voice of its own and its own pace. The pitch is never changed:
 * that made the voices sound warped. Text is queued a sentence at a time (Chrome can cut one long
 * utterance short), and a new answer waits a moment after cancelling the last one (Chrome garbles a
 * speak() that comes straight after a cancel()). One answer speaks at a time.
 */
export type TtsState = { id: string | null };

let state: TtsState = { id: null };
const subs = new Set<() => void>();
const set = (s: TtsState) => {
  state = s;
  subs.forEach((f) => f());
};
export const getTts = () => state;
export const subscribeTts = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

/** Each chatbot's voice: a woman's (f) or a man's (m), and its pace. */
const BOTS: Record<string, { gender: "f" | "m"; rate: number }> = {
  "assistant-input": { gender: "f", rate: 1 },
  "medicine-input": { gender: "f", rate: 0.96 },
  "bone-input": { gender: "m", rate: 1.04 },
  "environment-input": { gender: "m", rate: 0.97 },
  "fluid-input": { gender: "f", rate: 1.04 },
  "isolation-input": { gender: "f", rate: 0.93 },
  "hygiene-input": { gender: "m", rate: 1 },
};
const FEMALE = /female|zira|hazel|susan|aria|jenny|ava|emma|libby|sonia|natasha|heera|catherine|linda|samantha|karen|moira|tessa|fiona|victoria|allison|michelle|serena|clara|emily|neerja/i;
const MALE = /\bmale|david|mark|george|guy|ryan|christopher|eric|james|ravi|sean|daniel|alex|fred|oliver|thomas|william|andrew|brian|roger|steffan|prabhat|liam/i;
/** 0 = neural network voice, 1 = Google's, 2 = plain system voice */
const quality = (v: SpeechSynthesisVoice) => (/natural|neural/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : 2);

/** set when a network voice failed (a connection with no internet): use the computer's own voices until the link is back */
let localOnly = false;
if (typeof window !== "undefined") window.addEventListener("online", () => (localOnly = false));

function voiceFor(bot: string): SpeechSynthesisVoice | null {
  const { gender } = BOTS[bot] ?? BOTS["assistant-input"];
  const en = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang) && ((navigator.onLine && !localOnly) || v.localService));
  const [mine, other] = gender === "f" ? [FEMALE, MALE] : [MALE, FEMALE];
  const pool = en.filter((v) => mine.test(v.name) && !other.test(v.name));
  const usable = (pool.length ? pool : en).sort((a, b) => quality(a) - quality(b));
  if (!usable.length) return null;
  // bots of the same gender take different voices where the computer has several of the best kind
  const best = usable.filter((v) => quality(v) === quality(usable[0]));
  const sameGender = Object.keys(BOTS).filter((b) => BOTS[b].gender === gender);
  return best[Math.max(0, sameGender.indexOf(bot)) % best.length];
}

/** Chrome fills its voice list a moment after the page loads. */
function voicesReady(): Promise<void> {
  if (speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise((done) => {
    const t = setTimeout(done, 1500);
    speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(t);
        done();
      },
      { once: true },
    );
  });
}

/** bumped by every new answer or Stop, so an older one quietly gives up */
let run = 0;

export function stopSpeaking() {
  run++;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  set({ id: null });
}

/** Reads `text` aloud in `bot`'s voice (a chat panel's inputId); `id` names the answer, so its button can show Stop. */
export async function speakText(id: string, text: string, bot: string) {
  stopSpeaking();
  if (!("speechSynthesis" in window)) return;
  const mine = run;
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => /\w/.test(s));
  if (!sentences.length) return;
  set({ id });
  await voicesReady();
  await new Promise((r) => setTimeout(r, 80)); // let the cancel settle before speaking again
  if (run !== mine) return;
  const voice = voiceFor(bot);
  const rate = (BOTS[bot] ?? BOTS["assistant-input"]).rate;
  sentences.forEach((s, i) => {
    const u = new SpeechSynthesisUtterance(s);
    u.voice = voice;
    u.lang = voice?.lang ?? "en-US";
    u.rate = rate;
    if (i === sentences.length - 1) u.onend = () => run === mine && set({ id: null });
    u.onerror = (e) => {
      if (run !== mine || e.error === "interrupted" || e.error === "canceled") return;
      // a network voice with no internet: read the answer again with a voice installed on this device
      if (voice && !voice.localService && !localOnly) {
        localOnly = true;
        return void speakText(id, text, bot);
      }
      set({ id: null });
    };
    speechSynthesis.speak(u);
  });
}
