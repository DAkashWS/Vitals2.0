import { useEffect, useRef, useState } from "react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import PerspectiveTunnelHero from "@/components/ui/perspective-tunnel-hero";
import ScrollExpandMedia from "@/components/ui/scroll-expansion-hero";
import { HoloCard, type HoloCardHandle } from "@/components/ui/holo-card";
import { media } from "@/media";
import { missionSteps, modules, readings, team, unique } from "@/content";
import { crewIdFor, deleteCard, describe, getMyReadings, listCrew, putCard, teamCards, type CrewCard, type MyReadings } from "@/lib/crewDb";
import { RainbowButton } from "@/components/ui/rainbow-button";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 font-mono text-xs uppercase tracking-[0.35em] text-sky-300">{children}</p>;
}

export function Modules() {
  return (
    <PerspectiveTunnelHero
      id="modules"
      items={modules.map((m, i) => ({ ...m, src: media.tunnel[i % media.tunnel.length] }))}
      eyebrow="Five modules · three space risks · space medicine"
      title={
        <>
          INSIDE
          <br />
          VITALS.
        </>
      }
      subtitle="Scroll to fly through. Cards that glow open up."
      prompt="Scroll to fly in"
    />
  );
}

/** Red is everything outside the yellow range (SpO2 can't go above 100, so only its low side). */
function redRange(r: (typeof readings)[number]) {
  const [lo, hi] = r.yellow.split(/[–-]/);
  return hi === "100" ? `<${lo}` : `<${lo} or >${hi}`;
}

