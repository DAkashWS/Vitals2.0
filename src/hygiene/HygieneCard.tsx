import { useRef, type PointerEvent } from "react";
import type { Cabin, Result, Status } from "@/hygiene/model";

const RING: Record<Status, string> = { NORMAL: "#059669", WATCH: "#d97706", ACT: "#dc2626" };

/**
 * The hygiene vital card: your name, your cabin and today's hygiene score out of 100,
 * scaled to your cabin. Set in Jost. Tilts a little towards the pointer.
 */
export default function HygieneCard({ name, cabin, result }: { name: string; cabin: Cabin; result: Result }) {
  const ref = useRef<HTMLDivElement>(null);
  const r = 46;
  const circ = 2 * Math.PI * r;
  const color = RING[result.status];
  const date = new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5;
    const y = (e.clientY - b.top) / b.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onPointerMove={tilt}
      onPointerLeave={reset}
      className="relative aspect-[1.586/1] w-full overflow-hidden rounded-[22px] border border-white/15 font-display text-white shadow-2xl shadow-black/60 transition-transform duration-200 ease-out"
      style={{
        background:
          "radial-gradient(120% 90% at 100% 0%, rgba(5,150,105,.16), transparent 55%), radial-gradient(90% 80% at 0% 100%, rgba(220,38,38,.10), transparent 60%), linear-gradient(160deg, #ffffff 0%, #fff5f5 55%, #ffecec 100%)",
      }}
      role="img"
      aria-label={`Hygiene card for ${name}, ${cabin.name}. Hygiene score ${result.score} out of 100, ${result.grade}.`}
    >
      {/* fine grid, like a mission chart */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(#b91c1c 1px, transparent 1px), linear-gradient(90deg, #b91c1c 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        aria-hidden="true"
      />

      <div className="relative flex h-full flex-col justify-between p-[6%]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[clamp(11px,2.6vw,14px)] font-semibold uppercase tracking-[0.28em] text-white/85">
            Vitals <span className="text-emerald-300">·</span> Hygiene
          </p>
          <p className="text-right text-[clamp(10px,2.2vw,12px)] uppercase tracking-[0.2em] text-white/55">
            Mission
            <span className="block text-[clamp(13px,3vw,16px)] font-semibold tracking-normal text-white">61:4</span>
          </p>
        </div>

        <div className="flex items-center gap-[6%]">
          <svg viewBox="0 0 110 110" className="w-[34%] shrink-0 -rotate-90" aria-hidden="true">
            <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(48,16,22,.10)" strokeWidth="9" />
            <circle
              cx="55"
              cy="55"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - result.score / 100)}
              style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1), stroke 300ms" }}
            />
            <text x="55" y="55" transform="rotate(90 55 55)" textAnchor="middle" dominantBaseline="central" fill="#301016" fontFamily="Jost, sans-serif" fontWeight="600" fontSize="34">
              {result.score}
            </text>
          </svg>
          <div className="min-w-0">
            <p className="text-[clamp(10px,2.2vw,12px)] uppercase tracking-[0.22em] text-white/55">Hygiene score</p>
            <p className="mt-0.5 text-[clamp(18px,4.6vw,26px)] font-semibold leading-tight" style={{ color }}>
              {result.grade}
            </p>
            <p className="mt-1 text-[clamp(11px,2.4vw,13px)] text-white/60">
              {result.onTrack} of {result.total} on track · scaled to your cabin
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[clamp(9px,2vw,11px)] uppercase tracking-[0.22em] text-white/45">Crew member</p>
            <p className="truncate text-[clamp(15px,3.6vw,20px)] font-semibold tracking-wide">{name}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="truncate text-[clamp(11px,2.4vw,13px)] font-medium text-white/80">{cabin.name}</p>
            <p className="text-[clamp(10px,2.2vw,12px)] text-white/50">
              {cabin.crew} crew · {cabin.humidity}% RH · air +{cabin.airQuality}% · {date}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
