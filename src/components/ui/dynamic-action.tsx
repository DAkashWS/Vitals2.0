/*
 * Dynamic action bar (from 21st.dev), restyled as VITALS liquid glass.
 * A small bar of buttons that springs open into a panel for the one you point at.
 * Changes from the original:
 *   - the panel's height comes from its content (measured), not a fixed number, so nothing is clipped
 *   - phones: tap a button to open it, tap anywhere outside to close (there is no hover)
 *   - keyboard: focusing a button opens its panel, Escape closes it
 *   - never wider than the screen
 */
import * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { cn } from "@/lib/utils";

export interface ActionItem {
  id: string;
  label: string;
  icon: React.ElementType;
  /** gets close() so a link inside can shut the panel */
  content: React.ReactNode | ((close: () => void) => React.ReactNode);
  /** panel width in px (clamped to the screen) */
  width: number;
}

export interface DynamicActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  actions: ActionItem[];
  /** width of the closed bar, px */
  barWidth?: number;
}

const BAR_HEIGHT = 56;
const SPRING = { type: "spring", stiffness: 400, damping: 35 } as const;

const DynamicActionBar = React.forwardRef<HTMLDivElement, DynamicActionBarProps>(({ actions, barWidth = 360, className, ...props }, ref) => {
  const [active, setActive] = useState<number | null>(null);
  const [contentH, setContentH] = useState(0);
  const [screenW, setScreenW] = useState(() => window.innerWidth);
  const contentRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const action = active !== null ? actions[active] : null;
  const close = () => setActive(null);

  const fit = (w: number) => Math.min(w, screenW - 24);

  // measure the open panel, and keep measuring while its content changes
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return setContentH(0);
    setContentH(el.scrollHeight);
    const ro = new ResizeObserver(() => setContentH(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);

  useEffect(() => {
    const onResize = () => setScreenW(window.innerWidth);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setActive(null);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      className={cn("relative", className)}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") close();
      }}
      {...props}
    >
      <motion.div
        className="flex flex-col overflow-hidden rounded-[28px] border border-white/15 bg-[#0b0d14]/70 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl backdrop-saturate-150"
        initial={false}
        animate={{ width: fit(action ? action.width : barWidth), height: (action ? contentH : 0) + BAR_HEIGHT }}
        transition={SPRING}
      >
        <div className="relative min-h-0 flex-grow overflow-hidden">
          <AnimatePresence initial={false}>
            {action && (
              <motion.div
                key={action.id}
                className="w-full"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                // the old panel leaves the layout while it fades, so the new one takes its place at once
                exit={{ opacity: 0, position: "absolute", top: 0, left: 0, right: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.2, delay: 0.08 }}
              >
                {/* measured here (a plain div: AnimatePresence can swap a motion element's ref) */}
                <div ref={contentRef}>{typeof action.content === "function" ? action.content(close) : action.content}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div role="toolbar" className="flex flex-shrink-0 items-center justify-center gap-1.5 px-2" style={{ height: BAR_HEIGHT }}>
          {actions.map((a, i) => {
            const Icon = a.icon;
            const on = active === i;
            return (
              <LiquidButton
                key={a.id}
                type="button"
                size="sm"
                distort={false}
                aria-expanded={on}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                // open only: on a phone a tap also fires the hover that just opened it, so a toggle would shut it again
                onClick={() => setActive(i)}
                className={cn("h-10 gap-2 px-4 text-sm font-semibold text-white/80 transition-colors duration-300 hover:text-white", on && "bg-white/[0.12] text-white")}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{a.label}</span>
              </LiquidButton>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
});

DynamicActionBar.displayName = "DynamicActionBar";

export default DynamicActionBar;
