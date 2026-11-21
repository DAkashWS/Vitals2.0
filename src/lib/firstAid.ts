/*
 * Emergency rules for the VITALS 2.0 chatbots. Everything else a student asks goes to the online
 * assistant (src/lib/ai.ts and the "chat" function in Supabase), but these red flags are answered
 * here, instantly and offline, with fixed steps that were checked by the team: an emergency never
 * waits for, or depends on, the AI.
 */

export type Reply =
  | { kind: "urgent"; title: string; steps: string[]; matched: string }
  | { kind: "chat"; text: string }
  | { kind: "unknown" };

/** Light stemming: enough to match "breathing"/"breathe", "swollen"/"swell" phrases in common forms. */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ied")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es") && /(ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

const NURSE = "get the school nurse or a first aider";

/* Red flags: anything here skips normal advice. */
/*
 * `match`: phrases. `together`: groups of words that, all appearing anywhere in the
 * message, also count ("my chest feels really tight" → chest + tight).
 */
const RED_FLAGS: { match: string[]; together?: string[][]; title: string; steps: string[] }[] = [
  {
    match: ["chest pain", "chest tight", "chest pressure", "pain in my chest", "heart attack", "tight chest"],
    together: [["chest", "pain"], ["chest", "tight"], ["chest", "hurt"], ["chest", "pressure"], ["chest", "ache"], ["chest", "heavy"], ["chest", "crushing"]],
    title: "Chest pain can be serious",
    steps: [
      "Stop what you're doing and sit down.",
      "Tell a teacher now, and " + NURSE + " immediately.",
      "If you have asthma, use your reliever inhaler as your plan says.",
      "If it's severe, spreads to the arm or jaw, or comes with sweating or breathlessness, an adult should call an ambulance.",
    ],
  },
  {
    match: ["can't breathe", "cant breathe", "cannot breathe", "difficulty breathing", "short of breath", "shortness of breath", "choking", "struggling to breathe", "trouble breathing", "hard to breathe", "out of breath", "asthma attack", "wheezing"],
    together: [["breathe", "can't"], ["breathe", "cant"], ["breathing", "hard"], ["breath", "catch"]],
    title: "Breathing trouble needs help now",
    steps: [
      "Tell a teacher now, and " + NURSE + " immediately.",
      "Asthma: sit up straight, stay calm and use the blue reliever inhaler (with a spacer if you have one), as your asthma plan says.",
      "If someone is choking: give up to 5 back blows, then up to 5 abdominal thrusts, and repeat.",
      "If it isn't getting better, or they can't speak, an adult should call an ambulance.",
    ],
  },
  {
    match: ["unconscious", "passed out", "fainted", "not responding", "unresponsive", "seizure", "having a fit", "convulsion"],
    title: "Loss of consciousness or a seizure is an emergency",
    steps: [
      "Shout for a teacher now and " + NURSE + " immediately.",
      "Check they are breathing. If not, call an ambulance, start CPR and send someone for the defibrillator (AED).",
      "During a seizure, don't hold them down or put anything in their mouth. Move hard objects away, cushion the head and time it.",
      "Once breathing normally, put them on their side (recovery position) and stay with them.",
    ],
  },
  {
    match: ["won't stop bleeding", "wont stop bleeding", "heavy bleeding", "bleeding a lot", "spurting", "lots of blood"],
    title: "Heavy bleeding: press hard and get help",
    steps: [
      "Press firmly on the wound with a clean dressing, and don't lift it to check.",
      "If blood soaks through, add another dressing on top and keep pressing.",
      "Tell a teacher now and " + NURSE + ".",
      "Wear gloves if you're helping someone else.",
    ],
  },
  {
    match: ["hit my head", "head injury", "banged my head", "concussion", "knocked out"],
    title: "Head injury: stop and get checked",
    steps: [
      "Stop playing or working and sit down. Don't go back to sport today.",
      "Hold a cold pack on any swelling for up to 20 minutes.",
      "Tell a teacher and " + NURSE + " now if there is vomiting, confusion, drowsiness, a bad headache, blurred vision or you were knocked out.",
      "Someone should keep an eye on you for the rest of the day, and your parents should be told.",
    ],
  },
  {
    match: ["face swelling", "throat swelling", "swollen throat", "tongue swelling", "anaphylaxis", "severe allergic", "swollen lips", "swollen tongue", "allergic reaction"],
    together: [["throat", "swell"], ["throat", "swollen"], ["tongue", "swell"], ["tongue", "swollen"], ["lips", "swell"], ["lips", "swollen"]],
    title: "A severe allergic reaction is an emergency",
    steps: [
      "Use their adrenaline auto-injector (EpiPen) into the outer thigh straight away if they have one.",
      "An adult should call an ambulance and say \"anaphylaxis\". Tell a teacher and " + NURSE + ".",
      "Lie them down with legs raised, or let them sit up if breathing is hard.",
      "If there's no improvement after 5 minutes, give the second auto-injector.",
    ],
  },
];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ")} `;
/** The same text with each word reduced to its stem, so "breathing" matches "breathe". */
const stemmed = (s: string) => ` ${s.trim().split(" ").map((w) => stem(w.replace(/'/g, ""))).join(" ")} `;

/** Does the message contain this keyword or phrase, in any common word form? */
function has(text: string, textStem: string, phrase: string): boolean {
  return text.includes(` ${phrase} `) || textStem.includes(stemmed(phrase));
}

/** An emergency in the message gets the fixed "get help now" steps; anything else is for the online assistant. */
export function answer(input: string): Reply {
  const text = norm(input);
  if (!text.trim()) return { kind: "unknown" };
  const textStem = stemmed(text);
  for (const flag of RED_FLAGS) {
    const hit =
      flag.match.find((m) => has(text, textStem, m)) ??
      flag.together?.find((words) => words.every((w) => has(text, textStem, w)))?.join(" + ");
    if (hit) return { kind: "urgent", title: flag.title, steps: flag.steps, matched: hit };
  }
  return { kind: "unknown" };
}

/* Offered when the assistant can't answer, so the conversation can carry on. */
export const FOLLOW_UPS = ["My head hurts", "My back hurts", "My ankle hurts", "I feel dizzy", "I fell in PE", "I feel sick"];

export const SUGGESTIONS = ["I cut my finger", "I have a headache", "I twisted my ankle", "I feel sick", "How much water should I drink?", "How heavy should my school bag be?"];
