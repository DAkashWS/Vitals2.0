import { useEffect, type ReactNode } from "react";
import { Shell } from "@/live/LivePage";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { ChatPanel, type ChatScope } from "@/sections/Assistant";

/*
 * Isolation (#/isolation): the gist of the team's research on isolation in spaceflight,
 * medical isolation rooms and other meanings of the word. Opened from the "Isolation" card
 * in the Modules tunnel. The chatbot answers from knowledge/isolation.md.
 */

const STATS: { icon: GlyphName; big: string; small: string }[] = [
  { icon: "people", big: "3–7", small: "classmates for months: the only people you'll see" },
  { icon: "sunrise", big: "16", small: "sunrises and sunsets a day on the ISS" },
  { icon: "delay", big: "~20 min", small: "for a message to reach Earth from Mars, each way" },
  { icon: "paleDot", big: "1 pale dot", small: "is all that's left of Earth on the way to Mars" },
];

const EFFECTS: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "calendar", title: "Boredom", text: "Every day follows the same rigid schedule." },
  { icon: "spiral", title: "Irritability", text: "Small frictions with classmates grow." },
  { icon: "chartDown", title: "Third-quarter dip", text: "Mood and morale sag around the ¾ mark." },
  { icon: "lowMood", title: "Loneliness", text: "Homesick, far from family and friends." },
  { icon: "sunrise", title: "Broken sleep", text: "Sixteen sunrises a day confuse the body clock." },
  { icon: "battery", title: "Low motivation", text: "Low mood can creep in on long missions." },
];

const COMPARE: [string, string, string][] = [
  ["Talking to Earth", "Almost real time", "Up to ~20 minutes each way"],
  ["Seeing Earth", "Right outside the window", "A shrinking pale dot"],
  ["Getting home", "Possible in hours", "No quick rescue or return"],
];

const COPING: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "people", title: "Careful student selection", text: "Screened for calm, teamwork and stress tolerance, and trained living together." },
  { icon: "envelope", title: "Contact with home", text: "Video calls, emails, phone calls, care packages and surprise messages." },
  { icon: "calendar", title: "A steady routine", text: "Planned work, about two hours of exercise, meals and rest." },
  { icon: "cupola", title: "Hobbies and the view", text: "Music, books, photos, films, and Earth-gazing from the Cupola." },
  { icon: "headset", title: "Someone to talk to", text: "Private calls with flight surgeons and psychologists." },
  { icon: "cake", title: "Student bonding", text: "Shared meals and celebrations make the group a team." },
];

const ANALOGS: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "dome", title: "HI-SEAS", text: "Hawaii: crews sealed in a habitat for months, with message delays added." },
  { icon: "capsule", title: "Mars-500", text: "Russia: a full simulated Mars mission in sealed modules." },
  { icon: "iceberg", title: "Antarctica", text: "Winter-over crews completely cut off for months." },
  { icon: "mars", title: "NASA CHAPEA", text: "Houston: year-long simulated stays on Mars." },
];

const CLASSES: { code: string; icon: GlyphName; name: string; text: string }[] = [
  { code: "N", icon: "airflow", name: "Negative pressure", text: "Air flows in, so airborne germs can't escape." },
  { code: "P", icon: "shield", name: "Positive pressure", text: "Air flows out, protecting patients with weak immunity." },
  { code: "S", icon: "room", name: "Standard", text: "Contact isolation for germs spread by touch." },
  { code: "Q", icon: "lockDoor", name: "Quarantine", text: "Keeps people who may be infected apart until it's safe." },
];

const MEANINGS: { icon: GlyphName; field: string; text: string }[] = [
  { icon: "germ", field: "Public health", text: "Separating contagious patients, like COVID-19 or flu" },
  { icon: "flask", field: "Microbiology & chemistry", text: "Separating a pure strain, cell or substance" },
  { icon: "dna", field: "Evolution", text: "Barriers that block gene flow and create new species" },
  { icon: "globe", field: "Politics", text: "Isolationism: staying out of foreign alliances" },
  { icon: "gear", field: "Engineering", text: "Keeping parts or signals apart, like shock absorbers" },
];

