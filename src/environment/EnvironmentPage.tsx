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
 * Environment (#/environment): how cabin temperature, CO2, radiation, humidity and pressure
 * affect the crew. Research by Vishnu (team Mission 61:4). Opened from the
 * "Environment monitor" card in the Modules tunnel.
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
    title: "Cabin temperature",
    lead: "When the temperature inside a spacecraft gets too hot or too cold, it puts astronauts and their missions in danger.",
    risksTitle: "Health and body risks",
    risks: [
      { name: "Brain fog", text: "High heat makes it hard for astronauts to think clearly, make fast decisions, or focus on their work." },
      { name: "Clumsiness", text: "Being too hot makes hands shaky and slows down reflexes, making it tough to use controls." },
      { name: "Overheating", text: "In space, the body cannot cool itself down easily through sweating. This can cause heat stroke or exhaustion." },
      { name: "Extreme environments", text: "Outside the ship, space shifts from freezing cold to boiling hot. If the cabin heater or cooler breaks, the inside can quickly become deadly." },
    ],
    fixesTitle: "How space agencies fix it",
    fixes: [
      { name: "Special cooling suits", text: "Astronauts wear clothing woven with water tubes to pump heat away from their bodies." },
      { name: "Strict emergency rules", text: "If a cabin gets too warm, astronauts must immediately change into lighter clothes or turn on backup cooling systems to stay safe." },
    ],
    sources: [],
  },
  {
    id: "co2",
    icon: "bubbles",
    title: "Carbon dioxide (CO2)",
    lead: "In a closed spacecraft, carbon dioxide from an astronaut's breath cannot escape. If it builds up, it causes dangerous health and thinking problems.",
    risksTitle: "Health and body risks",
    risks: [
      { name: "The \"space stupids\"", text: "Mildly elevated CO2 can cause brain fog, confusion, and slow down an astronaut's ability to complete basic or rehearsed tasks." },
      { name: "Headaches and lethargy", text: "Even at low levels, astronauts in space report severe headaches, tiredness and full-headedness much quicker than people do on Earth." },
      { name: "Invisible CO2 bubbles", text: "On Earth, warm breath rises and mixes into the air. In zero gravity, air does not move naturally. Without fans, an astronaut can wake up gasping for air because a stagnant bubble of their own exhaled CO2 has formed right around their head." },
      { name: "Increased head pressure", text: "Microgravity already pushes blood and fluids into an astronaut's head. High CO2 widens blood vessels in the brain, which can worsen vision problems and eye pressure." },
    ],
    fixesTitle: "How the air is kept safe",
    fixes: [
      { name: "Continuous scrubbing", text: "Machines like the Carbon Dioxide Removal Assembly (CDRA) continuously pull CO2 out of the cabin air to keep levels safe." },
      { name: "Constant fan circulation", text: "Spaceships use non-stop ventilation fans to blend the air and break up invisible, toxic CO2 pockets before they can form." },
    ],
    sources: [
      { label: "NASA: Carbon dioxide risk", href: "https://www.nasa.gov/directorates/esdmd/hhp/carbon-dioxide-risk/" },
      { label: "NASA OCHMO technical brief: Carbon dioxide", href: "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf" },
      { label: "NASA NTRS 20120016340", href: "https://ntrs.nasa.gov/api/citations/20120016340/downloads/20120016340.pdf" },
      { label: "NASA NTRS 20150019624", href: "https://ntrs.nasa.gov/api/citations/20150019624/downloads/20150019624.pdf" },
      { label: "NTIS N20120006045", href: "https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/N20120006045.xhtml" },
      { label: "AIAA 2013-3463", href: "https://arc.aiaa.org/doi/pdf/10.2514/6.2013-3463" },
      { label: "Let's Talk Science: Carbon dioxide and space missions", href: "https://letstalkscience.ca/educational-resources/backgrounders/carbon-dioxide-and-space-missions" },
    ],
  },
  {
    id: "radiation",
    icon: "radiation",
    title: "Space radiation",
    lead: "Outside Earth's protective magnetic field, astronauts face invisible, high-energy space radiation. It behaves like subatomic cannonballs, slicing through human cells and DNA, and it is one of the greatest threats to long-duration space travel.",
    risksTitle: "Health and body risks",
    risks: [
      { name: "Cancer risk", text: "The heavy ions and cosmic rays found in deep space can break both strands of the DNA helix, forcing incorrect cell repairs that can lead to aggressive or rare cancers later in life." },
      { name: "\"Space brain\"", text: "Severe radiation damages the central nervous system. It can kill brain cells and cause neurotoxicity, leading to cognitive decline, short-term memory gaps and reduced motor skills." },
      { name: "Heart disease", text: "Space radiation damages the delicate inner lining of blood vessels (endothelial dysfunction). This narrows the vessels and sharply increases the long-term risk of a heart attack or stroke." },
      { name: "Early cataracts", text: "Cosmic radiation passes easily through standard equipment. Even relatively low cumulative exposure can cloud the eyes' lenses, causing cataracts to form much earlier than normal." },
      { name: "Radiation sickness", text: "While long-term diseases are the main concern, a sudden solar storm (solar particle event) can bombard a spacecraft with a massive dose of radiation, causing nausea, vomiting and acute radiation sickness." },
    ],
    fixesTitle: "How space programs fight it",
    fixes: [
      { name: "Storm shelters", text: "Spacecraft are built with specially shielded sections where crew members can retreat during intense solar flares." },
      { name: "Biomedical defences", text: "NASA and other agencies are researching cell-repair medicines, such as anti-inflammatory drugs and antioxidants, to help the body fight radiation damage at a molecular level." },
    ],
    sources: [],
  },
  {
    id: "humidity-pressure",
    icon: "drop",
    title: "Humidity and pressure",
    lead: "Strict control over cabin humidity and pressure is vital to keep space crews healthy and onboard electronics working.",
    risksTitle: "Risks of the wrong humidity",
    risks: [
      { name: "Electrical short circuits", text: "If humidity on the International Space Station rises past 70%, moisture can condense onto electronic equipment, causing short circuits or electrical fires." },
      { name: "Mould and mould illness", text: "Warm, damp air promotes rapid microbial and mould growth in microgravity, which clogs vital water filters and makes the crew sick." },
      { name: "Dry eyes and static shock", text: "If the cabin air gets too dry, astronauts suffer from respiratory pain and dry skin, and static electricity spikes, risking sensitive circuit failures." },
    ],
    risksTitle2: "Risks of changing pressure",
    risks2: [
      { name: "Decompression sickness", text: "Going from the normal pressure of a spacecraft to a lower-pressure spacesuit can make dissolved nitrogen form bubbles in the blood and tissues (\"the bends\"), causing extreme joint pain, tissue damage or embolisms." },
      { name: "Hypoxia (oxygen starvation)", text: "A drop in pressure limits how much oxygen the lungs can take in. This quickly leads to confusion, severe headaches, tunnel vision or sudden unconsciousness." },
      { name: "Middle-ear problems", text: "Pressure changes, combined with breathing pure oxygen during spacewalk preparation, can trap fluid and cause painful pressure imbalances in the ears, leading to middle-ear effusions and temporary hearing problems." },
      { name: "Catastrophic ruptures", text: "A complete or rapid loss of cabin pressure forces air out of the lungs and makes gases in the blood bubble out. Unconsciousness happens within about 15 seconds." },
    ],
    fixesTitle: "How space programs fight it",
    fixes: [
      { name: "Condensate collectors", text: "Active environmental systems continually pull excess moisture out of the air and recycle it into clean drinking water." },
      { name: "Pre-breathe routines", text: "Before a spacewalk, astronauts spend hours breathing pure oxygen to purge nitrogen from their blood, which prevents the bends." },
    ],
    sources: [
      { label: "Let's Talk Science: Humidity and space missions", href: "https://letstalkscience.ca/educational-resources/backgrounders/humidity-and-space-missions" },
      { label: "NASA NTRS 20150003045", href: "https://ntrs.nasa.gov/api/citations/20150003045/downloads/20150003045.pdf" },
      { label: "NASA: Human spaceflight risks", href: "https://www.nasa.gov/humans-in-space/hhc-spaceflight-risks/" },
      { label: "NASA: Risk of hypoxia", href: "https://www.nasa.gov/reference/risk-of-hypoxia/" },
      { label: "JAMA Otolaryngology", href: "https://jamanetwork.com/journals/jamaotolaryngology/fullarticle/2763430" },
      { label: "ScienceDirect", href: "https://www.sciencedirect.com/science/article/abs/pii/S1364032126001632" },
      { label: "ResearchGate: Physiology in aviation", href: "https://www.researchgate.net/publication/401998353_Physiology_in_Aviation_Earth's_Atmosphere_Hypoxia_Pressure_Hazards_Cabin_Pressurization_and_Decompression" },
      { label: "Washington Post: What is hypoxia?", href: "https://www.washingtonpost.com/nation/2023/06/06/what-is-hypoxia-cabin-depressurization/" },
      { label: "Helen Cowan: 10 health hazards of outer space", href: "https://www.helencowan.co.uk/10-health-hazards-outer-space" },
      { label: "YouTube", href: "https://www.youtube.com/watch?v=p2fvJ7shQPA" },
      { label: "Reddit: ELI5 vacuum of space", href: "https://www.reddit.com/r/explainlikeimfive/comments/1tuhre9/eli5_what_is_vacuum_of_space_how_dangerous_is_it/" },
    ],
  },
];