export function Readings() {
  return (
    <section id="readings" className="relative px-6 py-28 sm:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Health readings and alerts</Eyebrow>
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-[18ch] text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Green, yellow or red. Every reading, every time.
          </h2>
          <div className="flex flex-wrap gap-4 text-sm text-white/70">
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-ok" />Normal range</span>
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-watch" />Watch range</span>
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-act" />Outside both</span>
          </div>
        </div>
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-[#ffffff]/95">
          {readings.map((r) => (
            <li key={r.key} className="grid items-center gap-4 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2.6fr)] md:gap-8">
              <h3 className="text-base font-semibold">
                {r.name} <span className="ml-1 font-mono text-xs font-normal text-white/45">{r.unit}</span>
              </h3>
              <dl className="grid grid-cols-3 gap-2.5 text-sm sm:gap-3">
                {(
                  [
                    ["Green", r.green, "border-ok/25 bg-ok/[0.07] text-ok/90"],
                    ["Yellow", r.yellow, "border-watch/25 bg-watch/[0.07] text-watch/90"],
                    ["Red", redRange(r), "border-act/30 bg-act/[0.08] text-act/90"],
                  ] as const
                ).map(([label, value, tone]) => (
                  <div key={label} className={`rounded-lg border px-3 py-2 ${tone}`}>
                    <dt className="text-[11px] uppercase tracking-wider">{label}</dt>
                    <dd className="mt-0.5 font-mono tabular-nums text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Mission() {
  return (
    <ScrollExpandMedia
      id="mission"
      mediaType={media.missionType === "video" && media.missionVideo ? "video" : "image"}
      mediaSrc={media.missionType === "video" && media.missionVideo ? media.missionVideo : media.missionImage}
      posterSrc={media.missionPoster}
      bgImageSrc={media.missionBackground}
      title="Mission 61:4"
      date="200 million km out"
      scrollToExpand="Scroll to expand"
      textBlend
    >
      <div className="mx-auto w-full max-w-5xl">
        <Eyebrow>The demo story</Eyebrow>
        <h2 className="mb-12 max-w-[22ch] text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          One quiet morning: readings drift, an alert fires, the report explains, the crew acts.
        </h2>
        <ol className="grid gap-4 md:grid-cols-4">
          {missionSteps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-white/10 bg-[#ffffff]/90 p-6">
              <div className="mb-4 flex items-center justify-between font-mono text-xs text-white/45">
                <span>0{i + 1}</span>
                <span>{s.t}</span>
              </div>
              <h3 className="mb-2 text-lg font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-white/65">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </ScrollExpandMedia>
  );
}

function CrewSlot({ card, onRemove, onUpdate }: { card: CrewCard; onRemove?: () => void; onUpdate?: () => void }) {
  const ref = useRef<HoloCardHandle>(null);
  const [shown, setShown] = useState(false);
  const d = describe(card);
  return (
    <div className="flex w-full max-w-[380px] flex-col items-center gap-5">
      <HoloCard
        ref={ref}
        name={card.name}
        role={card.role}
        crewId={card.crewId}
        mission="61:4"
        status={d.status}
        statusNote={d.statusNote}
        baselines={d.baselines}
        backTitle={card.kind === "self" ? "Your readings" : "Latest readings"}
        onReveal={setShown}
        className="w-full"
      />
      <div className="flex gap-2">
        <LiquidButton size="sm"
          type="button"
          onClick={() => ref.current?.flip()}
          className="h-8 rounded-full bg-primary/25 px-4 text-[13px] font-semibold text-white transition-transform active:scale-[.97]"
        >
          Readings
        </LiquidButton>
        <LiquidButton size="sm"
          type="button"
          onClick={() => ref.current?.reveal()}
          className="h-8 rounded-full border border-white/15 px-4 text-[13px] font-medium text-white/80 transition-transform active:scale-[.97]"
        >
          {shown ? "Hide ID" : "Show ID"}
        </LiquidButton>
        {onUpdate && (
          <LiquidButton size="sm" type="button" onClick={onUpdate} className="h-8 rounded-full bg-primary/25 px-4 text-[13px] font-semibold text-white" title="Your newer readings from the Live monitor">
            Update
          </LiquidButton>
        )}
        {onRemove && (
          <LiquidButton size="sm" type="button" onClick={onRemove} className="h-8 rounded-full px-4 text-[13px] font-medium text-rose-200/90">
            Remove
          </LiquidButton>
        )}
      </div>
    </div>
  );
}

/** The last slot: adds your own card, built from the readings the Live monitor saved. */
function AddCardSlot({ mine, hasCard, onAdd }: { mine: MyReadings | null | undefined; hasCard: boolean; onAdd: (m: MyReadings) => void }) {
  const count = mine ? Object.values(mine.readings).filter((v) => v != null).length : 0;
  return (
    <div className="flex w-full max-w-[380px] flex-col items-center gap-5">
      <div className="flex aspect-[1.586] w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-white/25 bg-white/[0.03] p-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-white/20 text-2xl font-light text-white/80" aria-hidden="true">
          +
        </span>
        {mine === undefined ? (
          <p className="text-sm text-white/50">Checking for your readings…</p>
        ) : mine && count ? (
          <>
            <p className="text-base font-semibold text-white">{hasCard ? "Update your card" : "Add your own card"}</p>
            <p className="max-w-[30ch] text-sm leading-relaxed text-white/60">
              {mine.name}, {count} reading{count === 1 ? "" : "s"} from {mine.source}, {new Date(mine.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-white">Add your own card</p>
            <p className="max-w-[30ch] text-sm leading-relaxed text-white/60">Your card uses your real readings. Pair a sensor on the Live monitor first, then come back here.</p>
          </>
        )}
      </div>
      {mine && count ? (
        <RainbowButton onClick={() => onAdd(mine)} className="h-9 px-6 text-[13px]">
          {hasCard ? "Update card" : "Add card"}
        </RainbowButton>
      ) : (
        <RainbowButton onClick={() => (window.location.hash = "#/live")} className="h-9 px-6 text-[13px]">
          Take my readings
        </RainbowButton>
      )}
    </div>
  );
}

export function Crew() {
  const [cards, setCards] = useState<CrewCard[]>(teamCards);
  const [mine, setMine] = useState<MyReadings | null | undefined>(undefined);
  const [dbError, setDbError] = useState(false);

  const load = () =>
    Promise.all([listCrew(), getMyReadings()])
      .then(([all, m]) => {
        setCards(all);
        setMine(m ?? null);
      })
      .catch(() => {
        setDbError(true);
        setMine(null);
      });

  useEffect(() => {
    load();
    // readings saved on the Live monitor in another tab show up when you come back
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const self = cards.find((c) => c.kind === "self");
  const add = async (m: MyReadings) => {
    await putCard({ id: "self", name: m.name, role: "Student", crewId: crewIdFor(m.name), readings: m.readings, kind: "self", source: m.source, updatedAt: Date.now() });
    load();
  };
  const remove = async () => {
    await deleteCard("self");
    load();
  };

  return (
    <section id="crew" className="relative px-6 py-28 sm:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Student health</Eyebrow>
        <h2 className="mb-4 max-w-[20ch] text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Every student, one glance at a time.
        </h2>
        <p className="mb-14 max-w-[58ch] text-white/65">
          Each student's latest readings. Tilt, spin or tap a card, or press Readings to see them. Status is worked out from the
          ranges above. Add your own card from your readings on the Live monitor.
        </p>
        <div className="grid justify-items-center gap-14 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <CrewSlot
              key={c.id}
              card={c}
              onRemove={c.kind === "self" ? remove : undefined}
              onUpdate={c.kind === "self" && mine && mine.at > c.updatedAt ? () => add(mine) : undefined}
            />
          ))}
          {!dbError && !self && <AddCardSlot mine={mine} hasCard={false} onAdd={add} />}
        </div>
        {dbError && <p className="mt-10 text-sm text-white/50">This browser blocks local storage, so cards can't be saved here. The team's cards are shown from the site.</p>}
      </div>
    </section>
  );
}

export function Unique() {
  return (
    <section className="relative px-6 py-28 sm:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>What makes VITALS unique</Eyebrow>
        <h2 className="mb-14 max-w-[24ch] text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          A smartwatch measures. VITALS explains.
        </h2>
        <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
          {unique.map((u, i) => (
            <div key={u.title} className="border-t border-white/15 pt-5">
              <h3 className="text-base font-semibold">
                <span className="mr-2 font-mono text-xs text-sky-300">{String(i + 1).padStart(2, "0")}</span>
                {u.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{u.body}</p>
            </div>
          ))}
        </div>
        <blockquote className="mt-24 max-w-4xl text-balance text-2xl font-medium leading-snug tracking-tight text-white/90 sm:text-4xl">
          “A smartwatch tells you your heart rate. VITALS tells an astronaut, 200 million kilometres from a doctor, what
          it means and what to do next.”
        </blockquote>
      </div>
    </section>
  );
}

export function Team() {
  return (
    <section id="team" className="relative px-6 pb-16 pt-28 sm:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Credits</Eyebrow>
        <h2 className="mb-12 text-4xl font-semibold tracking-tight sm:text-5xl">Six people, one mission.</h2>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
          {team.map((t) => (
            <li key={t.name} className="bg-[#ffffff]/95 p-6">
              <p className="text-lg font-semibold">{t.name}</p>
              <p className="mt-1 text-sm text-white/55">{t.role}</p>
            </li>
          ))}
        </ul>
        <div className="mt-20 flex justify-end border-t border-white/10 pt-10">
          <LiquidButton size="xl" className="w-40 text-sm text-base font-semibold text-white" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Back to top
          </LiquidButton>
        </div>
      </div>
    </section>
  );
}
