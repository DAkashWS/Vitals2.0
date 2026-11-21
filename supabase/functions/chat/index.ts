// VITALS 2.0 chatbots: the "chat" Edge Function (Supabase project "Vitals 2.0").
//
// The website (src/lib/ai.ts) sends { bot, messages, checkup }. This function checks the caller is a
// signed-in VITALS 2.0 user, then asks Google Gemini with a school-health instruction for that bot.
// Each bot is kept to its own topic: anything else gets a one-line redirect to the right assistant.
// Emergencies never reach here: the website answers red flags itself with fixed steps.
//
// Secret: GEMINI_API_KEY (Supabase dashboard -> Edge Functions -> Secrets). Optional: GEMINI_MODEL.
// Deployed with verify_jwt off because the function checks the user itself (below).

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

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
- Never talk about space, astronauts or missions.`;

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
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: ANON } });
  return r.ok;
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
    return json({ error: "The assistant isn't set up yet (missing GEMINI_API_KEY)." }, 503);
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
  const system = `${BASE}\n\nYou are ${bot.name}. Your topic: ${bot.topic}${checkup}`;

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages,
      generationConfig: { temperature: 0.4, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!r.ok) {
    console.error("gemini", r.status, (await r.text()).slice(0, 300));
    return json({ error: "The assistant is busy. Try again in a moment." }, 502);
  }
  const data = await r.json();
  const reply = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();
  if (!reply) return json({ error: "No answer" }, 502);
  return json({ reply });
});
