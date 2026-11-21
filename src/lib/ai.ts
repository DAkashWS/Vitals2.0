/*
 * The onboard AI: a small local model (Ollama "vitals", built from gemma3:270m by bots/Modelfile)
 * that rewrites library answers into a direct reply to the crew member's question.
 *
 * How it stays safe:
 *   - It's only asked when the library has found passages; those passages go in with the question,
 *     so the model works from the team's facts (retrieval), not from memory.
 *   - Emergencies, first-aid steps and follow-up questions never go to the model.
 *   - Every reply is checked before it's shown: no medicine or doses, no numbers that aren't in the
 *     passages or the question, no talk about itself, sensible length. A reply that fails, a slow
 *     reply, or no Ollama at all means the chatbot shows the library answer instead.
 * The website reaches Ollama through the dev server's /ollama proxy (vite.config.ts).
 */

import type { Hit } from "@/lib/knowledge";

/*
 * Online answers: a real conversational model (Gemma 4 on Cloudflare Workers AI, free plan) behind our own
 * endpoint functions/api/chat.ts, so no API key is ever in the site. Used whenever it's reachable; offline,
 * or when the free daily allowance is used up, the chatbots fall back to the library and the onboard AI.
 */
// askvitals.pages.dev and its preview builds serve the endpoint themselves; every other site calls it there
const CLOUD = /(^|\.)askvitals\.pages\.dev$/.test(location.hostname) ? "/api/chat" : "https://askvitals.pages.dev/api/chat";
let cloudCheck: Promise<boolean> | null = null;

/** Whether online answers are available right now (a miss is re-checked after 30 s). */
export function cloudAvailable(): Promise<boolean> {
  if (!navigator.onLine) return Promise.resolve(false);
  cloudCheck ??= fetch(CLOUD, { signal: AbortSignal.timeout(6000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { ok?: boolean } | null) => !!j?.ok)
    .catch(() => false)
    .then((ok) => {
      if (!ok) setTimeout(() => (cloudCheck = null), 30000);
      return ok;
    });
  return cloudCheck;
}

export type Turn = { role: "user" | "assistant"; content: string };

/** One chatbot reply from the online model, given the conversation so far, or null to fall back offline. */
export async function askCloud(bot: string, conversation: Turn[], hits: Hit[], checkup: string): Promise<string | null> {
  try {
    const r = await fetch(CLOUD, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bot,
        messages: conversation,
        passages: hits.map((h) => ({ heading: h.heading, text: h.text, source: `${h.title} · ${h.source}` })),
        checkup,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) {
      cloudCheck = Promise.resolve(false); // e.g. allowance used up: stay offline-mode for a while
      setTimeout(() => (cloudCheck = null), 60000);
      return null;
    }
    const j = (await r.json()) as { reply?: string };
    return j.reply?.trim() || null;
  } catch {
    return null;
  }
}

/*
 * Where Ollama is: the dev/preview server's /ollama link (any device on the Wi-Fi), or, on the published
 * site opened from its offline copy, Ollama on this computer directly. That second way only works when
 * Ollama allows the site (OLLAMA_ORIGINS, see README.md); otherwise the chatbots answer from the library.
 */
const BASES = ["/ollama", "http://127.0.0.1:11434"];
let BASE = BASES[0];
const PREFERRED = ["vitals:latest", "vitals", "gemma3:270m"];
const TIMEOUT_MS = 25000;

let model: string | null = null;
let checking: Promise<string | null> | null = null;
let checkedAt = 0;

/**
 * Finds a usable model. Resolves to null when there's no onboard AI. A found model is remembered;
 * a miss is retried after 30 s, so starting Ollama later (or a slow first check) still turns it on.
 */
export function aiModel(): Promise<string | null> {
  if (model) return Promise.resolve(model);
  if (checking) return checking;
  if (checkedAt && Date.now() - checkedAt < 30000) return Promise.resolve(null);
  checking = (async () => {
    for (const base of BASES) {
      try {
        const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(8000) });
        // a static host answers /ollama with its own page, not JSON: try the next way
        const j = r.ok ? ((await r.json()) as { models?: { name: string }[] }) : null;
        const names = j?.models?.map((m) => m.name) ?? [];
        model = PREFERRED.find((p) => names.includes(p)) ?? null;
        if (model) {
          BASE = base;
          return model;
        }
      } catch {
        /* not reachable this way */
      }
    }
    return null;
  })().finally(() => {
      checkedAt = Date.now();
      checking = null;
    });
  return checking;
}

