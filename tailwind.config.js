import tw from "tailwindcss/colors";

/*
 * Hospital theme (white + red). The UI was written for a dark space theme, with white text,
 * white glass tints and pastel accents everywhere. Instead of rewriting ~1,000 class names,
 * the palette is remapped here:
 *  - "white" is the ink colour (deep crimson-charcoal), so text-white, border-white/10 and
 *    bg-white/5 glass become dark text, hairlines and soft tints on a white page.
 *  - "black" is the paper colour, so dark overlays become white frosted ones.
 *  - every cool accent (sky, cyan, blue, indigo, violet, purple, teal, fuchsia) becomes red;
 *  - and every palette has its shades flipped (300 -> 700, 400 -> 600 ...) so pastel accents
 *    written for a dark page stay readable on a white one.
 * Status colours keep their meaning: emerald = ok, amber = watch, rose/red = act.
 */
const flip = (p) => {
  const o = {};
  for (const k of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]) {
    const m = k === "50" ? "950" : k === "950" ? "50" : String(1000 - Number(k));
    o[k] = p[m];
  }
  return o;
};
const red = flip(tw.red);
const rose = flip(tw.rose);
const ink = "rgb(var(--ink) / <alpha-value>)";
const paper = "rgb(var(--paper) / <alpha-value>)";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: ink,
        black: paper,
        sky: red,
        cyan: red,
        blue: red,
        indigo: rose,
        violet: rose,
        purple: rose,
        fuchsia: rose,
        teal: red,
        red,
        rose,
        pink: rose,
        orange: flip(tw.orange),
        amber: flip(tw.amber),
        yellow: flip(tw.yellow),
        emerald: flip(tw.emerald),
        green: flip(tw.green),
        lime: flip(tw.lime),
        slate: flip(tw.slate),
        gray: flip(tw.gray),
        zinc: flip(tw.zinc),
        neutral: flip(tw.neutral),
        stone: flip(tw.stone),
        // solid surfaces and true white text on red buttons
        paper,
        snow: "#ffffff",
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: "hsl(var(--destructive))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // rainbow button (src/components/ui/rainbow-button.tsx): the site's own colours, set in index.css
        "color-1": "hsl(var(--color-1))",
        "color-2": "hsl(var(--color-2))",
        "color-3": "hsl(var(--color-3))",
        "color-4": "hsl(var(--color-4))",
        "color-5": "hsl(var(--color-5))",
        ok: "#059669",
        watch: "#d97706",
        act: "#dc2626",
      },
      animation: {
        rainbow: "rainbow var(--speed, 2s) infinite linear",
      },
      keyframes: {
        rainbow: {
          "0%": { "background-position": "0%" },
          "100%": { "background-position": "200%" },
        },
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "monospace"],
        display: ['"Jost"', '"Futura"', '"Century Gothic"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