function SectionTitle({ id, icon, eyebrow, title, lead }: { id: string; icon: GlyphName; eyebrow: string; title: string; lead?: ReactNode }) {
  return (
    <div id={id} className="mb-8 scroll-mt-8">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-sky-300/90">{eyebrow}</p>
      <h2 className="flex items-center gap-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        <GlyphTile name={icon} size="lg" /> {title}
      </h2>
      {lead && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">{lead}</p>}
    </div>
  );
}

function IconCard({ icon, title, text, tone = "sky" }: { icon: GlyphName; title: string; text: string; tone?: "sky" | "violet" | "green" }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-white/10 bg-[#ffffff]/95 p-5 transition-colors hover:border-white/20">
      <GlyphTile name={icon} tone={tone} />
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-white/65">{text}</p>
      </div>
    </div>
  );
}

const ISOLATION_SCOPE: ChatScope = {
  name: "Crew support",
  inputId: "isolation-input",
  placeholder: "Ask about isolation in space…",
  tone: "sky",
  avatar: "headset",
  hello: (
    <>
      Hi, I'm crew support. Ask me how isolation affects astronauts, why it gets harder on the way to Mars, how crews cope,
      how scientists study it on Earth, or what the hospital isolation classes mean.
    </>
  ),
  greet: "Hi! I'm crew support. Ask me about isolation in space: how it feels, why it's harder far from Earth, and how crews cope.",
  suggestions: ["What is the third-quarter effect?", "Why is isolation worse on a Mars mission?", "How do astronauts cope with isolation?", "How do scientists study isolation on Earth?", "What is a medical isolation room?", "How small and cramped is the space station?"],
  followUps: ["What are the psychological effects of isolation?", "How are astronauts selected for isolation?", "What is social isolation for astronauts?", "What is the difference between negative and positive pressure rooms?", "What is the overview effect?", "What happened in the Mars-500 experiment?", "What is winter-over syndrome?"],
  unknownText:
    "I only cover isolation, and I don't have that in the team's research yet. Try one of these. If you're struggling, talk to a crewmate, and the flight surgeon and psychologists are there for you too.",
  library: (p) => p.id.startsWith("isolation#") || p.id.startsWith("sleep-and-mind#") || p.id.startsWith("isolation-deep#"),
  topics: [],
};

export default function IsolationPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const nav: [string, string, GlyphName][] = [
    ["iso-kinds", "Two kinds", "capsule"],
    ["iso-mind", "The mind", "lowMood"],
    ["iso-mars", "Farther away", "paleDot"],
    ["iso-coping", "Coping", "headset"],
    ["iso-earth", "On Earth", "dome"],
    ["iso-medical", "In hospitals", "room"],
    ["iso-ask", "Ask", "chat"],
  ];

  return (
    <Shell
      eyebrow="Isolation"
      title="Alone, together, far from home."
      intro="One of the biggest challenges of spaceflight isn't physical. It's being cut off from people, sealed in a tiny world that never changes."
      back={{ label: "Back to VITALS" }}
    >
      <nav aria-label="Topics" className="-mt-4 mb-14 flex flex-wrap gap-2">
        {nav.map(([id, label, icon]) => (
          <a
            key={id}
            href="#/isolation"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:border-sky-300/60 hover:text-white"
          >
            <Glyph name={icon} className="h-4 w-4 text-sky-300" /> {label}
          </a>
        ))}
      </nav>

      {/* ---------- headline numbers ---------- */}
      <div className="mb-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.big} className="rounded-3xl border border-sky-300/15 bg-gradient-to-br from-sky-400/[0.1] via-transparent to-transparent p-6">
            <GlyphTile name={s.icon} />
            <p className="mt-5 text-4xl font-bold tracking-tight text-white">{s.big}</p>
            <p className="mt-1.5 text-sm leading-snug text-white/60">{s.small}</p>
          </div>
        ))}
      </div>

      <div className="space-y-28">
        {/* ---------- two kinds ---------- */}
        <section>
          <SectionTitle id="iso-kinds" icon="capsule" eyebrow="Two kinds of isolation" title="Cut off, and closed in." />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-[#ffffff]/95 p-7">
              <GlyphTile name="people" size="lg" />
              <p className="mt-5 text-2xl font-semibold">Social isolation</p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/65">
                The same 3 to 7 people for months. No family, no friends, none of the everyday variety of human contact.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#ffffff]/95 p-7">
              <GlyphTile name="capsule" size="lg" />
              <p className="mt-5 text-2xl font-semibold">Physical confinement</p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/65">
                The ISS has about the room of a large house, but it's cramped, loud with fans and pumps, and there's no
                outdoors. Orion and Dragon are far smaller.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- the mind ---------- */}
        <section>
          <SectionTitle id="iso-mind" icon="lowMood" eyebrow="Psychological effects" title="What it does to the mind." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EFFECTS.map((e) => (
              <IconCard key={e.title} {...e} tone="violet" />
            ))}
          </div>
        </section>

        {/* ---------- ISS vs Mars ---------- */}
        <section>
          <SectionTitle
            id="iso-mars"
            icon="paleDot"
            eyebrow="Why it gets worse"
            title="The farther you go, the lonelier it gets."
            lead="That's why space agencies treat psychological readiness as seriously as technical readiness for deep space."
          />
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#ffffff]/95">
            <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-white/10 bg-white/[0.03] px-5 py-4 text-sm font-semibold sm:px-7">
              <span className="text-white/50" />
              <span className="flex items-center gap-2">
                <Glyph name="satellite" className="h-5 w-5 text-sky-300" /> On the ISS
              </span>
              <span className="flex items-center gap-2">
                <Glyph name="mars" className="h-5 w-5 text-rose-300" /> On the way to Mars
              </span>
            </div>
            {COMPARE.map(([what, iss, mars]) => (
              <div key={what} className="grid grid-cols-[1fr_1fr_1fr] gap-3 border-b border-white/5 px-5 py-4 text-[15px] last:border-0 sm:px-7">
                <span className="font-medium text-white/60">{what}</span>
                <span className="text-white/85">{iss}</span>
                <span className="text-rose-200">{mars}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- coping ---------- */}
        <section>
          <SectionTitle id="iso-coping" icon="headset" eyebrow="How astronauts cope" title="Staying human up there." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COPING.map((c) => (
              <IconCard key={c.title} {...c} tone="green" />
            ))}
          </div>
        </section>

        {/* ---------- analogs ---------- */}
        <section>
          <SectionTitle id="iso-earth" icon="dome" eyebrow="How scientists study it" title="Isolation, rehearsed on Earth." lead="Analog missions lock crews away to learn what space isolation does, before anyone goes." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ANALOGS.map((a) => (
              <div key={a.title} className="rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6">
                <GlyphTile name={a.icon} size="lg" />
                <p className="mt-5 text-lg font-semibold">{a.title}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/65">{a.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- medical isolation ---------- */}
        <section>
          <SectionTitle
            id="iso-medical"
            icon="room"
            eyebrow="Isolation in medicine"
            title="Rooms that keep germs in, or out."
            lead="In hospitals, an isolation room separates patients with contagious diseases, or very weak immune systems, from everyone else."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CLASSES.map((c) => (
              <div key={c.code} className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6">
                <span className="absolute -right-2 -top-4 font-display text-8xl font-bold text-white/[0.05]" aria-hidden="true">
                  {c.code}
                </span>
                <GlyphTile name={c.icon} tone="violet" />
                <p className="mt-5 text-lg font-semibold">
                  Class {c.code} <span className="font-normal text-white/50">· {c.name}</span>
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/65">{c.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-white/45">The word elsewhere</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {MEANINGS.map((m) => (
                <div key={m.field} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <Glyph name={m.icon} className="h-5 w-5 text-white/60" />
                  <p className="mt-3 text-sm font-semibold text-white/85">{m.field}</p>
                  <p className="mt-1 text-[13px] leading-snug text-white/50">{m.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- chatbot ---------- */}
        <section id="iso-ask" className="grid scroll-mt-8 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-sky-300/90">Student support</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Questions about isolation?</h2>
            <p className="mt-4 max-w-[44ch] leading-relaxed text-white/65">
              The third-quarter dip, life on the way to Mars, how crews cope. Ask anything, offline.
            </p>
          </div>
          <ChatPanel scope={ISOLATION_SCOPE} />
        </section>
      </div>

      <div className="mt-24 space-y-2 border-t border-white/10 pt-6 text-sm text-white/50">
        <p>Research by team Mission 61:4.</p>
        <p>
          Further reading:{" "}
          <a href="https://www.sciencedirect.com/science/article/abs/pii/S0094576522001059" target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
            Acta Astronautica
          </a>
          {" · "}
          <a href="https://www.dlr.de/en/research-and-transfer/projects-and-missions/solis100-isolation-study" target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
            DLR SOLIS100 isolation study
          </a>
          . General information, not medical advice.
        </p>
      </div>
    </Shell>
  );
}
