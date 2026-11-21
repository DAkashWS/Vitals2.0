"use client"

/*
 * Shiny button (from 21st.dev), used for the main action in a spot: Pair a device, Sign in, Create crew…
 * VITALS changes from the original:
 *   - its CSS lives in src/index.css (.shiny-cta): the original used Next.js `<style jsx>`, which Vite
 *     doesn't have, and it loaded Inter from Google Fonts, which the offline site already bundles
 *   - colours follow the site through `tone` (sky, violet, emerald, amber, rose) instead of black and blue
 *   - liquid glass kept: a see-through, blurred body and the same glass rim as LiquidButton
 *   - takes every normal button prop (type, disabled, aria-*), so it works in forms
 *   - still with reduced motion, and dimmed when disabled
 */
import type React from "react"

import { cn } from "@/lib/utils"

export type ShinyTone = "sky" | "violet" | "emerald" | "amber" | "rose"

export interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ShinyTone
}

export function ShinyButton({ children, className, tone = "sky", type = "button", ...props }: ShinyButtonProps) {
  return (
    <button type={type} data-tone={tone} className={cn("shiny-cta", className)} {...props}>
      <span className="shiny-cta-glass" aria-hidden="true" />
      <span className="shiny-cta-label">{children}</span>
    </button>
  )
}

export default ShinyButton
