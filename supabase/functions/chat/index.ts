// VITALS 2.0 chatbots: the "chat" Edge Function (Supabase project "Vitals 2.0").
//
// The website (src/lib/ai.ts) sends { bot, messages, checkup }. This function checks the caller is a
// signed-in VITALS 2.0 user, then asks Google Gemini with a school-health instruction for that bot.
// Each bot is kept to its own topic: anything else gets a one-line redirect to the right assistant.
// Emergencies never reach here: the website answers red flags itself with fixed steps.
//
// Models: every free Gemini text model this key can use (from Google's model list, refreshed hourly),
// in two groups. Simple questions go to the fast "lite" models (3 s each); complex questions (long,
// several questions, "why/explain/compare", or deep into a conversation) go to the bigger models
// (8 s each), falling back to the fast ones. Requests rotate inside each group to spread the free quota.
// A background check tests every model one at a time; models that need a paid plan, are retired or
// fail are skipped. None of this is shown to students.
//
// Secret: GEMINI_API_KEY or GEMINI-API-KEY (Supabase dashboard -> Edge Functions -> Secrets).
// Optional: GEMINI_MODEL (tried first). Deployed with verify_jwt off: the function checks the user itself.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const API = "https://generativelanguage.googleapis.com/v1beta";
const FAST_MS = 3000; // per model, simple questions
const SMART_MS = 8000; // per model, complex questions
const TOTAL_FAST_MS = 9000;
const TOTAL_SMART_MS = 18000;
const COOL_DOWN_MS = 5 * 60_000;
const LONG_COOL_DOWN_MS = 6 * 60 * 60_000; // retired, or needs a paid plan
// used if Google's model list can't be read
const FALLBACK = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const BASE = `You are VITALS, a friendly school health assistant inside the VITALS 2.0 student health website.
You talk to school students (about 10 to 18 years old), their teachers and the school nurse.
Rules:
- Use plain, simple English. Keep answers short: 2 to 5 sentences, or a short list of steps. Light Markdown only ("- " bullets, **bold**).
- Give general health information and first aid, never a diagnosis. You are not a doctor.
- Medicines: never give doses. Say medicines at school are only given by the school nurse or a trusted adult, with a parent's permission. Never suggest aspirin for anyone under 16.
- Say clearly when to tell a teacher, get the school nurse, see a doctor, or call the local emergency number.
- If someone seems to be in danger, very unwell, being hurt, or talks about harming themselves, tell them to speak to a trusted adult, teacher or the school nurse right now, and to call the local emergency number if they are in immediate danger.
- Don't ask for or repeat personal details (full name, address, phone, passwords).
- Stay strictly on your topic below. If the question is outside it, reply in one or two sentences that you only cover your topic, and point them to the right VITALS assistant: the main VITALS assistant on the home page (first aid and general school health), the Classroom guide, the Bones & sport coach, the Hydration guide, the School medicine assistant, or the Hygiene assistant. Do not answer the off-topic question.
- Never talk about space, astronauts or missions. Never mention which AI model you are.`;

const BOTS: Record<string, { name: string; topic: string }> = {
  "assistant-input": {
    name: "the main VITALS assistant",
    topic:
      "First aid and everyday school health: injuries at school and in PE (cuts, sprains, falls, bumps, burns, nosebleeds, head knocks), feeling unwell (headache, feeling sick, fever, dizziness, stomach ache), sleep, stress, and general questions about student health. You may also explain the student's own last VITALS checkup if it is given to you.",
  },
  "environment-input": {
    name: "the Classroom guide",
    topic: "The classroom environment and health: temperature and heat, fresh air and CO2, ventilation, humidity and mould, noise, lighting, eye strain and screens, asthma and allergy triggers in classrooms, and keeping rooms healthy.",
  },
  "bone-input": {
    name: "the Bones & sport coach",
    topic: "Bones, muscles, posture and sport for students: exercise and activity guidelines, building strong bones (calcium, vitamin D, sleep), school bag weight and posture, desk and phone posture, growth plates and growing pains, sprains, strains, broken bones, head knocks in sport, warming up and preventing sports injuries.",
  },
  "fluid-input": {
    name: "the Hydration guide",
    topic: "Hydration for students: how much to drink, signs of dehydration, urine colour, water and drinks at school, sport and hot days, heat exhaustion, energy drinks, fizzy drinks, juice and milk.",
  },
  "medicine-input": {
    name: "the School medicine assistant",
    topic: "Medicines and health care at school: school medicine rules and consent, storing medicines, individual health care plans, asthma and inhalers, severe allergies, anaphylaxis and adrenaline auto-injectors (EpiPens), diabetes and hypos, epilepsy and seizures, when to stay home sick, and first aid at school (CPR, defibrillators, choking, bleeding, burns, nosebleeds).",
  },
  "hygiene-input": {
    name: "the Hygiene assistant",
    topic: "Hygiene at school: handwashing, coughs and sneezes, how germs spread, cleaning desks and shared things, lunch and food safety, teeth and brushing, body odour and showering, PE kit, head lice, athlete's foot, school toilets, stomach bugs, and minor skin problems like rashes.",
  },
  "isolation-input": {
    name: "the Wellbeing guide",
    topic: "Student wellbeing: feeling lonely or left out, homesickness, friendships, stress and exam worries, mood, sleep, screen time and rest, and where to find support at school.",
  },
};

