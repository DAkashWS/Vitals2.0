import { useEffect, type ReactNode } from "react";
import { Shell } from "@/live/LivePage";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { ChatPanel, type ChatScope } from "@/sections/Assistant";

/*
 * Bone & muscle (#/bone): the gist of Nithin's research, adapted from the Wikipedia article
 * "Effect of spaceflight on the human body" (CC BY-SA 4.0). Opened from the "Bone and muscle"
 * card in the Modules tunnel. The chatbot answers from knowledge/bone-muscle-research.md.
 */

const STATS: { icon: GlyphName; big: string; small: string }[] = [
  { icon: "muscle", big: "Up to 20%", small: "of muscle mass lost in 5–11 days without exercise" },
  { icon: "chartDown", big: "1.5% / month", small: "of bone lost from the spine, hips and thigh bone" },
  { icon: "boneCells", big: "+197%", small: "more bone-eating cells in mice after just 16 days" },
  { icon: "hourglass", big: "2–3 years", small: "to rebuild bone after a 3–4 month trip" },
];

const EFFECTS: { icon: GlyphName; label: string }[] = [
  { icon: "muscle", label: "Muscle wasting" },
  { icon: "bone", label: "Bone loss" },
  { icon: "heartPulse", label: "A slower heart and circulation" },
  { icon: "bloodCell", label: "Fewer red blood cells (space anemia)" },
  { icon: "spiral", label: "Balance problems" },
  { icon: "eye", label: "Eyesight changes" },
  { icon: "shield", label: "A changed immune system" },
  { icon: "moonFace", label: "Puffy \"moon face\"" },
  { icon: "scale", label: "Loss of body mass" },
  { icon: "fog", label: "Blocked nose" },
  { icon: "moon", label: "Disturbed sleep" },
  { icon: "bubbles", label: "Extra flatulence" },
];

const GEAR: { icon: GlyphName; name: string; text: string }[] = [
  { icon: "treadmill", name: "Two treadmills", text: "Including COLBERT. Bungee cords strap the runner down so they don't float off." },
  { icon: "dumbbell", name: "ARED weights", text: "Resistance machine for squats and lifts. Builds muscle, but can't stop bone loss alone." },
  { icon: "bike", name: "Stationary bike", text: "Cardio with no seat needed: you clip in and pedal." },
  { icon: "pants", name: "Squeeze trousers", text: "Elastic bands from waist to cuff load the leg bones to slow bone loss." },
];

