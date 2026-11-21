import { useEffect, type ReactNode } from "react";
import { Shell } from "@/live/LivePage";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { ChatPanel, type ChatScope } from "@/sections/Assistant";

/** The cabin guide: answers from the environment, cabin air, emergency and radiation files in /knowledge. */
const ENV_SCOPE: ChatScope = {
  name: "Cabin guide",
  inputId: "environment-input",
  placeholder: "Ask about the air, water, noise, radiation…",
  tone: "emerald",
  avatar: "fan",
  hello: (
    <>
      Hi, I'm the cabin guide. Ask me how the station makes oxygen, where the CO2 goes, what space smells like, why you see
      flashes of light at night, or what happens if the station springs a leak.
    </>
  ),
  greet: "Hi! I'm the cabin guide. Ask me anything about the air, water, light, noise and radiation around you.",
  suggestions: [
    "How is oxygen made on the space station?",
    "What does space smell like?",
    "Why do astronauts see flashes of light with their eyes closed?",
    "How much of the water on the ISS is recycled?",
    "What happens if the station springs a leak?",
    "What is the South Atlantic Anomaly?",
  ],
  followUps: [
    "Why do astronauts sleep next to a fan?",
    "What are oxygen candles?",
    "Do germs and fungus grow on the space station?",
    "Why do the lights on the space station change colour?",
    "What is space debris and is it dangerous?",
    "What is the air like on Mars?",
  ],
  unknownText:
    "I only cover the station environment, and I don't have that in the library yet. Try one of these. If an alarm is going off, follow the emergency procedure and the commander first.",
  library: (p) =>
    p.id.startsWith("environment-deep#") || p.id.startsWith("cabin-air-water-food#") || p.id.startsWith("emergencies-on-board#") || p.id.startsWith("radiation#"),
  topics: [],
};

/*
 * Classroom environment (#/environment): how classroom temperature, fresh air, noise, light and
 * humidity affect students' health and learning. Opened from the "Classroom environment" card.
 */

type Src = { label: string; href: string };
type Topic = {
  id: string;
  icon: GlyphName;
  title: string;
  lead: string;
  risksTitle: string;
  risks: { name: string; text: string }[];
  risksTitle2?: string;
  risks2?: { name: string; text: string }[];
  fixesTitle: string;
  fixes: { name: string; text: ReactNode }[];
  sources: Src[];
};

