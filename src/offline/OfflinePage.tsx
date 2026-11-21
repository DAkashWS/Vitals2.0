import { useEffect, type ReactNode } from "react";
import { Shell } from "@/live/LivePage";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";

/*
 * Offline support (#/offline): why a crew far from Earth has to look after itself, how long help
 * takes to arrive, and what VITALS keeps working with no signal. Opened from the "Offline support"
 * card in the Modules tunnel. No chatbot on this page.
 */

const STATS: { icon: GlyphName; big: string; small: string }[] = [
  { icon: "satellite", big: "1.3 s", small: "for a radio signal to reach the Moon, one way" },
  { icon: "delay", big: "3–22 min", small: "for a signal to reach Mars, one way, depending on where the planets are" },
  { icon: "conjunction", big: "~2 weeks", small: "of near radio silence when the Sun sits between Earth and Mars" },
  { icon: "medKit", big: "0", small: "hospitals anywhere beyond Earth" },
];

/** One question to a doctor on Earth from Mars, at the worst distance. */
const CONVERSATION: { t: string; icon: GlyphName; title: string; text: string }[] = [
  { t: "09:00", icon: "headset", title: "You ask", text: "A crew member feels chest tightness. You send the readings and a question." },
  { t: "09:22", icon: "globe", title: "Earth hears it", text: "The message has crossed about 400 million km. The flight surgeon reads it." },
  { t: "09:30", icon: "stethoscope", title: "The doctor answers", text: "They need a few minutes to read the data and decide." },
  { t: "09:52", icon: "envelope", title: "The answer arrives", text: "Almost an hour after you asked. Whatever happened meanwhile, the crew handled alone." },
];

const DISTANCE: { icon: GlyphName; where: string; help: string; text: string }[] = [
  { icon: "satellite", where: "Space station", help: "Hours", text: "Live calls with doctors, and a capsule docked to bring a sick crew member home within a day." },
  { icon: "paleDot", where: "Moon", help: "Days", text: "Talk is almost live, but the trip home takes about three days." },
  { icon: "mars", where: "Mars", help: "Months", text: "Every message waits minutes, and the way home opens only when the planets line up, about every two years." },
];

const WORKS: { icon: GlyphName; title: string; text: string; href: string; cta: string }[] = [
  { icon: "medKit", title: "First-aid steps", text: "Clear steps for cuts, burns, sickness and more, with when to call the flight surgeon. All stored on board.", href: "#assistant", cta: "Open the assistant" },
  { icon: "bot", title: "Onboard AI", text: "The assistant's AI runs on the ship's own computer, not in the cloud, and answers from the VITALS library.", href: "#assistant", cta: "Ask a question" },
  { icon: "usb", title: "Sensors without internet", text: "The VITALS sensor pairs by USB cable or Bluetooth straight to the screen. No network involved.", href: "#/live", cta: "Open the live monitor" },
  { icon: "outbox", title: "Sync when the link is back", text: "Readings wait safely on the device and upload on their own as soon as there's a connection.", href: "#/account", cta: "Your account" },
  { icon: "simulator", title: "Practise before it happens", text: "Rehearse a CO2 build-up, a radiation storm or dehydration, so the first time isn't the real time.", href: "#/simulator", cta: "Open the simulator" },
  { icon: "lockDoor", title: "Your data stays with you", text: "Nothing needs a server to work. Personal readings stay on the device unless you choose to sync them.", href: "#/live", cta: "See your vitals" },
];

const STEPS: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "warning", title: "Make it safe", text: "Stop the work, anchor yourself and the patient, and deal with the cause: smoke, a leak, a loose tool." },
  { icon: "crewMedic", title: "Call the crew medic", text: "Every crew has members trained as Crew Medical Officers. Tell them and the commander at once." },
  { icon: "clipboard", title: "Follow the procedure", text: "Use the onboard medical checklists and the VITALS first-aid steps, one step at a time." },
  { icon: "heartPulse", title: "Measure and note", text: "Heart rate, SpO2, what happened and when. Times matter: the doctor will read them much later." },
  { icon: "report", title: "Send the report", text: "Send one clear report with a clear question. Don't wait for the answer to keep caring for the patient." },
  { icon: "timeline", title: "Keep watching", text: "Check again every few minutes. Things change long before the reply from Earth arrives." },
];