/** Is the caller a signed-in VITALS 2.0 user? Asks Supabase Auth about the token they sent. */
async function signedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || !SUPABASE_URL || !ANON) return false;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: ANON }, signal: AbortSignal.timeout(4000) }).catch(() => null);
  return !!r?.ok;
}

/* ---------------- the model pool ---------------- */

let pool: string[] = [];
let poolAt = 0;
const turn = { fast: 0, smart: 0 }; // round-robin positions
const coolUntil = new Map<string, number>(); // model -> time it may be tried again
const passed = new Set<string>(); // models that answered the last background check
let checked = false; // a background check has finished

/** Text chat models only: no image, audio, speech, transcription, embedding, live or tool-only ones. */
const isChatModel = (name: string) => /^gemini-/.test(name) && !/(image|audio|tts|speech|transcri|live|embed|vision|exp|computer|robotics|native|customtools)/i.test(name);
const isFast = (name: string) => /lite/.test(name);
/** Newer versions first; "latest" aliases just after the newest numbered one. */
function rank(name: string): number {
  const v = parseFloat(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? "0");
  return -(v + (/latest/.test(name) ? 0.5 : 0));
}

/** Skip a model for a while, longer when it's retired (404) or has no free quota (paid plan only). */
function coolDown(model: string, why = "") {
  const long = why.startsWith("404") || (why.startsWith("429") && /plan|billing/i.test(why));
  coolUntil.set(model, Date.now() + (long ? LONG_COOL_DOWN_MS : COOL_DOWN_MS));
}

async function models(key: string): Promise<string[]> {
  if (pool.length && Date.now() - poolAt < 60 * 60_000) return pool;
  try {
    const r = await fetch(`${API}/models?pageSize=1000`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const j = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      const names = (j.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .filter(isChatModel)
        .sort((a, b) => rank(a) - rank(b));
      if (names.length) {
        pool = names;
        poolAt = Date.now();
        checkAll(key, pool);
        return pool;
      }
    }
  } catch {
    /* fall through to the built-in list */
  }
  pool = FALLBACK;
  poolAt = Date.now() - 50 * 60_000; // try Google's list again in ~10 minutes
  return pool;
}

/**
 * Health check of the whole pool, in the background, whenever the list is (re)loaded: one model at a
 * time (so the check never uses up the free quota), each with its normal time limit. Results go to the
 * function logs only. Models that fail are cooled down; the ones that pass are preferred.
 */
function checkAll(key: string, names: string[]) {
  const run = (async () => {
    const ping = { contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }], generationConfig: { maxOutputTokens: 256 } };
    const lines: string[] = [];
    for (const m of names) {
      const t = Date.now();
      const r = await ask(m, key, ping, isFast(m) ? FAST_MS : SMART_MS);
      if (r.text) passed.add(m);
      else {
        passed.delete(m);
        coolDown(m, r.why);
      }
      lines.push(`${m} [${isFast(m) ? "fast" : "smart"}]: ${r.text ? "ok" : `FAIL (${r.why?.slice(0, 90)})`} ${Date.now() - t} ms`);
    }
    checked = true;
    console.log("model check:\n" + lines.join("\n"));
  })();
  // keep the check running after the student's answer has been sent
  (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(run);
}

