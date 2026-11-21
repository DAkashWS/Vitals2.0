"use client";

import {
  motion,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useScroll,
  MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type TunnelItem = { src: string; title: string; caption?: string; href?: string; linkLabel?: string };

interface TunnelCardData {
  item: TunnelItem;
  angleCos: number;
  angleSin: number;
  radiusFactorX: number;
  radiusFactorY: number;
  rotationZ: number;
  index: number;
}

const toCards = (items: TunnelItem[]): TunnelCardData[] =>
  items.map((item, i) => {
    const goldenAngle = i * 137.5 * (Math.PI / 180);
    return {
      item,
      angleCos: Math.cos(goldenAngle),
      angleSin: Math.sin(goldenAngle),
      radiusFactorX: 0.28 + (i % 3) * 0.08,
      radiusFactorY: 0.26 + (i % 2) * 0.09,
      rotationZ: (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2),
      index: i,
    };
  });

const SPRING_CONFIG = { stiffness: 60, damping: 25, mass: 0.5 };

interface StageDimensions {
  width: number;
  height: number;
  isMobile: boolean;
}

function useCameraParallax(enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING_CONFIG);
  const y = useSpring(rawY, SPRING_CONFIG);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, rawX, rawY]);

  return { x, y };
}

interface TunnelCardProps {
  card: TunnelCardData;
  progress: MotionValue<number>;
  pointer: { x: MotionValue<number>; y: MotionValue<number> };
  total: number;
  stage: StageDimensions;
}

function TunnelCard({ card, progress, pointer, total, stage }: TunnelCardProps) {
  const staggerSpan = 0.55;
  const start = (card.index / total) * (1 - staggerSpan);
  const end = start + staggerSpan;

  const localProgress = useTransform(progress, [start, end], [0, 1]);

  const farZ = stage.isMobile ? -1200 : -1700;
  const nearZ = stage.isMobile ? 350 : 500;
  const z = useTransform(localProgress, [0, 1], [farZ, nearZ]);

  const opacity = useTransform(localProgress, [0, 0.18, 0.82, 0.98], [0, 1, 1, 0]);
  // A faded card is still hit-testable, and one flying past the camera is huge and nearest, so even
  // half-faded it swallowed clicks meant for the card seen through it. Only a fully opaque card takes clicks.
  const pointerEvents = useTransform(opacity, (o) => (o > 0.99 ? "auto" : "none"));

  const cardWidth = stage.isMobile
    ? Math.max(130, Math.min(180, stage.width * 0.38))
    : Math.max(180, Math.min(270, stage.width * 0.18));

  const baseX = card.angleCos * (stage.width * card.radiusFactorX);
  const baseY = card.angleSin * (stage.height * card.radiusFactorY);
  const panStrength = stage.isMobile ? 20 : 45;

  const transform = useTransform([z, pointer.x, pointer.y], ([currZ, px, py]: number[]) => {
    const offsetX = baseX - px * panStrength;
    const offsetY = baseY - py * panStrength;
    return `translate3d(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px), ${currZ}px) rotateZ(${card.rotationZ}deg)`;
  });

  // VITALS: a card with an href is a link (e.g. Crew health profile → the crew cards).
  const Inner = card.item.href ? "a" : "div";

  return (
    <motion.div
      style={{ width: cardWidth, transform, opacity, pointerEvents, zIndex: card.index + 1 }}
      className="absolute left-1/2 top-1/2 aspect-[4/5] will-change-transform select-none"
    >
      <Inner
        {...(card.item.href ? { href: card.item.href, "aria-label": `${card.item.title}: ${card.item.linkLabel ?? "open"}` } : {})}
        className={`group relative block h-full w-full overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl shadow-black/90 ring-1 ring-white/15 transition-all duration-500 hover:ring-sky-400/70 hover:shadow-sky-500/25 ${card.item.href ? "cursor-pointer" : ""}`}
      >
        <img
          src={card.item.src}
          alt=""
          draggable={false}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/85 via-black/20 to-transparent p-4 sm:p-5">
          <span className="font-mono text-xs uppercase tracking-widest text-white/95 drop-shadow-md sm:text-sm">
            {card.item.title}
          </span>
          {card.item.caption && (
            <span className="text-[11px] leading-snug text-white/70 sm:text-xs">{card.item.caption}</span>
          )}
          {card.item.href && card.item.linkLabel && (
            <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-sky-400/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#ffffff] transition-transform group-hover:translate-x-0.5 sm:text-[11px]">
              {card.item.linkLabel} →
            </span>
          )}
        </div>
      </Inner>
    </motion.div>
  );
}