const MEDICINE =
  /\b(medicine|medication|meds|painkiller|tablet|pill|capsule|dose|dosage|mg|ibuprofen|paracetamol|acetaminophen|aspirin|antihistamine|antibiotic|prescri\w*|inject\w*)s?\b/i;
const META = /^(okay|ok|sure|understood|got it)\b|\bI understand\b|\bI will (focus|provide|follow|help)\b|\bas an ai\b|\blanguage model\b|\bmy instructions\b|\blibrary passages?\b/i;
const NUM = /\d+(?:[.,]\d+)?/g;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Cuts a reply to about `n` words, ending on a full sentence where possible. */
function cap(text: string, n: number): string {
  const w = text.split(/\s+/);
  if (w.length <= n) return text;
  const cut = w.slice(0, n).join(" ");
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > cut.length / 2 ? cut.slice(0, end + 1) : cut.replace(/[,;:]$/, "") + ".";
}

const STOP = new Set(
  "the and that this with from your you are for was were have has had will would could should can into onto than then them they their there these those which while when what where who whom whose about also just very more most some such only over under after before because being been does doing done each other like much many make makes made it's our out not but yes".split(" "),
);
/** Content words, cut to 5 letters so "astronaut" and "astronauts" match. */
const stems = (t: string) => (t.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.slice(0, 5));

/**
 * Share of the reply's content words that come from the passage or the question. Tuned on real
 * replies: correct ones scored 0.76 or more; ones that drifted or contradicted the passage scored
 * 0.74 or less.
 */
export function grounding(reply: string, source: string): number {
  const src = new Set(stems(source));
  const w = stems(reply);
  return w.length ? w.filter((x) => src.has(x)).length / w.length : 0;
}
const MIN_GROUNDING = 0.75;

/** Checks a model reply against the passages. Returns the cleaned reply, or null to fall back. */
export function checkReply(reply: string, question: string, hits: Hit[]): string | null {
  const r = reply.replace(/[*_#`>]+/g, "").replace(/\s+/g, " ").trim();
  if (words(r) < 8) return null;
  if (MEDICINE.test(r) || META.test(r)) return null;
  const top = `${hits[0].heading} ${hits[0].text}`;
  const source = hits.map((h) => `${h.heading} ${h.text}`).join(" ") + " " + question;
  // every number must come from the passages or the question
  const allowed = new Set(source.match(NUM)?.map((n) => n.replace(",", ".")) ?? []);
  for (const n of r.match(NUM) ?? []) if (!allowed.has(n.replace(",", "."))) return null;
  // "how fast / how much / how long…": the answer has to give the passage's number
  const topNums = top.match(NUM) ?? [];
  if (/\bhow (fast|much|many|long|big|far|often|quickly|hot|cold|high|low)\b/i.test(question) && topNums.length && !topNums.some((n) => r.includes(n))) return null;
  // it must stay close to the passage's own words (catches drift and contradictions)
  if (grounding(r, top + " " + question) < MIN_GROUNDING) return null;
  return cap(r, 90);
}

/** Asks the onboard AI. Resolves to a checked reply, or null (then the chatbot shows the library answer). */
export async function askAI(question: string, hits: Hit[], botName: string, history: { q: string; a: string }[] = []): Promise<string | null> {
  const m = await aiModel();
  if (!m || !hits.length) return null;
  // Same short shape as the worked examples in bots/Modelfile: the best passage, then the question.
  // (Tested: a 270M model answers this shape well and gets confused by long instructions.)
  const h = hits[0];
  const messages = [
    ...(m.startsWith("vitals")
      ? []
      : [{ role: "system", content: `You are VITALS, the ${botName}, a kind health assistant for astronauts. Answer the question in 2 or 3 short sentences using only the facts, keeping their meaning exactly. Never suggest medicine.` }]),
    // the last exchange, so a follow-up question makes sense
    ...history.slice(-1).flatMap((x) => [
      { role: "user", content: x.q },
      { role: "assistant", content: x.a },
    ]),
    { role: "user", content: `Facts: ${h.heading} ${h.text}\nQuestion: ${question}` },
  ];
  // A 270M model's answers vary a lot from one try to the next, so a rejected answer gets one
  // more try (about a second on a GPU) before falling back to the library answer.
  for (const temperature of [0.2, 0.5]) {
    try {
      const r = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: m, messages, stream: false, keep_alive: "30m", options: { num_ctx: 2048, num_predict: 160, temperature } }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!r.ok) return null;
      const j = (await r.json()) as { message?: { content?: string } };
      const ok = checkReply(j.message?.content ?? "", question, hits);
      if (ok) return ok;
    } catch {
      return null;
    }
  }
  return null;
}
