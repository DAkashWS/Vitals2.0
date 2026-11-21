import { useEffect } from "react";
import type { ReactNode } from "react";
import { Shell } from "@/live/LivePage";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { ChatPanel, type ChatScope } from "@/sections/Assistant";

/*
 * Bones, posture and sport (#/bone): how school-age bodies grow strong, and the everyday school
 * risks to bones and muscles (heavy bags, long sitting, sports injuries). Opened from the
 * "Bones and posture" card. The chatbot below is unchanged.
 */

const STATS: { icon: GlyphName; big: string; small: string }[] = [
  { icon: "bone", big: "~90%", small: "of adult bone mass is built by about age 18 to 20" },
  { icon: "treadmill", big: "60 min", small: "of moderate to vigorous activity a day, on average, for ages 5 to 17 (WHO)" },
  { icon: "scale", big: "10–15%", small: "of body weight: the most a school bag should weigh" },
  { icon: "moon", big: "8–11 hrs", small: "of sleep a night, when growing bodies repair and grow" },
];

const RISKS: { icon: GlyphName; label: string }[] = [
  { icon: "scale", label: "Heavy school bags" },
  { icon: "spine", label: "Slouching at desks" },
  { icon: "shake", label: "Neck ache from phones" },
  { icon: "muscle", label: "Sprains and strains" },
  { icon: "bone", label: "Broken bones from falls" },
  { icon: "pelvis", label: "Growth plate injuries" },
  { icon: "battery", label: "Too little exercise" },
  { icon: "calcium", label: "Low calcium and vitamin D" },
];