export interface PerspectiveTunnelHeroProps {
  items: TunnelItem[];
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: string;
  prompt?: string;
  id?: string;
}

export default function PerspectiveTunnelHero({
  items,
  eyebrow = "Warp Drive Sequence",
  title = (
    <>
      INTO THE
      <br />
      ETHER.
    </>
  ),
  subtitle = "Scroll your trackpad or mouse wheel to fly through the spatial 3D corridor.",
  prompt = "Scroll to Explore",
  id,
}: PerspectiveTunnelHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const cards = toCards(items);

  const [stage, setStage] = useState<StageDimensions>({ width: 1440, height: 900, isMobile: false });

  useEffect(() => {
    const updateDimensions = () => {
      setStage({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768,
      });
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // VITALS change: the original captured the mouse wheel inside a 100vh box, which
  // trapped page scrolling and ignored touch. Here the tunnel is a tall section with
  // a sticky stage, and progress follows the page's own scroll (wheel, touch, keys).
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 30, restDelta: 0.0001 });

  const pointer = useCameraParallax(!reduce);

  const titleScale = useTransform(smoothProgress, [0, 0.5, 1], [0.7, 1, 1.35]);
  const titleOpacity = useTransform(smoothProgress, [0, 0.12, 0.85, 1], [0.25, 1, 1, 0]);
  const promptOpacity = useTransform(smoothProgress, [0, 0.12], [1, 0]);

  if (reduce) {
    // Reduced motion: a plain grid of the same cards.
    return (
      <section id={id} className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.4em] text-sky-400">{eyebrow}</p>
          <h2 className="mb-10 text-4xl font-bold tracking-tight">{title}</h2>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {items.map((it) => (
              <li key={it.title} className="overflow-hidden rounded-2xl ring-1 ring-white/15">
                <img src={it.src} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="p-4">
                  <p className="font-mono text-xs uppercase tracking-widest">{it.title}</p>
                  {it.caption && <p className="mt-1 text-sm text-white/70">{it.caption}</p>}
                  {it.href && (
                    <a href={it.href} className="mt-2 inline-block text-sm font-semibold text-sky-300 underline-offset-4 hover:underline">
                      {it.linkLabel ?? "Open"} →
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section id={id} ref={containerRef} className="relative h-[320vh] w-full">
    <div
      className="sticky top-0 flex h-[100svh] w-full select-none items-center justify-center overflow-hidden bg-neutral-950 text-white"
      style={{ perspective: stage.isMobile ? "900px" : "1200px", transformStyle: "preserve-3d" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] opacity-65 [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.10)_0%,transparent_75%)]" />

      <div className="pointer-events-none absolute h-[48vmin] w-[48vmin] rounded-full border border-sky-400/10" />
      <div className="pointer-events-none absolute h-[76vmin] w-[76vmin] rounded-full border border-dashed border-white/10" />

      <motion.div
        style={{ scale: titleScale, opacity: titleOpacity }}
        className="pointer-events-none z-0 flex max-w-xl flex-col items-center px-6 text-center"
      >
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.4em] text-sky-400">{eyebrow}</p>
        <h2 className="bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-5xl font-bold leading-[0.9] tracking-tighter text-transparent sm:text-7xl md:text-8xl">
          {title}
        </h2>
        <p className="mt-4 max-w-[36ch] text-sm font-light text-neutral-400 sm:text-base">{subtitle}</p>
      </motion.div>

      <motion.div
        style={{ opacity: promptOpacity }}
        className="pointer-events-none absolute bottom-8 z-20 flex flex-col items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-neutral-400"
      >
        <span>{prompt}</span>
        <div className="h-6 w-px bg-gradient-to-b from-sky-500 to-transparent" />
      </motion.div>

      <div className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
        {cards.map((card) => (
          <TunnelCard
            key={card.index}
            card={card}
            progress={smoothProgress}
            pointer={pointer}
            total={cards.length}
            stage={stage}
          />
        ))}
      </div>
    </div>
    </section>
  );
}
