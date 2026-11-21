"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

/*
 * ScrollExpandMedia, adapted for VITALS.
 * - next/image is replaced with plain <img> (this site is Vite, not Next.js).
 * - The original hijacked every wheel and touch event on the window and forced
 *   window.scrollTo(0, 0) until the media had expanded, so it only worked as the
 *   very first thing on a page. Here it is a tall section with a sticky stage and
 *   the page's own scroll drives the expansion, so it can sit anywhere.
 */

interface ScrollExpandMediaProps {
  mediaType?: "video" | "image";
  mediaSrc: string;
  posterSrc?: string;
  bgImageSrc: string;
  title?: string;
  date?: string;
  scrollToExpand?: string;
  textBlend?: boolean;
  children?: ReactNode;
  id?: string;
}

const ScrollExpandMedia = ({
  mediaType = "video",
  mediaSrc,
  posterSrc,
  bgImageSrc,
  title,
  date,
  scrollToExpand,
  textBlend,
  children,
  id,
}: ScrollExpandMediaProps) => {
  const [isMobile, setIsMobile] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end end"] });
  const p = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0, 1]);

  const width = useTransform(p, (v) => `${300 + v * (isMobile ? 650 : 1250)}px`);
  const height = useTransform(p, (v) => `${400 + v * (isMobile ? 200 : 400)}px`);
  const left = useTransform(p, (v) => `translateX(-${v * (isMobile ? 180 : 150)}vw)`);
  const right = useTransform(p, (v) => `translateX(${v * (isMobile ? 180 : 150)}vw)`);
  const bgOpacity = useTransform(p, (v) => 1 - v);
  const veil = useTransform(p, (v) => (mediaType === "image" ? 0.7 - v * 0.3 : 0.5 - v * 0.3));

  const firstWord = title ? title.split(" ")[0] : "";
  const restOfTitle = title ? title.split(" ").slice(1).join(" ") : "";

  return (
    <section id={id} className="relative">
      <div ref={trackRef} className="relative h-[260vh]">
        <div className="sticky top-0 flex h-[100dvh] w-full items-center justify-center overflow-hidden">
          <motion.div className="absolute inset-0 z-0" style={{ opacity: bgOpacity }}>
            <img src={bgImageSrc} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
          </motion.div>

          <motion.div
            className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-2xl"
            style={{ width, height, maxWidth: "95vw", maxHeight: "85vh", boxShadow: "0px 0px 50px rgba(0, 0, 0, 0.3)" }}
          >
            {mediaType === "video" ? (
              <video
                src={mediaSrc}
                poster={posterSrc}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                className="h-full w-full rounded-xl object-cover"
                disablePictureInPicture
              />
            ) : (
              <img src={mediaSrc} alt={title || "Media content"} className="h-full w-full rounded-xl object-cover" />
            )}
            <motion.div className="absolute inset-0 rounded-xl bg-black/50" style={{ opacity: veil }} />

            <div className="relative z-10 mt-4 flex flex-col items-center text-center">
              {date && (
                <motion.p className="text-2xl text-sky-200" style={{ transform: left }}>
                  {date}
                </motion.p>
              )}
              {scrollToExpand && (
                <motion.p className="text-center font-medium text-sky-200" style={{ transform: right }}>
                  {scrollToExpand}
                </motion.p>
              )}
            </div>
          </motion.div>

          <div
            className={`relative z-10 flex w-full flex-col items-center justify-center gap-4 text-center ${
              textBlend ? "mix-blend-difference" : "mix-blend-normal"
            }`}
          >
            <motion.h2 className="text-4xl font-bold text-sky-100 md:text-5xl lg:text-6xl" style={{ transform: left }}>
              {firstWord}
            </motion.h2>
            <motion.h2 className="text-4xl font-bold text-sky-100 md:text-5xl lg:text-6xl" style={{ transform: right }}>
              {restOfTitle}
            </motion.h2>
          </div>
        </div>
      </div>

      <motion.div
        className="relative z-10 flex w-full flex-col px-6 py-16 md:px-16 lg:py-24"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7 }}
      >
        {children}
      </motion.div>
    </section>
  );
};

export default ScrollExpandMedia;