function SectionTitle({ id, icon, eyebrow, title, lead }: { id: string; icon: GlyphName; eyebrow: string; title: string; lead?: ReactNode }) {
  return (
    <div id={id} className="mb-8 scroll-mt-8">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-amber-300/90">{eyebrow}</p>
      <h2 className="flex items-center gap-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        <GlyphTile name={icon} tone="amber" size="lg" /> {title}
      </h2>
      {lead && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">{lead}</p>}
    </div>
  );
}

/** A horizontal bar for the Earth vs space comparison. */
function Bar({ label, value, width, tone }: { label: string; value: string; width: string; tone: "calm" | "hot" }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-white/70">{label}</span>
        <span className={`font-semibold tabular-nums ${tone === "hot" ? "text-amber-300" : "text-white/80"}`}>{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${tone === "hot" ? "bg-gradient-to-r from-amber-500 to-rose-400" : "bg-white/40"}`} style={{ width }} />
      </div>
    </div>
  );
}

const BONE_SCOPE: ChatScope = {
  name: "Bone & muscle coach",
  inputId: "bone-input",
  placeholder: "Ask about bones and muscles in space…",
  tone: "amber",
  avatar: "muscle",
  hello: (
    <>
      Hi, I'm the bone and muscle coach. Ask me how fast astronauts lose muscle and bone, why it happens, what the ISS gym
      looks like, or how NASA's digital astronaut plans workouts. General information from the VITALS research library.
    </>
  ),
  greet: "Hi! I'm the bone and muscle coach. Ask me how space wears down muscle and bone, and how astronauts fight back.",
  suggestions: ["How much muscle do astronauts lose?", "Why does bone break down in space?", "What exercise equipment is on the ISS?", "Why do astronauts wear special trousers?", "Can bone loss cause kidney stones?", "What is the Digital Astronaut Project?"],
  followUps: ["How much bone do astronauts lose in space?", "How do muscle fibres change in space?", "Does bone grow back after spaceflight?", "Does weight-lifting on the ARED protect bones?", "Do the soles of astronauts' feet change?", "What were the mighty mice in space?", "Why is back pain so common in space?"],
  unknownText:
    "I only cover bones and muscles in space, and I don't have that in my library yet. Try one of these, or ask the main VITALS assistant about other health questions.",
  library: (p) => p.id.startsWith("bone-muscle-research#") || p.id.startsWith("bones-muscles-exercise#") || p.id.startsWith("bone-muscle-deep#"),
  topics: [],
};

export default function BonePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const nav: [string, string, GlyphName][] = [
    ["bone-big", "The big picture", "scale"],
    ["bone-muscle", "Muscle", "muscle"],
    ["bone-bone", "Bone", "bone"],
    ["bone-gym", "Fighting back", "treadmill"],
    ["bone-digital", "Digital astronaut", "digitalAstronaut"],
    ["bone-ask", "Ask the coach", "chat"],
  ];

  return (
    <Shell
      eyebrow="Bone & muscle"
      title="Use it or lose it."
      intro="Without gravity, the body stops keeping what it doesn't need. Here's what goes, how fast, and how astronauts fight back."
      back={{ label: "Back to VITALS" }}
    >
      <nav aria-label="Topics" className="-mt-4 mb-14 flex flex-wrap gap-2">
        {nav.map(([id, label, icon]) => (
          <a
            key={id}
            href="#/bone"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:border-amber-300/60 hover:text-white"
          >
            <Glyph name={icon} className="h-4 w-4 text-amber-300" /> {label}
          </a>
        ))}
      </nav>

      {/* ---------- headline numbers ---------- */}
      <div className="mb-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.big} className="relative overflow-hidden rounded-3xl border border-amber-300/15 bg-gradient-to-br from-amber-400/[0.1] via-transparent to-transparent p-6">
            <GlyphTile name={s.icon} tone="amber" />
            <p className="mt-5 text-4xl font-bold tracking-tight text-white">{s.big}</p>
            <p className="mt-1.5 text-sm leading-snug text-white/60">{s.small}</p>
          </div>
        ))}
      </div>

      <div className="space-y-28">
        {/* ---------- the big picture ---------- */}
        <section>
          <SectionTitle id="bone-big" icon="scale" eyebrow="The big picture" title="Space is hard on the body." lead="Mostly harmful, short term and long term. Muscle and bone take the biggest hit, but they're not alone." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EFFECTS.map((e) => (
              <div key={e.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#ffffff]/95 px-4 py-3.5">
                <GlyphTile name={e.icon} tone="amber" size="sm" />
                <span className="text-[15px] font-medium text-white/85">{e.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[15px] leading-relaxed text-white/75">
                A 2024 review called bone loss, cancer risk, vision problems, weaker immunity and mental health the
                well-known problems, but what happens <span className="text-white">at a molecular level</span> still isn't
                fully clear.
              </p>
            </div>
            <div className="rounded-3xl border border-amber-300/20 bg-amber-400/[0.05] p-6">
              <p className="text-[15px] leading-relaxed text-white/75">
                <span className="font-semibold text-amber-200">A new worry:</span> private and commercial spaceflights now
                fly without any medical research on their passengers.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- muscle ---------- */}
        <section>
          <SectionTitle id="bone-muscle" icon="muscle" eyebrow="Muscle" title="The standing muscles switch off." lead="Floating, you barely use your back and legs. So they shrink, fast." />
          <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              {[
                ["muscle", "Up to 20% gone in 5–11 days", "Without exercise, that's how fast muscle mass can disappear."],
                ["spine", "Back and legs first", "The muscles that hold you upright on Earth have nothing to do in orbit."],
                ["pill", "Help on the way", "Exercise research, hormone supplements and medicines may help hold on to muscle."],
              ].map(([icon, title, text]) => (
                <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-[#ffffff]/95 p-5">
                  <GlyphTile name={icon as GlyphName} tone="amber" />
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="mt-1 text-[15px] text-white/65">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col justify-center rounded-3xl border border-white/10 bg-[#ffffff]/95 p-7">
              <p className="mb-5 font-mono text-xs uppercase tracking-[0.28em] text-white/50">The fibre switch</p>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <div className="flex-1 rounded-2xl border border-white/15 bg-white/[0.04] p-5 text-center">
                  <Glyph name="fibres" className="mx-auto h-9 w-9 text-white/80" />
                  <p className="mt-3 font-semibold">Slow-twitch</p>
                  <p className="mt-1 text-sm text-white/55">Endurance fibres that hold your posture</p>
                </div>
                <span className="text-center text-2xl text-amber-300" aria-hidden="true">
                  {"→︎"}
                </span>
                <div className="flex-1 rounded-2xl border border-amber-300/30 bg-amber-400/[0.07] p-5 text-center">
                  <Glyph name="bolt" className="mx-auto h-9 w-9 text-amber-300" />
                  <p className="mt-3 font-semibold">Fast-twitch</p>
                  <p className="mt-1 text-sm text-white/55">Quick to fire, but not built for heavy work</p>
                </div>
              </div>
              <p className="mt-5 text-sm text-white/55">In space, the endurance fibres are replaced by fast ones.</p>
            </div>
          </div>
        </section>

        {/* ---------- bone ---------- */}
        <section>
          <SectionTitle id="bone-bone" icon="bone" eyebrow="Bone" title="The builders fall behind." lead="Bone grows where it's stressed. In microgravity there's almost no stress, so the balance breaks." />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-[#ffffff]/95 p-7">
              <p className="mb-5 font-mono text-xs uppercase tracking-[0.28em] text-white/50">Two crews, one bone</p>
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <GlyphTile name="boneCells" tone="green" />
                  <div className="flex-1">
                    <p className="font-semibold">On Earth: balanced</p>
                    <p className="text-sm text-white/60">Osteoclasts break old bone down and osteoblasts build new bone, always together.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <GlyphTile name="boneCells" tone="red" />
                  <div className="flex-1">
                    <p className="font-semibold">In space: the wreckers win</p>
                    <p className="text-sm text-white/60">Osteoclasts speed up, osteoblasts don't keep up. Bone goes and isn't replaced, most of all in the pelvis.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#ffffff]/95 p-7">
              <p className="mb-5 font-mono text-xs uppercase tracking-[0.28em] text-white/50">Bone lost in a year</p>
              <div className="space-y-5">
                <Bar label="Healthy adult on Earth" value="~0.3%" width="2.5%" tone="calm" />
                <Bar label="Astronaut in microgravity" value="~12%" width="100%" tone="hot" />
              </div>
              <p className="mt-5 text-sm text-white/55">About 3% per decade on Earth, versus about 1% every month in space.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["spine", "Lower spine", "One of the hardest-hit areas"],
              ["pelvis", "Hips", "Where bone-eating cells are busiest"],
              ["kidney", "Kidney stones", "Calcium from lost bone can form stones and harden soft tissue"],
              ["hourglass", "Slow comeback", "Bone returns after landing, but takes 2–3 years"],
            ].map(([icon, title, text]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-[#ffffff]/95 p-5">
                <GlyphTile name={icon as GlyphName} tone="amber" />
                <p className="mt-4 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-white/60">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <GlyphTile name="mouse" tone="violet" />
            <p className="text-[15px] text-white/75">
              <span className="font-semibold text-white">The mouse study:</span> after only 16 days in microgravity, bone-eating
              cells rose by 197% while bone-building cells fell.
            </p>
          </div>
        </section>

        {/* ---------- fighting back ---------- */}
        <section>
          <SectionTitle id="bone-gym" icon="treadmill" eyebrow="Fighting back" title="The gym in orbit." lead="Every astronaut trains for at least two hours, every day." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GEAR.map((g) => (
              <div key={g.name} className="group rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6 transition-colors hover:border-amber-300/30">
                <GlyphTile name={g.icon} tone="amber" size="lg" />
                <p className="mt-5 text-lg font-semibold">{g.name}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/65">{g.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-300/25 bg-gradient-to-r from-amber-400/[0.12] to-transparent px-7 py-6">
            <p className="text-2xl font-semibold tracking-tight">2+ hours a day</p>
            <p className="max-w-md text-[15px] text-white/70">The minimum exercise for every astronaut on the ISS, to protect muscle, bone and heart.</p>
          </div>
        </section>

        {/* ---------- digital astronaut ---------- */}
        <section>
          <SectionTitle id="bone-digital" icon="digitalAstronaut" eyebrow="The future" title="A digital astronaut." lead="NASA models the body on a computer to find the workout that actually works." />
          <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {[
              ["dumbbell", "ARED model", "A computer model of the weight machine on the ISS"],
              ["digitalAstronaut", "+ OpenSim body", "A model of the human skeleton and muscles exercising on it"],
              ["chartDown", "Forces → workouts", "Joint and muscle forces show whether a plan will keep bones and muscles healthy"],
            ].flatMap(([icon, title, text], i) => [
              ...(i > 0
                ? [
                    <span key={`arrow-${i}`} className="hidden self-center text-2xl text-amber-300 lg:block" aria-hidden="true">
                      {"→︎"}
                    </span>,
                  ]
                : []),
              <div key={title} className="rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6">
                <GlyphTile name={icon as GlyphName} tone="amber" />
                <p className="mt-4 text-lg font-semibold">{title}</p>
                <p className="mt-1 text-[15px] text-white/65">{text}</p>
              </div>,
            ])}
          </div>
        </section>

        {/* ---------- chatbot ---------- */}
        <section id="bone-ask" className="grid scroll-mt-8 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-amber-300/90">Ask the coach</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Questions about bones and muscles?</h2>
            <p className="mt-4 max-w-[44ch] leading-relaxed text-white/65">How fast does it go? Why? What's in the ISS gym? Ask the coach, offline.</p>
          </div>
          <ChatPanel scope={BONE_SCOPE} />
        </section>
      </div>

      <div className="mt-24 space-y-2 border-t border-white/10 pt-6 text-sm text-white/50">
        <p>
          Research by team Mission 61:4.
        </p>
        <p>
          A summary of the Wikipedia article{" "}
          <a href="https://en.wikipedia.org/wiki/Effect_of_spaceflight_on_the_human_body" target="_blank" rel="noreferrer" className="text-amber-300 hover:underline">
            "Effect of spaceflight on the human body"
          </a>
          , licensed under{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="text-amber-300 hover:underline">
            CC BY-SA 4.0
          </a>
          . Some figures, such as the 2–3 year recovery time, are marked "citation needed" in the article. General
          information, not medical advice.
        </p>
      </div>
    </Shell>
  );
}