const TOPICS: Topic[] = [
  {
    id: "temperature",
    icon: "thermometer",
    title: "Classroom temperature",
    lead: "A classroom that is too hot or too cold makes it harder for students to learn, and on hot days it can make them ill.",
    risksTitle: "Health and learning risks",
    risks: [
      { name: "Brain fog", text: "In a stuffy, overheated room, students find it harder to concentrate, remember what they read and finish tasks." },
      { name: "Heat exhaustion", text: "Headache, dizziness, heavy sweating, nausea and feeling faint after PE or a long hot lesson. It can turn into heatstroke if it isn't treated." },
      { name: "Dehydration", text: "Warm rooms and sport make students lose water faster, and many don't drink until they already feel thirsty." },
      { name: "Too cold to focus", text: "A cold room makes students restless and uncomfortable, and is hard for anyone who is already unwell." },
    ],
    fixesTitle: "What schools can do",
    fixes: [
      { name: "Cool, airy rooms", text: "Open windows early in the day, close blinds against direct sun, and use fans. Most classrooms are comfortable at roughly 18 to 25 °C." },
      { name: "Hot-day rules", text: "Water bottles on every desk, shade at break time, lighter uniform allowed, and PE moved indoors or to a cooler time." },
    ],
    sources: [],
  },
  {
    id: "co2",
    icon: "bubbles",
    title: "Fresh air (CO2)",
    lead: "Thirty students breathing in a closed room raise the carbon dioxide level quickly. CO2 itself is a sign of how stale the air is, and of how easily colds and flu can spread.",
    risksTitle: "Health and learning risks",
    risks: [
      { name: "Sleepy afternoons", text: "High CO2 is linked to tiredness, slower thinking and lower test scores, especially late in the day." },
      { name: "Headaches", text: "Stale, crowded air is a common cause of headaches and \"heavy head\" feelings in class." },
      { name: "Germs in the air", text: "Poor ventilation lets coughs and sneezes linger, so colds, flu and other infections pass round the class more easily." },
      { name: "Asthma triggers", text: "Dust, chalk, strong cleaning sprays and stuffy air can all set off asthma in students who have it." },
    ],
    fixesTitle: "How to keep the air fresh",
    fixes: [
      { name: "Measure it", text: "A CO2 monitor shows when to open a window. Below about 800 ppm is good; above 1,500 ppm the room needs airing right away." },
      { name: "Air the room", text: "Open windows and doors between lessons, even for a few minutes in winter, and don't block air vents." },
    ],
    sources: [],
  },
  {
    id: "noise-light",
    icon: "eye",
    title: "Noise, light and screens",
    lead: "Students spend hours a day looking at boards, books and screens in a busy room. Bad light and constant noise wear them out.",
    risksTitle: "Health and learning risks",
    risks: [
      { name: "Eye strain", text: "Long screen time, glare and dim light cause tired, sore or dry eyes, blurred vision and headaches." },
      { name: "Undetected short sight", text: "A student squinting at the board may need glasses. Short sight is very common in school-age children and often goes unnoticed." },
      { name: "Noise fatigue", text: "Loud, echoing rooms make it hard to hear the teacher, raise stress and tire students out, especially those with hearing problems." },
      { name: "Poor posture at screens", text: "Laptops on low desks pull the head forward, leading to neck and shoulder aches." },
    ],
    fixesTitle: "What helps",
    fixes: [
      { name: "The 20-20-20 rule", text: "Every 20 minutes of screen work, look at something about 20 feet (6 m) away for 20 seconds." },
      { name: "Regular eye checks", text: "Tell parents when a student struggles to read the board, and encourage a yearly eye test." },
    ],
    sources: [],
  },
  {
    id: "humidity-hygiene",
    icon: "drop",
    title: "Humidity and clean rooms",
    lead: "Air that is too damp or too dry, and surfaces that are rarely cleaned, both make students ill more often.",
    risksTitle: "Risks of the wrong humidity",
    risks: [
      { name: "Mould", text: "Damp classrooms grow mould, which can trigger asthma, allergies, coughing and wheezing." },
      { name: "Dry air", text: "Very dry air (often from heating in winter) gives students dry eyes, sore throats, nosebleeds and itchy skin." },
      { name: "Faster spread of flu", text: "Flu viruses survive longer in very dry air, so winter outbreaks spread more easily." },
    ],
    risksTitle2: "Risks in shared spaces",
    risks2: [
      { name: "Shared surfaces", text: "Desks, door handles, keyboards and taps are touched by dozens of hands a day and carry germs from one student to the next." },
      { name: "Food in class", text: "Eating at desks spreads crumbs and germs and is dangerous for students with food allergies." },
      { name: "Allergens", text: "Dust, pollen through open windows, class pets and some art materials can set off allergies." },
    ],
    fixesTitle: "What schools can do",
    fixes: [
      { name: "Keep humidity at 40 to 60 %", text: "Fix leaks fast, air damp rooms, and in dry winters avoid overheating the room." },
      { name: "Daily cleaning", text: "Wipe desks, handles and shared devices every day, and more often during flu season." },
    ],
    sources: [],
  },
];

/* A VITALS glyph for every risk and fix, so each card can be spotted at a glance. */
const ICON: Record<string, GlyphName> = {
  "Brain fog": "fog",
  "Heat exhaustion": "flame",
  Dehydration: "drop",
  "Too cold to focus": "snowflake",
  "Cool, airy rooms": "fan",
  "Hot-day rules": "clipboard",
  "Sleepy afternoons": "battery",
  Headaches: "head",
  "Germs in the air": "bubbles",
  "Asthma triggers": "lungs",
  "Measure it": "gauge",
  "Air the room": "fan",
  "Eye strain": "eye",
  "Undetected short sight": "eye",
  "Noise fatigue": "ear",
  "Poor posture at screens": "shake",
  "The 20-20-20 rule": "hourglass",
  "Regular eye checks": "check",
  Mould: "mushroom",
  "Dry air": "dry",
  "Faster spread of flu": "bubbles",
  "Shared surfaces": "tap",
  "Food in class": "cup",
  Allergens: "warning",
  "Keep humidity at 40 to 60 %": "drop",
  "Daily cleaning": "soap",
};