/** Long, several questions, asks for an explanation or comparison, or deep into a conversation. */
function isComplex(question: string, turns: number): boolean {
  const words = question.trim().split(/\s+/).length;
  const questions = (question.match(/\?/g) ?? []).length;
  return words > 25 || questions > 1 || turns > 4 || /\b(why|explain|compare|difference|versus|vs|plan|pros and cons|what happens if|how does|how do .* work|step by step|in detail)\b/i.test(question);
}

/** The models to try, in order: this group's working models (rotated), then the other group as backup. */
function plan(all: string[], complex: boolean): { model: string; ms: number }[] {
  const usable = (m: string) => (coolUntil.get(m) ?? 0) <= Date.now() && (!checked || passed.has(m));
  const rotate = (list: string[], k: "fast" | "smart") => {
    if (!list.length) return list;
    const start = turn[k]++ % list.length;
    return [...list.slice(start), ...list.slice(0, start)];
  };
  let fast = rotate(all.filter((m) => isFast(m) && usable(m)), "fast");
  let smart = rotate(all.filter((m) => !isFast(m) && usable(m)), "smart");
  if (!fast.length && !smart.length) {
    // everything is cooling down: try the fast ones anyway rather than give up
    fast = all.filter(isFast);
    smart = [];
  }
  const f = fast.map((model) => ({ model, ms: FAST_MS }));
  const s = smart.map((model) => ({ model, ms: SMART_MS }));
  return complex ? [...s.slice(0, 2), ...f] : [...f, ...s.slice(0, 1)];
}

/** One try with one model: the answer text, or why it failed. */
async function ask(model: string, key: string, body: unknown, ms: number): Promise<{ text?: string; why?: string }> {
  try {
    const r = await fetch(`${API}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    });
    if (!r.ok) return { why: `${r.status} ${(await r.text()).slice(0, 160).replace(/\s+/g, " ")}` };
    const data = await r.json();
    // only the answer text (newer models can also return "thought" parts)
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    return text ? { text } : { why: `empty (${data?.candidates?.[0]?.finishReason ?? "no candidate"})` };
  } catch (e) {
    return { why: e instanceof DOMException && e.name === "TimeoutError" ? `timeout after ${ms} ms` : String(e).slice(0, 120) };
  }
}

type Turn = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!(await signedIn(req))) return json({ error: "Sign in to VITALS 2.0 to use the assistant." }, 401);

  // GEMINI_API_KEY is the usual name; GEMINI-API-KEY (dashes) is accepted too, as saved in the dashboard
  const key = (Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GEMINI-API-KEY"))?.trim();
  if (!key) {
    // names only (never values), so a misspelt secret can be spotted in the function logs
    const names = Object.keys(Deno.env.toObject()).filter((k) => !k.startsWith("SUPABASE_") && /KEY|GEMINI|API|SECRET/i.test(k));
    console.error("GEMINI_API_KEY missing. Secret names that look like keys:", names.join(", ") || "(none)");
    return json({ error: "The assistant isn't set up yet." }, 503);
  }

  let body: { bot?: string; messages?: Turn[]; checkup?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const bot = BOTS[body.bot ?? ""] ?? BOTS["assistant-input"];
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, 1500) }] }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "No question" }, 400);

  const checkup = typeof body.checkup === "string" && body.checkup && body.bot === "assistant-input" ? `\nThe student's last VITALS checkup: ${body.checkup.slice(0, 800)}` : "";
  const request = {
    systemInstruction: { parts: [{ text: `${BASE}\n\nYou are ${bot.name}. Your topic: ${bot.topic}${checkup}` }] },
    contents: messages,
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  };

  const started = Date.now();
  const question = messages[messages.length - 1].parts[0].text;
  const complex = isComplex(question, messages.length);
  const budget = complex ? TOTAL_SMART_MS : TOTAL_FAST_MS;
  const order = plan(await models(key), complex);
  const env = Deno.env.get("GEMINI_MODEL");
  if (env) order.unshift({ model: env, ms: complex ? SMART_MS : FAST_MS });

  for (const { model, ms } of order) {
    const left = budget - (Date.now() - started);
    if (left < 800) break;
    const res = await ask(model, key, request, Math.min(ms, left));
    if (res.text) return json({ reply: res.text });
    console.error("gemini", complex ? "complex" : "simple", model, res.why);
    coolDown(model, res.why);
  }
  return json({ error: "The assistant is busy right now. Try again in a moment." }, 503);
});