const KIT: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "medKit", title: "Medical kit", text: "Medicines, bandages, splints and tools for the everyday: headaches, cuts, sleep and space sickness." },
  { icon: "defib", title: "Defibrillator", text: "A heart-restarting AED, with a life-support pack for the worst emergencies." },
  { icon: "ecg", title: "Ultrasound", text: "Crews learn to scan each other while a doctor on Earth guides them and reads the images." },
  { icon: "lockDoor", title: "Patient restraint", text: "A board with straps to hold a patient still, because CPR is impossible on someone floating away." },
];

const REPORT: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "people", title: "Who", text: "The crew member, and who is caring for them." },
  { icon: "timeline", title: "What changed, and when", text: "The first sign, the time it started, and how it has moved since." },
  { icon: "heartPulse", title: "The readings", text: "Heart rate, SpO2, room temperature and humidity, with their trend." },
  { icon: "check", title: "What you've done", text: "Every step taken, and what happened after it." },
  { icon: "chat", title: "One clear question", text: "What you need from the doctor, so the answer is useful the moment it lands." },
];

function SectionTitle({ id, icon, eyebrow, title, lead }: { id: string; icon: GlyphName; eyebrow: string; title: string; lead?: ReactNode }) {
  return (
    <div id={id} className="mb-8 scroll-mt-8">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-emerald-300/90">{eyebrow}</p>
      <h2 className="flex items-center gap-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        <GlyphTile name={icon} tone="emerald" size="lg" /> {title}
      </h2>
      {lead && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">{lead}</p>}
    </div>
  );
}

export default function OfflinePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const nav: [string, string, GlyphName][] = [
    ["of-delay", "The delay", "delay"],
    ["of-far", "Help is far", "mars"],
    ["of-works", "Works offline", "noSignal"],
    ["of-steps", "When it goes wrong", "warning"],
    ["of-kit", "On board", "medKit"],
    ["of-report", "The report", "report"],
  ];

  return (
    <Shell
      eyebrow="Offline support"
      title="When Earth can't answer in time."
      intro="Far from home, the signal is slow, sometimes gone, and the nearest hospital is months away. The crew has to manage on its own, and VITALS is built to work with no signal at all."
      back={{ label: "Back to VITALS" }}
    >
      <nav aria-label="Topics" className="-mt-4 mb-14 flex flex-wrap gap-2">
        {nav.map(([id, label, icon]) => (
          <a
            key={id}
            href="#/offline"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:border-emerald-300/60 hover:text-white"
          >
            <Glyph name={icon} className="h-4 w-4 text-emerald-300" /> {label}
          </a>
        ))}
      </nav>

      {/* ---------- headline numbers ---------- */}
      <div className="mb-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.big} className="rounded-3xl border border-emerald-300/15 bg-gradient-to-br from-emerald-400/[0.1] via-transparent to-transparent p-6">
            <GlyphTile name={s.icon} tone="emerald" />
            <p className="mt-5 text-4xl font-bold tracking-tight text-white">{s.big}</p>
            <p className="mt-1.5 text-sm leading-snug text-white/60">{s.small}</p>
          </div>
        ))}
      </div>

      <div className="space-y-28">
        {/* ---------- the delay ---------- */}
        <section>
          <SectionTitle
            id="of-delay"
            icon="delay"
            eyebrow="The delay"
            title="A question to Earth, from Mars."
            lead="Radio travels at the speed of light, and that's still slow across the solar system. At the worst distance, one question and one answer take almost an hour."
          />
          <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CONVERSATION.map((c, i) => (
              <li key={c.t} className="relative rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-6">
                <span className="absolute right-5 top-4 font-mono text-sm text-emerald-300/80">{c.t}</span>
                <GlyphTile name={c.icon} tone={i === CONVERSATION.length - 1 ? "amber" : "emerald"} />
                <p className="mt-5 text-lg font-semibold">{c.title}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/65">{c.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center gap-5 rounded-3xl border border-amber-300/20 bg-gradient-to-r from-amber-400/[0.08] to-transparent p-6">
            <GlyphTile name="conjunction" tone="amber" size="lg" />
            <div>
              <p className="text-lg font-semibold">And sometimes, nothing at all.</p>
              <p className="mt-1 text-[15px] leading-relaxed text-white/65">
                About every 26 months the Sun passes between Earth and Mars. Its radio noise drowns out the signal, and missions stop sending
                commands for around two weeks. A crew there would be truly on its own.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- help is far ---------- */}
        <section>
          <SectionTitle id="of-far" icon="mars" eyebrow="How far is help?" title="The further out, the more alone." />
          <div className="grid gap-4 md:grid-cols-3">
            {DISTANCE.map((d, i) => (
              <div key={d.where} className="rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-7">
                <div className="flex items-start justify-between gap-3">
                  <GlyphTile name={d.icon} tone={i === 2 ? "red" : i === 1 ? "amber" : "emerald"} size="lg" />
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/70">Help in {d.help.toLowerCase()}</span>
                </div>
                <p className="mt-5 text-2xl font-semibold">{d.where}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-white/65">{d.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- what works offline ---------- */}
        <section>
          <SectionTitle
            id="of-works"
            icon="noSignal"
            eyebrow="No signal needed"
            title="What VITALS does on its own."
            lead="Everything that matters in an emergency runs on the device in front of you. The internet is a bonus, never a requirement."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKS.map((w) => (
              <a
                key={w.title}
                href={w.href}
                className="group flex flex-col rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-7 transition-colors hover:border-emerald-300/40"
              >
                <GlyphTile name={w.icon} tone="emerald" size="lg" />
                <p className="mt-5 text-xl font-semibold">{w.title}</p>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-white/65">{w.text}</p>
                <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  {w.cta} <Glyph name="play" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* ---------- when it goes wrong ---------- */}
        <section>
          <SectionTitle
            id="of-steps"
            icon="warning"
            eyebrow="When something goes wrong"
            title="Six steps, no signal required."
            lead="Spaceflight medicine works this way already: the crew acts first, and the doctor on Earth advises when the message gets through."
          />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-6">
                <span className="absolute right-5 top-4 font-mono text-sm text-white/30">0{i + 1}</span>
                <GlyphTile name={s.icon} tone={i === 0 ? "red" : "emerald"} />
                <p className="mt-5 text-lg font-semibold">{s.title}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/65">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- on board ---------- */}
        <section>
          <SectionTitle id="of-kit" icon="medKit" eyebrow="On board today" title="A tiny hospital, run by the crew." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KIT.map((k) => (
              <div key={k.title} className="rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-6">
                <GlyphTile name={k.icon} tone="emerald" />
                <p className="mt-5 text-lg font-semibold">{k.title}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/65">{k.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-3xl border border-rose-300/20 bg-gradient-to-br from-rose-400/[0.08] via-transparent to-transparent p-7">
            <div className="flex items-start gap-5">
              <GlyphTile name="clot" tone="red" size="lg" />
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-rose-300/90">A real case, 2020</p>
                <p className="mt-2 text-2xl font-semibold">A blood clot, found in orbit.</p>
                <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-white/65">
                  During a research scan on the space station, an ultrasound found a blood clot in an astronaut's neck vein. With no hospital
                  in reach, doctors on Earth guided the treatment remotely for months, and more medicine was sent up on a supply ship. The
                  astronaut landed safely. It's exactly the kind of problem a crew on the way to Mars would have to handle with no supply ship
                  coming.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- the report ---------- */}
        <section>
          <SectionTitle
            id="of-report"
            icon="report"
            eyebrow="The flight surgeon report"
            title="Written to survive the delay."
            lead="When every answer takes an hour, there's no time for follow-up questions. A good report gives the doctor everything in one go."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {REPORT.map((r) => (
              <div key={r.title} className="rounded-3xl border border-white/10 bg-[#0b0d14]/95 p-6">
                <GlyphTile name={r.icon} tone="emerald" size="sm" />
                <p className="mt-4 font-semibold">{r.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/60">{r.text}</p>
              </div>
            ))}
          </div>
          <a
            href="#/live"
            className="mt-4 flex items-center gap-5 rounded-3xl border border-emerald-300/20 bg-gradient-to-r from-emerald-400/[0.1] to-transparent p-6 transition-colors hover:border-emerald-300/50"
          >
            <GlyphTile name="heartPulse" tone="emerald" size="lg" />
            <div className="flex-1">
              <p className="text-lg font-semibold">VITALS keeps the numbers for you.</p>
              <p className="mt-1 text-[15px] leading-relaxed text-white/65">
                Heart rate, SpO2, room temperature and humidity, with the time of every reading: the facts a report needs, recorded as they happen.
              </p>
            </div>
            <Glyph name="play" className="hidden h-6 w-6 text-emerald-300 sm:block" />
          </a>
        </section>
      </div>

      <div className="mt-24 border-t border-white/10 pt-6 text-sm text-white/50">
        <p>Written by team Mission 61:4 from public space agency material. General information, not medical advice.</p>
      </div>
    </Shell>
  );
}
