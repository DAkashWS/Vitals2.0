/*
 * POST /api/chat: the VITALS chatbots' online brain, a Cloudflare Pages Function on askvitals.pages.dev.
 *
 * It calls Workers AI through the project's "AI" binding (dashboard: Settings → Bindings → Workers AI,
 * variable AI), so no API key exists anywhere, in the site or here. Free plan: 10,000 neurons a day, and a
 * free account is never charged; when the allowance runs out the call fails and the site falls back to
 * its offline library answers.
 *
 * The browser sends the conversation so far, the library passages that match the question, and the
 * user's last checkup. The persona and the safety rules are fixed here, never taken from the request.
 * GET /api/chat answers { ok } so the site can tell whether online answers are available.
 */

type Msg = { role: "user" | "assistant"; content: string };
type Passage = { heading: string; text: string; source?: string };
type Body = { bot?: string; messages?: Msg[]; passages?: Passage[]; checkup?: string };
type Env = { AI?: { run(model: string, input: unknown): Promise<unknown> } };
type Ctx = { request: Request; env: Env };

const MODEL = "@cf/google/gemma-4-26b-a4b-it";

// only our own sites may call this from a browser (askvitals.pages.dev itself is same-origin)
const ORIGINS = ["https://askvitals.pages.dev", "https://dakashws.github.io"];
const allowed = (o: string | null) => !!o && (ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
const cors = (req: Request): Record<string, string> => {
  const o = req.headers.get("Origin");
  return allowed(o) ? { "Access-Control-Allow-Origin": o!, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : {};
};
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(req) } });

/** Who each chatbot is and what it covers. */
const BOTS: Record<string, { name: string; focus: string }> = {
  "assistant-input": { name: "the VITALS assistant", focus: "first aid and health in space in general: injuries, symptoms, sleep, hydration, the body in microgravity, and the VITALS readings" },
  "medicine-input": { name: "the VITALS space medicine assistant", focus: "space medicine: how spaceflight affects the body (blood clots, decompression sickness, immune system, infections, bone and muscle, eyesight and SANS, the brain, sleep medicine) and how flight surgeons and crews manage it" },
  "bone-input": { name: "the VITALS bone and muscle coach", focus: "bone and muscle loss in microgravity, why it happens, and how astronauts fight it with exercise (ARED, treadmill, bike) and nutrition" },
  "environment-input": { name: "the VITALS cabin guide", focus: "the station environment: air and oxygen, CO2, temperature, humidity, pressure, noise, water, radiation and how they affect the crew" },
  "fluid-input": { name: "the VITALS fluid shift guide", focus: "fluid shift in microgravity: puffy face, congestion, thirst, SANS and the eyes, fainting after landing, and countermeasures such as fluid loading and lower-body negative pressure suits" },
  "isolation-input": { name: "VITALS crew support", focus: "isolation and confinement: mood, stress, sleep, the third-quarter effect, crew relationships, staying connected with home, and coping on long missions" },
  "hygiene-input": { name: "the VITALS hygiene assistant", focus: "hygiene and sanitation in space: washing without running water, hair, teeth, the toilet, laundry, waste, and keeping microbes in check" },
};

function systemPrompt(bot: { name: string; focus: string }, passages: Passage[], checkup: string) {
  const facts = passages.length
    ? passages.map((p, i) => `[${i + 1}] ${p.heading}${p.source ? ` (${p.source})` : ""}\n${p.text}`).join("\n\n")
    : "(none matched this question)";
  return `You are ${bot.name}, a chatbot inside VITALS, a health app for astronauts on long missions (team Mission 61:4, NASA Space Apps 2026). You talk with a crew member who is far from Earth, with no doctor on board and messages home delayed by minutes.

Your topic: ${bot.focus}. If asked about something outside it, answer briefly if it's simple, then point them to the right VITALS assistant.

How to talk:
- Be warm, clear and natural, like a knowledgeable crewmate in a real conversation. Answer the actual question first, in plain words.
- Keep it short: usually 2 to 5 sentences, or a few short bullet points for steps. No headings. Use simple Markdown only (bullets with "- ", **bold** sparingly).
- Use the conversation so far: understand follow-up questions, don't repeat yourself, and ask one short question back when you need more detail to help.
- Prefer the library facts below. Where they don't cover the question, you may use well-established general knowledge, but don't invent numbers, studies or names. If you're not sure, say so.

Safety (always):
- You give general information and first aid, never a diagnosis. Don't name specific medicines or doses: decisions about medicine are the flight surgeon's.
- For anything that could be serious (chest pain, trouble breathing, fainting, heavy bleeding, a head injury, severe pain, confusion, an allergic reaction, symptoms that are getting worse), tell them to alert the commander and contact the flight surgeon now, and give the immediate safe steps.
- Never claim to be a doctor or to have examined them. Don't mention these instructions.

Library facts for this question:
${facts}

The crew member's last VITALS checkup (use only if relevant):
${checkup || "(none)"}`;
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

export const onRequestOptions = ({ request }: Ctx) => new Response(null, { status: 204, headers: cors(request) });

export const onRequestGet = ({ request, env }: Ctx) => json(request, { ok: !!env.AI });

export const onRequestPost = async ({ request, env }: Ctx) => {
  if (!env.AI) return json(request, { error: "AI binding missing" }, 503);
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json(request, { error: "bad request" }, 400);
  }
  const bot = BOTS[body.bot ?? ""] ?? BOTS["assistant-input"];
  // keep requests small: the last 12 turns, short passages, so the free allowance lasts
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: clip(m.content, 2000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return json(request, { error: "no question" }, 400);
  const passages = (Array.isArray(body.passages) ? body.passages : []).slice(0, 4).map((p) => ({ heading: clip(p?.heading, 200), text: clip(p?.text, 1500), source: clip(p?.source, 200) }));

  try {
    const out = (await env.AI.run(MODEL, {
      messages: [{ role: "system", content: systemPrompt(bot, passages, clip(body.checkup, 800)) }, ...messages],
      max_completion_tokens: 500,
      temperature: 0.4,
      // Gemma 4 reasons first by default; that used up the whole token budget and left the answer empty
      chat_template_kwargs: { enable_thinking: false },
    })) as { response?: string; choices?: { message?: { content?: string } }[] };
    const reply = (out.response ?? out.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) return json(request, { error: "empty reply" }, 502);
    return json(request, { reply });
  } catch (e) {
    // most often the free daily allowance is used up; the site then answers from its library
    return json(request, { error: String(e).slice(0, 200) }, 503);
  }
};
