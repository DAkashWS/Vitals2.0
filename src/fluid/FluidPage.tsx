import { useEffect, type ReactNode } from "react";
import { Shell } from "@/live/LivePage";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { ChatPanel, type ChatScope } from "@/sections/Assistant";

/*
 * Hydration (#/fluid): why students need to drink through the school day, how to spot
 * dehydration, and what to drink. Opened from the "Hydration" card. The chatbot below is unchanged.
 */

const STATS: { icon: GlyphName; big: string; small: string }[] = [
  { icon: "cup", big: "6–8", small: "glasses of fluid a day for most students, more in heat and sport" },
  { icon: "brain", big: "1–2%", small: "body water lost is enough to dull attention and mood" },
  { icon: "head", big: "#1", small: "simple cause of afternoon headaches in class" },
  { icon: "tap", big: "Water", small: "is the best drink: no sugar, no caffeine, no cost" },
];

const RISKS: { icon: GlyphName; title: string; tag: string; text: string }[] = [
  {
    icon: "brain",
    title: "Poor concentration",
    tag: "Learning",
    text: "Even mild dehydration makes it harder to focus, remember and solve problems, and makes students more tired and irritable.",
  },
  {
    icon: "head",
    title: "Headaches and dizziness",
    tag: "Common",
    text: "A dry mouth, headache or light-headed feeling, especially after break or PE, is often the first sign a student needs a drink.",
  },
  {
    icon: "flame",
    title: "Heat illness",
    tag: "Hot days",
    text: "Sport in hot weather without enough water can lead to heat exhaustion: heavy sweating, nausea, cramps and fainting.",
  },
  {
    icon: "kidney",
    title: "Constipation and bladder problems",
    tag: "Long term",
    text: "Students who avoid drinking (often to avoid school toilets) are more likely to get constipation and urinary infections.",
  },
];

const URINE: { colour: string; label: string; tone: "ok" | "watch" | "act" }[] = [
  { colour: "#fdf6d8", label: "Pale straw: well hydrated", tone: "ok" },
  { colour: "#f9e79f", label: "Light yellow: good", tone: "ok" },
  { colour: "#f4d03f", label: "Yellow: drink a glass now", tone: "watch" },
  { colour: "#d4a017", label: "Dark yellow: dehydrated", tone: "act" },
  { colour: "#a0522d", label: "Amber or brown: drink and tell an adult", tone: "act" },
];