/* A VITALS glyph for every risk and fix, so each card can be spotted at a glance. */
const ICON: Record<string, GlyphName> = {
  "Brain fog": "fog",
  Clumsiness: "shake",
  Overheating: "flame",
  "Extreme environments": "halfSun",
  "Special cooling suits": "snowflake",
  "Strict emergency rules": "clipboard",
  'The "space stupids"': "spiral",
  "Headaches and lethargy": "battery",
  "Invisible CO2 bubbles": "bubbles",
  "Increased head pressure": "head",
  "Continuous scrubbing": "filter",
  "Constant fan circulation": "fan",
  "Cancer risk": "dna",
  '"Space brain"': "brain",
  "Heart disease": "heartBroken",
  "Early cataracts": "eye",
  "Radiation sickness": "sunFlare",
  "Storm shelters": "shield",
  "Biomedical defences": "pill",
  "Electrical short circuits": "bolt",
  "Mould and mould illness": "mushroom",
  "Dry eyes and static shock": "dry",
  "Decompression sickness": "bubbles",
  "Hypoxia (oxygen starvation)": "lungs",
  "Middle-ear problems": "ear",
  "Catastrophic ruptures": "burst",
  "Condensate collectors": "drop",
  "Pre-breathe routines": "o2",
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
      eyebrow="Environment monitor"
      title="The cabin keeps you alive."
      intro="A small bubble of air in a place that wants to freeze, cook and irradiate you. Here's how it keeps the crew alive."
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
        Research by team Mission 61:4. Sources open on the
        internet; the rest of this page works offline. General information, not medical advice.
      </p>
    </Shell>
  );
}
