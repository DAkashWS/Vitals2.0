/*
 * Rainbow button (from 21st.dev), kept for a few standout moments: adding your crew card,
 * opening Mission 61:4, the demo crew.
 * VITALS changes from the original:
 *   - the rainbow uses the site's own colours (sky, cyan, violet, indigo, emerald; --color-1 to 5 in index.css)
 *   - always the dark body: the site is dark-only, and the original's `dark:` variant would have turned it white
 *   - pill-shaped, with the same liquid-glass rim as LiquidButton on top
 *   - still with reduced motion
 */
import React from "react";

import { cn } from "@/lib/utils";

export interface RainbowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function RainbowButton({ children, className, type = "button", ...props }: RainbowButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "group relative inline-flex h-11 animate-rainbow cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 bg-[length:200%] px-8 py-2 font-semibold text-white transition-transform duration-200 [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.08*1rem)_solid_transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:animate-none motion-reduce:before:animate-none",

        // the glow under the button
        "before:absolute before:bottom-[-20%] before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:-translate-x-1/2 before:animate-rainbow before:bg-[linear-gradient(90deg,hsl(var(--color-1)),hsl(var(--color-5)),hsl(var(--color-3)),hsl(var(--color-4)),hsl(var(--color-2)))] before:bg-[length:200%] before:[filter:blur(calc(0.8*1rem))]",

        // the site's dark body, fading into the rainbow rim
        "bg-[linear-gradient(#0b0d14,#0b0d14),linear-gradient(#0b0d14_50%,rgba(11,13,20,0.6)_80%,rgba(11,13,20,0)),linear-gradient(90deg,hsl(var(--color-1)),hsl(var(--color-5)),hsl(var(--color-3)),hsl(var(--color-4)),hsl(var(--color-2)))]",

        className,
      )}
      {...props}
    >
      {/* liquid-glass rim, as on LiquidButton */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 rounded-full shadow-[inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_-3px_-3px_0.5px_-3.5px_rgba(255,255,255,0.85),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.6),inset_-1px_-1px_1px_-0.5px_rgba(255,255,255,0.6),inset_0_0_6px_6px_rgba(255,255,255,0.08),inset_0_0_2px_2px_rgba(255,255,255,0.05)]"
      />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

export default RainbowButton;