const DRINKS: { icon: GlyphName; title: string; text: string }[] = [
  {
    icon: "tap",
    title: "Best: water and milk",
    text: "Plain water any time, and plain milk for calcium. A refillable bottle on the desk makes it easy to sip all day.",
  },
  {
    icon: "warning",
    title: "Limit: juice, fizzy and energy drinks",
    text: "Sugary drinks damage teeth and add empty calories. Energy drinks are high in caffeine and are not suitable for children.",
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

const FLUID_SCOPE: ChatScope = {
  name: "Hydration guide",
  inputId: "fluid-input",
  placeholder: "Ask about water, drinks, thirst or dehydration…",
  tone: "violet",
  avatar: "cup",
  hello: (
    <>
      Hi, I'm the hydration guide. Ask me how much water a student needs, how to tell if you're dehydrated, what your pee colour means, or whether energy drinks are safe.
    </>
  ),
  greet: "Hi! I'm the hydration guide. Ask me how much to drink, the signs of dehydration, and which drinks are best.",
  suggestions: ["How much water should I drink each day?", "How do I know if I'm dehydrated?", "What colour should my pee be?", "Are energy drinks safe for students?", "Can not drinking cause headaches?", "How much should I drink during sport?"],
  followUps: ["Why does drinking water help at school?", "When should students drink during the day?", "Are fizzy drinks and juice OK?", "What is heat exhaustion?", "Is it dangerous to overdo it with water?", "Does milk count as a drink?"],
  unknownText:
    "The assistant is busy or can't be reached right now. Please try again in a moment. If it's urgent, tell a teacher and get the school nurse.",
};

export default function FluidPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const nav: [string, string, GlyphName][] = [
    ["fl-how", "Check your colour", "drop"],
    ["fl-risks", "Risks", "head"],
    ["fl-chain", "School day plan", "calendar"],
    ["fl-fight", "What to drink", "cup"],
    ["fl-ask", "Ask", "chat"],
  ];

  const DAY: { icon: GlyphName; title: string; text: string }[] = [
    { icon: "sunrise", title: "Breakfast", text: "Start the day with a glass of water or milk before leaving home." },
    { icon: "cup", title: "Every lesson", text: "Keep a water bottle on the desk and sip between tasks." },
    { icon: "treadmill", title: "Before and after PE", text: "Drink before sport, during long sessions, and refill afterwards." },
    { icon: "tap", title: "Home time", text: "An empty bottle by the end of the day is a good sign." },
  ];

  return (
    <Shell
      eyebrow="Hydration"
      title="A thirsty brain can't learn."
      intro="Most students don't drink enough during the school day. By the time they feel thirsty, their focus has already dropped."
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
        {/* ---------- urine colour check ---------- */}
        <section>
          <SectionTitle id="fl-how" icon="drop" eyebrow="The quick check" title="Check the colour." lead="The easiest way for a student to know if they're drinking enough: the colour of their pee." />
          <div className="grid gap-3 sm:grid-cols-5">
            {URINE.map((u) => (
              <div key={u.label} className="overflow-hidden rounded-3xl border border-white/10 bg-[#ffffff]/95">
                <div className="h-24" style={{ background: u.colour }} />
                <p className={`p-4 text-sm font-medium ${u.tone === "ok" ? "text-ok" : u.tone === "watch" ? "text-watch" : "text-act"}`}>{u.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-white/55">Some vitamins and foods can change the colour too. Dark urine that doesn't clear with drinking needs a doctor.</p>
        </section>

        {/* ---------- risks ---------- */}
        <section>
          <SectionTitle id="fl-risks" icon="head" eyebrow="Health and learning risks" title="What dehydration does." />
          <div className="grid gap-4 md:grid-cols-2">
            {RISKS.map((r) => (
              <div key={r.title} className="flex flex-col rounded-3xl border border-white/10 bg-[#ffffff]/95 p-7 transition-colors hover:border-violet-300/30">
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

        {/* ---------- school day plan ---------- */}
        <section>
          <SectionTitle
            id="fl-chain"
            icon="calendar"
            eyebrow="A school day plan"
            title="Drink before you're thirsty."
            lead="Thirst is a late signal. Little and often through the day works better than a lot at once."
          />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DAY.map((c, i) => (
              <li key={c.title} className="relative rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6">
                <span className="absolute right-5 top-4 font-mono text-sm text-white/30">0{i + 1}</span>
                <GlyphTile name={c.icon} tone="violet" />
                <p className="mt-5 text-lg font-semibold">{c.title}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/65">{c.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- what to drink ---------- */}
        <section>
          <SectionTitle id="fl-fight" icon="cup" eyebrow="What to drink" title="Water first." />
          <div className="grid gap-4 md:grid-cols-2">
            {DRINKS.map((f, i) => (
              <div key={f.title} className="rounded-3xl border border-white/10 bg-[#ffffff]/95 p-7">
                <GlyphTile name={f.icon} tone={i === 0 ? "green" : "red"} size="lg" />
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
              <p className="text-lg font-semibold">Thirst comes late. VITALS doesn't.</p>
              <p className="mt-1 text-[15px] leading-relaxed text-white/65">
                Log every glass with + on the Live monitor and see how the day is going.
              </p>
            </div>
            <Glyph name="play" className="hidden h-6 w-6 text-sky-300 sm:block" />
          </a>
        </section>

        {/* ---------- chatbot ---------- */}
        <section id="fl-ask" className="grid scroll-mt-8 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-violet-300/90">Hydration guide</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Questions about drinking enough?</h2>
            <p className="mt-4 max-w-[44ch] leading-relaxed text-white/65">How much water, which drinks, pee colour, energy drinks and headaches. Ask the hydration guide.</p>
          </div>
          <ChatPanel scope={FLUID_SCOPE} />
        </section>
      </div>

      <div className="mt-24 space-y-2 border-t border-white/10 pt-6 text-sm text-white/50">
        <p>School health guidance by team VITALS.</p>
        <p>General information, not medical advice. Fluid needs vary with age, size, weather and activity.</p>
      </div>
    </Shell>
  );
}