function RiskGrid({ title, items }: { title: string; items: { name: string; text: string }[] }) {
  return (
    <div>
      <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-act/90">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((r) => (
          <div key={r.name} className="flex gap-4 rounded-2xl border border-white/10 bg-[#ffffff]/95 p-5">
            <GlyphTile name={ICON[r.name] ?? "warning"} tone="red" />
            <div>
              <p className="text-base font-semibold text-white">{r.name}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-white/65">{r.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EnvironmentPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Shell
      eyebrow="Classroom environment"
      title="The room shapes the student."
      intro="Heat, stale air, noise and glare make students tired, ill and unable to focus. Here's what to watch in every classroom."
      back={{ label: "Back to VITALS" }}
    >
      <nav aria-label="Topics" className="-mt-4 mb-16 flex flex-wrap gap-2">
        {TOPICS.map((t) => (
          <a
            key={t.id}
            href={`#/environment`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(`env-${t.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:border-primary/60 hover:text-white"
          >
            <Glyph name={t.icon} className="h-4 w-4 text-sky-300" /> {t.title}
          </a>
        ))}
        <a
          href="#/environment"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("env-ask")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/[0.06] px-4 py-2 text-sm text-white/85 hover:border-emerald-300/60 hover:text-white"
        >
          <Glyph name="chat" className="h-4 w-4 text-emerald-300" /> Ask the cabin guide
        </a>
      </nav>

      <div className="space-y-24">
        {TOPICS.map((t) => (
          <section key={t.id} id={`env-${t.id}`} className="scroll-mt-8">
            <div className="mb-8 max-w-3xl">
              <h2 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                <GlyphTile name={t.icon} size="lg" /> {t.title}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-white/70">{t.lead}</p>
            </div>
            <div className="space-y-8">
              <RiskGrid title={t.risksTitle} items={t.risks} />
              {t.risks2 && t.risksTitle2 && <RiskGrid title={t.risksTitle2} items={t.risks2} />}
              <div>
                <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-ok/90">{t.fixesTitle}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {t.fixes.map((f) => (
                    <div key={f.name} className="flex gap-4 rounded-2xl border border-ok/25 bg-ok/[0.05] p-5">
                      <GlyphTile name={ICON[f.name] ?? "check"} tone="green" />
                      <div>
                        <p className="text-base font-semibold text-white">{f.name}</p>
                        <p className="mt-1 text-[15px] leading-relaxed text-white/70">{f.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {t.sources.length > 0 && (
                <details className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-3 text-sm text-white/60">
                  <summary className="cursor-pointer select-none text-white/70">Sources ({t.sources.length})</summary>
                  <ul className="mt-3 space-y-1.5 pb-1">
                    {t.sources.map((s) => (
                      <li key={s.href}>
                        <a href={s.href} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </section>
        ))}

        {/* ---------- chatbot ---------- */}
        <section id="env-ask" className="grid scroll-mt-8 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-emerald-300/90">Cabin guide</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Questions about the air you breathe?</h2>
            <p className="mt-4 max-w-[44ch] leading-relaxed text-white/65">
              Oxygen from water, CO2 vented to space, recycled coffee, flashes of light at night and dodging debris. Ask anything,
              offline.
            </p>
          </div>
          <ChatPanel scope={ENV_SCOPE} />
        </section>
      </div>

      <p className="mt-24 border-t border-white/10 pt-6 text-sm text-white/50">
        School health guidance by team VITALS. This page works
        offline. General information, not medical advice.
      </p>
    </Shell>
  );
}
