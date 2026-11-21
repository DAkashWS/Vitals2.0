import { useEffect, type ReactNode } from "react";
import { Shell } from "@/live/LivePage";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { ChatPanel, type ChatScope } from "@/sections/Assistant";

/*
 * Fluid shift (#/fluid): the gist of the team's research on how fluids move toward the head
 * in microgravity, the health risks and how space programs fight it. Opened from the
 * "Fluid shift" card in the Modules tunnel. The chatbot answers from knowledge/fluid-shift.md.
 */

const STATS: { icon: GlyphName; big: string; small: string }[] = [
  { icon: "fluidUp", big: "2 L", small: "of blood and lymph move up toward the chest and head" },
  { icon: "eye", big: "SANS", small: "flattened eyeballs and swollen optic nerves" },
  { icon: "clot", big: "Backward", small: "blood flow seen in the neck vein on the ISS" },
  { icon: "faint", big: "Faint", small: "on standing, after landing back on Earth" },
];

const RISKS: { icon: GlyphName; title: string; tag: string; text: string }[] = [
  {
    icon: "skullPressure",
    title: "Spaceflight-associated neuro-ocular syndrome",
    tag: "SANS",
    text: "Fluid raises the pressure inside the skull. It pushes on the back of the eyes, flattening the eyeballs and swelling the optic nerves, which can leave vision blurry for the long term.",
  },
  {
    icon: "moonFace",
    title: "Puffy face, bird legs",
    tag: "Swelling",
    text: "Fluid pools in the upper body: the face swells and the sinuses block up like a permanent head cold, while the legs visibly shrink.",
  },
  {
    icon: "clot",
    title: "Stagnant blood and clots",
    tag: "Clot risk",
    text: "On the ISS, blood in the left internal jugular vein in the neck was seen to stall or even flow backward, sharply raising the risk of a dangerous clot.",
  },
  {
    icon: "faint",
    title: "Fainting after landing",
    tag: "Orthostatic intolerance",
    text: "The body treats the shifted fluid as too much blood and gets rid of water. Back on Earth there's less blood to go round, so standing up can bring severe dizziness or fainting.",
  },
];

const CHAIN: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "fluidUp", title: "Fluid moves up", text: "Without gravity, up to 2 litres shift toward the head." },
  { icon: "kidney", title: "Kidneys flush water", text: "The body reads it as too much blood and passes more water." },
  { icon: "drop", title: "Less blood, less thirst", text: "Blood volume falls, and you don't feel thirsty." },
  { icon: "faint", title: "Gravity returns", text: "Blood drops to the feet, the brain runs short: dizziness or fainting." },
];

const FIGHT: { icon: GlyphName; title: string; text: string }[] = [
  {
    icon: "vacuum",
    title: "Chibis suits",
    text: "Vacuum trousers use suction (lower body negative pressure) to pull blood back to the legs, imitating Earth's gravity and easing the pressure in the head.",
  },
  {
    icon: "salt",
    title: "Fluid loading",
    text: "Just before re-entry, astronauts drink plenty of salt water or take electrolyte tablets to quickly build back their blood volume.",
  },
];