const PLAY: { icon: GlyphName; name: string; text: string }[] = [
  { icon: "treadmill", name: "Run, jump, skip", text: "Impact activities like running, skipping and ball games are what tell bones to grow denser." },
  { icon: "dumbbell", name: "Strength, 3 days a week", text: "Climbing, push-ups, sport and play that make muscles work hard help both muscle and bone." },
  { icon: "bike", name: "Active travel", text: "Walking or cycling to school adds activity to every day without extra time." },
  { icon: "cup", name: "Food for bones", text: "Milk, yoghurt, cheese, green vegetables and fortified foods for calcium; daylight and some foods for vitamin D." },
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
    ["bone-bags", "School bags", "spine"],
    ["bone-bone", "Growing bones", "bone"],
    ["bone-gym", "Moving more", "treadmill"],
    ["bone-sport", "Sports injuries", "medKit"],
    ["bone-ask", "Ask the coach", "chat"],
  ];

  return (
    <Shell
      eyebrow="Bones, posture & sport"
      title="Strong bones are built at school."
      intro="Most of the bone a person will ever have is built before they leave school. Here's how to build it, and how to protect it."
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
          <SectionTitle id="bone-big" icon="scale" eyebrow="The big picture" title="What wears young bodies down." lead="School days mean heavy bags, long hours sitting, and plenty of sport. Each one can help or hurt." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RISKS.map((e) => (
              <div key={e.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#ffffff]/95 px-4 py-3.5">
                <GlyphTile name={e.icon} tone="amber" size="sm" />
                <span className="text-[15px] font-medium text-white/85">{e.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[15px] leading-relaxed text-white/75">
                Childhood and the teenage years are the <span className="text-white">only window</span> to build peak bone
                mass. Bone built now protects against fractures and osteoporosis for the rest of life.
              </p>
            </div>
            <div className="rounded-3xl border border-amber-300/20 bg-amber-400/[0.05] p-6">
              <p className="text-[15px] leading-relaxed text-white/75">
                <span className="font-semibold text-amber-200">Watch for:</span> pain that lasts more than a few days, a limp,
                swelling, or pain that wakes a student at night. These need a doctor, not just rest.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- school bags and posture ---------- */}
        <section>
          <SectionTitle id="bone-bags" icon="spine" eyebrow="School bags & posture" title="Carry it right, sit it right." lead="Back and neck pain are common in students, and most of it comes from how they carry and how they sit." />
          <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              {[
                ["scale", "Light enough", "A loaded bag should weigh no more than about 10 to 15% of the student's body weight."],
                ["spine", "Both straps, worn high", "Two padded straps, tightened so the bag sits close to the back, heaviest books nearest the spine."],
                ["shake", "Head up from screens", "Hold phones and tablets nearer eye level. Looking down for long periods strains the neck."],
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
              <p className="mb-5 font-mono text-xs uppercase tracking-[0.28em] text-white/50">A 40 kg student</p>
              <div className="space-y-5">
                <Bar label="Safe bag weight (10–15%)" value="4–6 kg" width="38%" tone="calm" />
                <Bar label="Typical overloaded bag" value="8+ kg" width="100%" tone="hot" />
              </div>
              <p className="mt-5 text-sm text-white/55">Weigh the bag on bathroom scales. Leave in school what isn't needed at home.</p>
            </div>
          </div>
        </section>

        {/* ---------- growing bones ---------- */}
        <section>
          <SectionTitle id="bone-bone" icon="bone" eyebrow="Growing bones" title="Bones grow where they're used." lead="Bone is living tissue. Jumping, running and lifting tell it to grow stronger; sitting all day tells it to slow down." />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-[#ffffff]/95 p-7">
              <p className="mb-5 font-mono text-xs uppercase tracking-[0.28em] text-white/50">Builders and recyclers</p>
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <GlyphTile name="boneCells" tone="green" />
                  <div className="flex-1">
                    <p className="font-semibold">Active student: building wins</p>
                    <p className="text-sm text-white/60">Bone-building cells add new bone faster than old bone is removed, so bones get denser every year.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <GlyphTile name="boneCells" tone="red" />
                  <div className="flex-1">
                    <p className="font-semibold">Inactive student: a missed chance</p>
                    <p className="text-sm text-white/60">With little impact and little calcium, bones grow longer but not as strong as they could.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#ffffff]/95 p-7">
              <p className="mb-5 font-mono text-xs uppercase tracking-[0.28em] text-white/50">Calcium a day (ages 9–18)</p>
              <div className="space-y-5">
                <Bar label="Recommended" value="~1,300 mg" width="100%" tone="calm" />
                <Bar label="One glass of milk" value="~300 mg" width="23%" tone="hot" />
              </div>
              <p className="mt-5 text-sm text-white/55">Roughly three to four servings of dairy or calcium-rich foods a day.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["pelvis", "Growth plates", "Soft areas near the ends of bones where growth happens. They're weaker than the bone around them."],
              ["calcium", "Calcium", "The main mineral in bone. Most teenagers get less than they need."],
              ["sunrise", "Vitamin D", "Helps the body absorb calcium. Made in the skin in daylight and found in some foods."],
              ["moon", "Sleep", "Growth hormone is released mostly during deep sleep."],
            ].map(([icon, title, text]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-[#ffffff]/95 p-5">
                <GlyphTile name={icon as GlyphName} tone="amber" />
                <p className="mt-4 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-white/60">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- moving more ---------- */}
        <section>
          <SectionTitle id="bone-gym" icon="treadmill" eyebrow="Moving more" title="Every school is a gym." lead="Break time, PE and the walk home all count towards the hour a day." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLAY.map((g) => (
              <div key={g.name} className="group rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6 transition-colors hover:border-amber-300/30">
                <GlyphTile name={g.icon} tone="amber" size="lg" />
                <p className="mt-5 text-lg font-semibold">{g.name}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/65">{g.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-300/25 bg-gradient-to-r from-amber-400/[0.12] to-transparent px-7 py-6">
            <p className="text-2xl font-semibold tracking-tight">60 minutes a day</p>
            <p className="max-w-md text-[15px] text-white/70">The average daily activity the WHO recommends for ages 5 to 17, with muscle and bone strengthening at least 3 days a week.</p>
          </div>
        </section>

        {/* ---------- sports injuries ---------- */}
        <section>
          <SectionTitle id="bone-sport" icon="medKit" eyebrow="Sports injuries" title="Hurt on the field." lead="Most sports injuries at school are sprains and strains. Here's what to do in the first minutes." />
          <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {[
              ["warning", "Stop and check", "Stop playing. Don't run it off. Look for swelling, a strange shape, or not being able to put weight on it."],
              ["snowflake", "Rest, ice, raise", "Rest it, apply a wrapped ice pack for up to 20 minutes, and keep the injured part raised."],
              ["stethoscope", "Get it seen", "Suspected broken bone, head knock, severe pain or no better in 2 days: see the school nurse or a doctor."],
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
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <GlyphTile name="head" tone="violet" />
            <p className="text-[15px] text-white/75">
              <span className="font-semibold text-white">Head injuries:</span> any student with a knock to the head who is
              dizzy, sick, confused or has a headache stops playing for the day and is checked by an adult. When in doubt, sit
              them out.
            </p>
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
        <p>School health guidance by team VITALS, drawing on WHO physical activity guidelines.</p>
        <p>General information, not medical advice. Serious or lasting pain needs a doctor.</p>
      </div>
    </Shell>
  );
}
