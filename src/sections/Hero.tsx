import { useEffect, useState } from "react";
import GlyphPortal from "@/components/ui/glyph-portal";
import { media } from "@/media";
import { useAuth } from "@/lib/auth";
import { ShinyButton } from "@/components/ui/shiny-button";
import { RainbowButton } from "@/components/ui/rainbow-button";

/** Top-right of the home page: "Sign in", or your first name once you're signed in. */
function AccountLink() {
  const { enabled, profile, session } = useAuth();
  if (!enabled) return null;
  const label = session ? (profile?.display_name?.split(" ")[0] || "Account") : "Sign in";
  return (
    <a href="#/account" className="pointer-events-auto rounded-full border border-white/20 bg-white/[0.06] px-4 py-1.5 text-sm text-white/85 transition-colors hover:border-white/40 hover:text-white">
      {label}
    </a>
  );
}

const FACE = '"Inter", "Arial Black", Arial, sans-serif';

// The portal measures the letters once when it mounts, so wait for Inter to load
// first (or give up after 1.6 s and use the fallback face, e.g. when offline).
function useFace() {
  const [face, setFace] = useState<string | null>(null);
  useEffect(() => {
    let done = false;
    const finish = (v: string) => {
      if (!done) {
        done = true;
        setFace(v);
      }
    };
    const timer = window.setTimeout(() => finish('"Arial Black", Arial, sans-serif'), 1600);
    document.fonts
      .load('800 100px "Inter"', "VITALS")
      .then((f) => finish(f.length ? FACE : '"Arial Black", Arial, sans-serif'))
      .catch(() => finish('"Arial Black", Arial, sans-serif'));
    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, []);
  return face;
}

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

export default function Hero() {
  const face = useFace();

  if (!face) return <div className="h-[100svh]" aria-hidden="true" />;

  return (
    <GlyphPortal
      word="VITALS"
      fontFamily={face}
      fontWeight={800}
      scrollLength={2.2}
      enterLabel="Enter the mission"
      className="vitals-portal"
      style={{
        "--gp-paper": "transparent",
        "--gp-ink": "#301016",
        "--gp-field": "#fffbfb",
        "--gp-foreground": "#301016",
        fontFamily: face,
      }}
      background={
        <div className="absolute inset-0" style={{ transform: "scale(var(--gp-field-scale,1))" }}>
          <img src={media.heroField} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
          {/* Darkens as the portal opens, so the intro text stays readable over the clouds. */}
          <div className="vitals-scrim absolute inset-0 bg-[#fffbfb]/70 opacity-0 transition-opacity duration-500" />
        </div>
      }
      front={
        <>
          <style>{`
            .vitals-portal [data-gp-caption]{inset:calc(var(--gp-word-bottom,50%) + 92px) 24px auto;justify-content:center;}
            .vitals-portal [data-gp-hint]{display:none;}
            .vitals-portal [data-gp-enter]{min-height:46px;padding:0 22px;gap:22px;border:1px solid hsl(var(--border));border-radius:999px;background:rgba(48,16,22,.04);color:#301016;font-size:13px;font-weight:600;transition:background .18s,border-color .18s;}
            .vitals-portal [data-gp-enter]:hover{background:hsl(var(--primary)/.18);border-color:hsl(var(--primary)/.7);}
            .vitals-portal [data-gp-touch-picker]{top:auto;bottom:18px;}
            .vitals-portal [data-gp-select]{background:#ffffff;color:#5a2a32;border-color:hsl(var(--border));}
            .vitals-portal [data-gp-content]{padding:6rem clamp(1.25rem,6vw,6rem);}
            .vitals-portal[data-gp-entered=true] .vitals-scrim{opacity:1;}
          `}</style>
          <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 px-6 py-6 sm:px-12">
            <span className="text-lg font-bold tracking-tight">
              VITALS<span className="text-primary">.</span>
            </span>
            <nav className="hidden gap-7 text-sm text-white/65 md:flex">
              {[
                ["modules", "Modules"],
                ["readings", "Readings"],
                ["assistant", "Assistant"],
                ["/live", "Live monitor"],
                ["/hygiene", "Hygiene"],
                ["mission", "Mission 61:4"],
                ["crew", "Crew"],
                ["team", "Team"],
                ["/crew-link", "Crew Link"],
              ].map(([id, label]) => (
                <a key={id} href={`#${id}`} className="pointer-events-auto transition-colors hover:text-white">
                  {label}
                </a>
              ))}
            </nav>
            <span className="flex items-center gap-4">
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-white/50 sm:inline">Space Apps 2026</span>
              <AccountLink />
            </span>
          </header>
          <p className="absolute inset-x-6 bottom-[calc(100%-var(--gp-word-top,35%)+28px)] m-0 text-center font-mono text-xs uppercase tracking-[0.35em] text-sky-300/80">
            Crew health monitor · offline
          </p>
          <p className="absolute inset-x-6 top-[calc(var(--gp-word-bottom,50%)+28px)] m-0 text-center text-base text-white/70 sm:text-lg">
            Catch the warning signs early. Act before Earth can even reply.
          </p>
        </>
      }
    >
      <div className="mx-auto grid w-full max-w-6xl gap-12 md:grid-cols-[1.1fr_1fr] md:items-end">
        <div>
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.35em] text-sky-300">The challenge</p>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Space slowly reshapes the body. Nobody else is close enough to notice.
          </h1>
          <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-white/70">
            Radiation, bone loss, a strained heart and mind, CO2 you can't feel. Months from home, the crew has to catch
            it all themselves.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-sky-300">Our answer</p>
          <p className="text-lg leading-relaxed text-white/85">
            VITALS watches body and cabin together, spots what no single reading shows, and tells the crew what to do
            next. No signal from Earth needed.
          </p>
          <p className="mt-4 text-sm text-white/55">VITALS guides the crew's decisions. It never diagnoses.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ShinyButton className="h-12 w-44" onClick={() => go("modules")}>
              See modules
            </ShinyButton>
            <RainbowButton className="h-12 w-44 text-base" onClick={() => go("mission")}>
              Mission 61:4
            </RainbowButton>
          </div>
        </div>
      </div>
    </GlyphPortal>
  );
}