function SectionTitle({ id, icon, eyebrow, title, lead }: { id: string; icon: GlyphName; eyebrow: string; title: string; lead?: ReactNode }) {
  return (
    <div id={id} className="mb-8 scroll-mt-8">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-violet-300/90">{eyebrow}</p>
      <h2 className="flex items-center gap-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        <GlyphTile name={icon} tone="violet" size="lg" /> {title}
      </h2>
      {lead && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">{lead}</p>}
    </div>
  );
}

/** A simple body: on Earth fluid sits low, in space it rises toward the head. */
function BodyFigure({ space }: { space: boolean }) {
  return (
    <svg viewBox="0 0 120 200" className="mx-auto h-56 w-auto" aria-hidden="true">
      <defs>
        <linearGradient id={space ? "fl-space" : "fl-earth"} x1="0" y1="0" x2="0" y2="1">
          {space ? (
            <>
              <stop offset="0" stopColor="#a78bfa" stopOpacity="0.85" />
              <stop offset="0.45" stopColor="#a78bfa" stopOpacity="0.45" />
              <stop offset="1" stopColor="#a78bfa" stopOpacity="0.08" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#38bdf8" stopOpacity="0.1" />
              <stop offset="0.55" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="1" stopColor="#38bdf8" stopOpacity="0.8" />
            </>
          )}
        </linearGradient>
      </defs>
      <g fill={`url(#${space ? "fl-space" : "fl-earth"})`} stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinejoin="round">
        {/* head: puffier in space */}
        <ellipse cx="60" cy="24" rx={space ? 19 : 15} ry={space ? 19 : 17} />
        {/* torso and arms */}
        <path d="M38 48h44l6 52-10 4-4-34-2 40H46l-2-40-4 34-10-4z" />
        {/* legs: thinner in space */}
        {space ? <path d="M50 110h7v80h-9zM63 110h7l2 80h-9z" /> : <path d="M46 110h13v80H45zM61 110h13l1 80H61z" />}
      </g>
      <g stroke={space ? "#c4b5fd" : "#7dd3fc"} strokeWidth="2.5" strokeLinecap="round" fill="none">
        {space ? (
          <>
            <path d="M14 150V90M14 90l-6 8M14 90l6 8" />
            <path d="M106 150V90M106 90l-6 8M106 90l6 8" />
          </>
        ) : (
          <>
            <path d="M14 90v60M14 150l-6-8M14 150l6-8" />
            <path d="M106 90v60M106 150l-6-8M106 150l6-8" />
          </>
        )}
      </g>
    </svg>
  );
}

const FLUID_SCOPE: ChatScope = {
  name: "Fluid shift guide",
  inputId: "fluid-input",
  placeholder: "Ask about fluid shift…",
  tone: "violet",
  avatar: "fluidUp",
  hello: (
    <>
      Hi, I'm the fluid shift guide. Ask me why fluids rise toward the head in space, what SANS does to the eyes, why
      astronauts faint after landing, or how Chibis suits and fluid loading help.
    </>
  ),
  greet: "Hi! I'm the fluid shift guide. Ask me how fluids move in space, what it does to the eyes and blood, and how crews fight it.",
  suggestions: ["What is fluid shift in space?", "What is SANS?", "Why do astronauts faint after landing?", "What are Chibis suits?", "Can fluid shift cause blood clots?", "What is fluid loading before landing?"],
  followUps: ["What is the puffy face, bird legs effect?", "Why do the kidneys get rid of water in space?", "Why do I feel less thirsty in space?", "How does VITALS help with fluid shift?", "Why do astronauts look younger in space?", "Why do astronauts need special glasses in space?", "What are Braslet cuffs?"],
  unknownText:
    "I only cover fluid shift, and I don't have that in the team's research yet. Try one of these. Any change in your vision, or neck swelling or pain, goes to the flight surgeon.",
  library: (p) => p.id.startsWith("fluid-shift#") || p.id.startsWith("fluid-shift-and-vision#") || p.id.startsWith("returning-to-earth#") || p.id.startsWith("fluid-shift-deep#"),
  topics: [],
};

export default function FluidPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const nav: [string, string, GlyphName][] = [
    ["fl-how", "How it happens", "fluidUp"],
    ["fl-risks", "Risks", "skullPressure"],
    ["fl-chain", "Landing", "faint"],
    ["fl-fight", "Fighting it", "vacuum"],
    ["fl-ask", "Ask", "chat"],
  ];

  return (
    <Shell
      eyebrow="Fluid shift"
      title="When fluids forget which way is down."
      intro="On Earth, gravity holds your blood in your legs. In orbit, up to two litres rush toward your head, and the body starts making mistakes."
      back={{ label: "Back to VITALS" }}
    >
      <nav aria-label="Topics" className="-mt-4 mb-14 flex flex-wrap gap-2">
        {nav.map(([id, label, icon]) => (
          <a
            key={id}
            href="#/fluid"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:border-violet-300/60 hover:text-white"
          >
            <Glyph name={icon} className="h-4 w-4 text-violet-300" /> {label}
          </a>
        ))}
      </nav>

      {/* ---------- headline numbers ---------- */}
      <div className="mb-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.big} className="rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-400/[0.1] via-transparent to-transparent p-6">
            <GlyphTile name={s.icon} tone="violet" />
            <p className="mt-5 text-4xl font-bold tracking-tight text-white">{s.big}</p>
            <p className="mt-1.5 text-sm leading-snug text-white/60">{s.small}</p>
          </div>
        ))}
      </div>

      <div className="space-y-28">
        {/* ---------- how it happens ---------- */}
        <section>
          <SectionTitle id="fl-how" icon="fluidUp" eyebrow="How it happens" title="Gravity lets go." />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-7">
              <BodyFigure space={false} />
              <p className="mt-6 flex items-center gap-2 text-2xl font-semibold">
                <Glyph name="globe" className="h-6 w-6 text-sky-300" /> On Earth
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/65">Gravity pulls blood and lymph down toward the legs. The body is built around that pull.</p>
            </div>
            <div className="rounded-3xl border border-violet-300/25 bg-[#0b0d14]/95 p-7">
              <BodyFigure space />
              <p className="mt-6 flex items-center gap-2 text-2xl font-semibold">
                <Glyph name="satellite" className="h-6 w-6 text-violet-300" /> In microgravity
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/65">
                The pull disappears. Up to <strong className="text-white">two litres</strong> of fluid shift up from the lower body toward the chest and head.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- risks ---------- */}
        <section>
          <SectionTitle id="fl-risks" icon="skullPressure" eyebrow="Health and body risks" title="What the shift does." />
          <div className="grid gap-4 md:grid-cols-2">
            {RISKS.map((r) => (
              <div key={r.title} className="flex flex-col rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-7 transition-colors hover:border-violet-300/30">
                <div className="flex items-start justify-between gap-3">
                  <GlyphTile name={r.icon} tone="violet" size="lg" />
                  <span className="rounded-full bg-violet-400/15 px-3 py-1 text-xs font-semibold text-violet-200">{r.tag}</span>
                </div>
                <p className="mt-5 text-xl font-semibold">{r.title}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-white/65">{r.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- chain to fainting ---------- */}
        <section>
          <SectionTitle
            id="fl-chain"
            icon="faint"
            eyebrow="Why landing is hard"
            title="From a puffy face to a fainting spell."
            lead="Orthostatic intolerance is a chain reaction that starts on day one in orbit and ends the moment an astronaut stands up on Earth."
          />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHAIN.map((c, i) => (
              <li key={c.title} className="relative rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-6">
                <span className="absolute right-5 top-4 font-mono text-sm text-white/30">0{i + 1}</span>
                <GlyphTile name={c.icon} tone={i === CHAIN.length - 1 ? "red" : "violet"} />
                <p className="mt-5 text-lg font-semibold">{c.title}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/65">{c.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- fighting it ---------- */}
        <section>
          <SectionTitle id="fl-fight" icon="vacuum" eyebrow="How space programs fight it" title="Pulling the blood back down." />
          <div className="grid gap-4 md:grid-cols-2">
            {FIGHT.map((f) => (
              <div key={f.title} className="rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-7">
                <GlyphTile name={f.icon} tone="green" size="lg" />
                <p className="mt-5 text-2xl font-semibold">{f.title}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-white/65">{f.text}</p>
              </div>
            ))}
          </div>
          <a
            href="#/live"
            className="mt-4 flex items-center gap-5 rounded-3xl border border-sky-300/20 bg-gradient-to-r from-sky-400/[0.1] to-transparent p-6 transition-colors hover:border-sky-300/50"
          >
            <GlyphTile name="tap" size="lg" />
            <div className="flex-1">
              <p className="text-lg font-semibold">Your thirst lies to you. VITALS doesn't.</p>
              <p className="mt-1 text-[15px] leading-relaxed text-white/65">
                Fluid shift turns thirst down. Log every glass with + on the Live monitor and watch it against the 2.5–3.5 L green band.
              </p>
            </div>
            <Glyph name="play" className="hidden h-6 w-6 text-sky-300 sm:block" />
          </a>
        </section>

        {/* ---------- chatbot ---------- */}
        <section id="fl-ask" className="grid scroll-mt-8 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-violet-300/90">Fluid shift guide</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Questions about fluid shift?</h2>
            <p className="mt-4 max-w-[44ch] leading-relaxed text-white/65">SANS, clots, fainting after landing, Chibis suits. Ask anything, offline.</p>
          </div>
          <ChatPanel scope={FLUID_SCOPE} />
        </section>
      </div>

      <div className="mt-24 space-y-2 border-t border-white/10 pt-6 text-sm text-white/50">
        <p>Research by team Mission 61:4.</p>
        <p>
          Further reading:{" "}
          <a href="https://www.nasa.gov/humans-in-space/nasa-fluid-shifts-study-advances-journey-to-mars/" target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">
            NASA Fluid Shifts study
          </a>
          . General information, not medical advice.
        </p>
      </div>
    </Shell>
  );
}
