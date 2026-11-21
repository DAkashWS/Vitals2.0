import type { ReactNode } from "react";

/*
 * VITALS glyphs: the site's own icon set, drawn for this project instead of system emojis.
 *
 * Style rules (keep them when adding icons):
 *   - 24 × 24 grid, 1.7 px rounded strokes in currentColor
 *   - one soft "accent" fill (class "a") at low opacity for the main shape
 *   - no text, no gradients inside the icon; colour comes from the tile around it
 * <GlyphTile> puts a glyph in a tinted rounded tile with a small orbit dot, the VITALS mark.
 */

const A = { fill: "currentColor", fillOpacity: 0.2 } as const; // accent fill
const S = { fill: "currentColor", stroke: "none" } as const; // solid detail

const ICONS = {
  heart: <path {...A} d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  heartPulse: (
    <>
      <path {...A} d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      <path d="M6.5 11.5H9l1.5-2.5 2 4.5 1.5-2H17.5" />
    </>
  ),
  heartBroken: (
    <>
      <path {...A} d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      <path d="M12 7.4l-1.5 3.6 2.6 1.6-1.6 3.9" />
    </>
  ),
  ecg: (
    <>
      <rect {...A} x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M2.5 12.5h4l1.8-4 3 8 2-5.5 1.4 1.5h6.8" />
    </>
  ),
  lungs: (
    <>
      <path d="M12 3.5v8.5M12 9l-2.5 2M12 9l2.5 2" />
      <path {...A} d="M9.5 8C6.5 7.5 4 11 4 16c0 2.2 1.1 3.5 2.8 3.5 2.4 0 3.7-1.6 3.7-4V9.6c0-.8-.4-1.4-1-1.6z" />
      <path {...A} d="M14.5 8c3-.5 5.5 3 5.5 8 0 2.2-1.1 3.5-2.8 3.5-2.4 0-3.7-1.6-3.7-4V9.6c0-.8.4-1.4 1-1.6z" />
    </>
  ),
  drop: <path {...A} d="M12 3.5c3 4 5.5 7 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.5 9 7.5 12 3.5z" />,
  dry: (
    <>
      <path {...A} d="M12 3.5c3 4 5.5 7 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.5 9 7.5 12 3.5z" />
      <path d="M4.5 19.5l15-15" />
    </>
  ),
  thermometer: (
    <>
      <path {...A} d="M10 4.5a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0z" />
      <path d="M12 9v7.5" />
      <circle {...S} cx="12" cy="17" r="1.7" />
      <path d="M16.5 6h2M16.5 9h1.5" />
    </>
  ),
  wind: <path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h6.5" />,
  brain: (
    <>
      <path {...A} d="M12 5.5a3 3 0 0 0-5.4 1.4A3 3 0 0 0 5 12a3 3 0 0 0 1.8 4.6A3 3 0 0 0 12 18.5z" />
      <path {...A} d="M12 5.5a3 3 0 0 1 5.4 1.4A3 3 0 0 1 19 12a3 3 0 0 1-1.8 4.6A3 3 0 0 1 12 18.5z" />
      <path d="M12 5.5v13M8.5 10.5c1 0 1.8.6 2 1.5M15.5 10.5c-1 0-1.8.6-2 1.5" />
    </>
  ),
  head: (
    <>
      <path {...A} d="M15 20.5V17h2a1.5 1.5 0 0 0 1.5-1.5V13l1.6-.9-1.6-3.2A7.2 7.2 0 1 0 8 15.8v4.7" />
      <circle cx="11" cy="9.5" r="2.4" />
      <path d="M11 4.5v1.6M11 12.9v1.6M6 9.5h1.6M14.4 9.5H16" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle {...A} cx="12" cy="12" r="3.2" />
      <circle {...S} cx="12" cy="12" r="1.2" />
    </>
  ),
  bone: (
    <path
      {...A}
      transform="rotate(-45 12 12)"
      d="M7.2 9.6a2.3 2.3 0 1 0-2.9 2.4 2.3 2.3 0 1 0 2.9 2.4h9.6a2.3 2.3 0 1 0 2.9-2.4 2.3 2.3 0 1 0-2.9-2.4z"
    />
  ),
  dumbbell: (
    <>
      <path d="M8 12h8" />
      <rect {...A} x="5" y="7" width="3" height="10" rx="1" />
      <rect {...A} x="16" y="7" width="3" height="10" rx="1" />
      <path d="M2.5 10v4M21.5 10v4" />
    </>
  ),
  shield: (
    <>
      <path {...A} d="M12 3l7 3v5.2c0 4.4-3 7.8-7 9.8-4-2-7-5.4-7-9.8V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  germ: (
    <>
      <circle {...A} cx="12" cy="12" r="4.6" />
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9L18 18M18 6l-2.1 2.1M6 18l2.1-2.1" />
      <circle {...S} cx="10.6" cy="11" r="1" />
      <circle {...S} cx="13.4" cy="13.4" r=".8" />
    </>
  ),
  pill: (
    <>
      <path {...A} d="M5.6 18.4a3.6 3.6 0 0 1 0-5.1l7.7-7.7a3.6 3.6 0 1 1 5.1 5.1l-7.7 7.7a3.6 3.6 0 0 1-5.1 0z" />
      <path d="M9.5 9.5l5 5" />
    </>
  ),
  moon: (
    <>
      <path {...A} d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z" />
      <path d="M17 3.5v3M15.5 5h3" />
    </>
  ),
  bulb: (
    <>
      <path {...A} d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3z" />
      <path d="M9.5 19h5M10.5 21.5h3M12 10v3" />
    </>
  ),
  cup: (
    <>
      <path {...A} d="M4.5 9h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M15.5 10h1.5a2.5 2.5 0 0 1 0 5h-1.5M8.5 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3M4 21h12" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6.5 3h11M6.5 21h11" />
      <path d="M8 3c0 4.5 8 5 8 9s-8 4.5-8 9M16 3c0 4.5-8 5-8 9s8 4.5 8 9" />
      <path {...S} d="M10 19.5h4L12 17z" />
    </>
  ),
  battery: (
    <>
      <rect x="2.5" y="7.5" width="17" height="9" rx="2.2" />
      <path d="M21.5 10.5v3" />
      <rect {...S} x="4.5" y="9.5" width="3.2" height="5" rx=".8" />
    </>
  ),
  spiral: <path d="M12 12a1 1 0 0 1 2 0 2 2 0 0 1-4 0 3 3 0 0 1 6 0 4 4 0 0 1-8 0 5 5 0 0 1 10 0 6 6 0 0 1-12 0" />,
  stethoscope: (
    <>
      <path d="M5 3.5h2M13 3.5h2M6 3.5V8a4 4 0 0 0 8 0V3.5M10 12v3a5 5 0 0 0 10 0v-1.2" />
      <circle {...A} cx="20" cy="11.5" r="2.3" />
    </>
  ),
  nurse: (
    <>
      <circle {...A} cx="12" cy="7" r="3.3" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0M12 13.8v4.4M9.8 16h4.4" />
    </>
  ),
  warning: (
    <>
      <path {...A} d="M10.3 4.4a2 2 0 0 1 3.4 0l7.3 12.7a2 2 0 0 1-1.7 3H4.7a2 2 0 0 1-1.7-3z" />
      <path d="M12 9.5v4.5" />
      <circle {...S} cx="12" cy="17" r="1" />
    </>
  ),
  cap: (
    <>
      <path {...A} d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c3.2 2.2 8.8 2.2 12 0v-5M21 9.5v5.5" />
    </>
  ),
  fog: (
    <>
      <path {...A} d="M7 14.5h10a3.8 3.8 0 0 0 .3-7.6A5 5 0 0 0 7.8 8.2 3.2 3.2 0 0 0 7 14.5z" />
      <path d="M4.5 18h9M16 18h3.5M7 21h10" />
    </>
  ),
  shake: (
    <>
      <rect {...A} x="8" y="4" width="8" height="16" rx="2" />
      <path d="M5 8.5v7M19 8.5v7M2.5 10.5v3M21.5 10.5v3M11 17h2" />
    </>
  ),
  flame: <path {...A} d="M12 21a6 6 0 0 0 6-6c0-4-3-5-3-9.5-2.2 1.4-3.3 3.2-3.3 5.3-.9-.8-1.4-1.8-1.4-3.1C7.6 9.4 6 12 6 15a6 6 0 0 0 6 6z" />,
  halfSun: (
    <>
      <circle cx="12" cy="12" r="5" />
      <path {...S} d="M12 7a5 5 0 0 0 0 10z" fillOpacity={0.55} />
      <path d="M12 2.5V4.5M12 19.5v2M18.7 5.3l-1.4 1.4M18.7 18.7l-1.4-1.4M21.5 12h-2" />
    </>
  ),
  snowflake: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
      <path d="M9.8 4.6L12 6.6l2.2-2M9.8 19.4l2.2-2 2.2 2M4.8 10.4l2.9-.9-.7-2.9M19.2 13.6l-2.9.9.7 2.9" />
    </>
  ),
  clipboard: (
    <>
      <rect {...A} x="5" y="4.5" width="14" height="16.5" rx="2.2" />
      <path d="M9 4.5V3h6v1.5M8.5 10l1.3 1.3 2.2-2.3M8.5 15.5l1.3 1.3 2.2-2.3M14 10.5h2M14 16h2" />
    </>
  ),
  bubbles: (
    <>
      <circle {...A} cx="9" cy="14.5" r="5" />
      <circle cx="16.5" cy="7.5" r="3" />
      <circle cx="18" cy="16.5" r="1.8" />
      <path d="M6.8 12.6a2.5 2.5 0 0 1 2.2-1.3" />
    </>
  ),
  filter: (
    <>
      <rect {...A} x="5" y="5.5" width="14" height="13" rx="2.2" />
      <path d="M9 5.5v13M12 5.5v13M15 5.5v13M1.8 12H5M19 12h3.2M20.6 10.4L22.2 12l-1.6 1.6" />
    </>
  ),
  fan: (
    <>
      <circle cx="12" cy="12" r="9" />
      <g {...A}>
        <path d="M12 12c-.5-3.5.5-6 2.8-6.2 2.5-.2 2.2 3.3-2.8 6.2z" />
        <path d="M12 12c-.5-3.5.5-6 2.8-6.2 2.5-.2 2.2 3.3-2.8 6.2z" transform="rotate(120 12 12)" />
        <path d="M12 12c-.5-3.5.5-6 2.8-6.2 2.5-.2 2.2 3.3-2.8 6.2z" transform="rotate(240 12 12)" />
      </g>
      <circle {...S} cx="12" cy="12" r="1.3" />
    </>
  ),
  dna: (
    <>
      <path d="M7 3c0 4.5 10 4.5 10 9s-10 4.5-10 9M17 3c0 4.5-10 4.5-10 9s10 4.5 10 9" />
      <path d="M9 6.5h6M10 12h4M9 17.5h6" strokeOpacity={0.55} />
    </>
  ),
  sunFlare: (
    <>
      <circle {...A} cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
    </>
  ),
  radiation: (
    <>
      <circle cx="12" cy="12" r="9.2" />
      <g {...A} fillOpacity={0.45}>
        <path d="M12 12L12 4.2A7.8 7.8 0 0 1 18.75 8.1Z" />
        <path d="M12 12L12 4.2A7.8 7.8 0 0 1 18.75 8.1Z" transform="rotate(120 12 12)" />
        <path d="M12 12L12 4.2A7.8 7.8 0 0 1 18.75 8.1Z" transform="rotate(240 12 12)" />
      </g>
      <circle {...S} cx="12" cy="12" r="1.6" />
    </>
  ),
  bolt: <path {...A} d="M13.5 2.5L5 14h6.2l-1 7.5L19 10h-6.2z" />,
  mushroom: (
    <>
      <path {...A} d="M3.5 12.5a8.5 8.5 0 0 1 17 0z" />
      <path d="M9.5 12.5v6a2.5 2.5 0 0 0 5 0v-6" />
      <circle {...S} cx="9" cy="8.5" r="1.1" />
      <circle {...S} cx="14.5" cy="7.5" r="1.3" />
    </>
  ),
  ear: (
    <>
      <path {...A} d="M7 9a5 5 0 1 1 10 0c0 3.4-3.4 4.4-3.4 7.4a3.3 3.3 0 0 1-6.6 0" />
      <path d="M10 9a2 2 0 0 1 4 0c0 1.7-1.8 2.2-1.8 3.6M19.5 6.5a7 7 0 0 1 0 6" />
    </>
  ),
  burst: <path {...A} d="M12 2.5l2 5.5 5.5-2-3 5 5 2.5-5.6 1.2.6 5.8-4.5-3.8-4.5 3.8.6-5.8L2.5 13.5l5-2.5-3-5L10 8z" />,
  o2: (
    <>
      <circle {...A} cx="10" cy="11" r="6.5" />
      <circle cx="10" cy="11" r="2.6" />
      <path d="M16.8 16.5h3.2l-3 3.5h3" />
    </>
  ),
  satellite: (
    <>
      <path {...A} d="M12 8.5l3.5 3.5-3.5 3.5L8.5 12z" />
      <path d="M8.5 12L3.8 7.3 6.3 4.8 11 9.5M15.5 12l4.7 4.7-2.5 2.5-4.7-4.7M14 10l2.6-2.6M17.8 4.4a2.5 2.5 0 0 1 1.8 1.8" />
    </>
  ),
  soap: (
    <>
      <rect {...A} x="3.5" y="11" width="17" height="9" rx="3" />
      <circle cx="9" cy="6" r="2.2" />
      <circle cx="14.6" cy="4.8" r="1.4" />
      <circle cx="15.8" cy="8.4" r="1" />
    </>
  ),
  toothbrush: (
    <>
      <path d="M3.5 20.5L13 11" />
      <path {...A} d="M13 11l5.5-5.5 2.5 2.5-5.5 5.5z" />
      <path d="M15 5.5l-1-1M17 3.5l-1-1M13 7.5l-1-1" />
    </>
  ),
  floss: (
    <>
      <rect {...A} x="5" y="4" width="10" height="16" rx="2.2" />
      <path d="M5 8.5h10M5 15.5h10M15 12c3.2 0 3 6.5 6 6.5" />
    </>
  ),
  towel: (
    <>
      <path {...A} d="M6 4h12v16H6z" />
      <path d="M3.5 4h17M6 16h12M9.5 4v12" />
    </>
  ),
  lotion: (
    <>
      <path {...A} d="M8.5 10h7v10a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 20z" />
      <path d="M10.5 10V6.5h3V10M13.5 6.5H17M10.5 14.5h3" />
    </>
  ),
  shirt: <path {...A} d="M8.5 4L4 7l2.2 3.5L8 9.6V20h8V9.6l1.8.9L20 7l-4.5-3a3.5 3.5 0 0 1-7 0z" />,
  sponge: (
    <>
      <rect {...A} x="3.5" y="9" width="17" height="10" rx="2.5" />
      <circle {...S} cx="8" cy="13" r=".9" />
      <circle {...S} cx="12.5" cy="15" r=".9" />
      <circle {...S} cx="16" cy="12.5" r=".9" />
      <circle cx="9" cy="4.8" r="1.6" />
      <circle cx="14" cy="5.6" r="1" />
    </>
  ),
  plate: (
    <>
      <circle {...A} cx="13" cy="12" r="6.2" />
      <circle cx="13" cy="12" r="3.4" />
      <path d="M3.5 3.5v5a1.5 1.5 0 0 0 3 0v-5M5 9v11.5M21.5 3.5c-1.6 2.2-1.6 6.3 0 8.5v8.5" />
    </>
  ),
  toilet: (
    <>
      <rect x="5" y="3" width="7" height="7.5" rx="1.2" />
      <path {...A} d="M3.5 10.5h17c0 4.2-3.2 6.5-6.5 6.5l1 4h-6l1-4c-3.3 0-6.5-2.3-6.5-6.5z" />
    </>
  ),
  bin: (
    <>
      <path d="M4.5 7h15M9.5 7V4h5v3" />
      <path {...A} d="M6.2 7l1 13.5h9.6l1-13.5" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  tap: (
    <>
      <path d="M3.5 8.5H13a3 3 0 0 1 3 3V13M8 8.5V5.5M5.5 5h5" />
      <path {...A} d="M16 21a1.6 1.6 0 0 1-1.6-1.6c0-1.3 1.6-3.4 1.6-3.4s1.6 2.1 1.6 3.4A1.6 1.6 0 0 1 16 21z" />
    </>
  ),
  gauge: (
    <>
      <path {...A} d="M3.5 17a8.5 8.5 0 1 1 17 0z" />
      <path d="M12 17l4.2-5.2M6.5 12.5l1 .6M12 8.5v1.2M17.5 12.5l-1 .6" />
      <circle {...S} cx="12" cy="17" r="1.5" />
    </>
  ),
  chat: (
    <>
      <path {...A} d="M4 5.5h16v11H9.5L4 20.5z" />
      <circle {...S} cx="8.5" cy="11" r="1" />
      <circle {...S} cx="12" cy="11" r="1" />
      <circle {...S} cx="15.5" cy="11" r="1" />
    </>
  ),
  notepad: (
    <>
      <rect {...A} x="5" y="3.5" width="14" height="17.5" rx="2.2" />
      <path d="M8.5 8.5h7M8.5 12.5h7M8.5 16.5h4" />
    </>
  ),
  helmet: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path {...A} d="M6.8 11.2a5.2 4 0 0 1 10.4 0v1.6a5.2 3.2 0 0 1-10.4 0z" />
      <path d="M8.5 10.5c.8-.9 1.8-1.3 3-1.3M3.5 15h2M18.5 15h2" />
    </>
  ),
  bluetooth: (
    <>
      <rect {...A} x="5" y="2.5" width="14" height="19" rx="7" />
      <path d="M8.5 8.5l7 7-3.5 3.5V5l3.5 3.5-7 7" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 15.8a5 5 0 0 1 6.8 0" />
      <circle {...S} cx="12" cy="19" r="1.6" />
    </>
  ),
  usb: (
    <>
      <rect {...A} x="7.5" y="9" width="9" height="12.5" rx="2" />
      <path d="M9.5 9V3h5v6M11 5.5h.01M13 5.5h.01M10.5 13.5h3M10.5 16.5h3" />
    </>
  ),
  play: (
    <>
      <circle {...A} cx="12" cy="12" r="9" />
      <path d="M10 8.5l5.5 3.5-5.5 3.5z" />
    </>
  ),
  bot: (
    <>
      <rect {...A} x="4" y="7.5" width="16" height="12" rx="3.5" />
      <path d="M12 3.5v4M9 12.5v1.5M15 12.5v1.5M9.5 16.5h5M2 12v3M22 12v3" />
      <circle {...S} cx="12" cy="3.2" r="1.2" />
    </>
  ),
  /* ---- Bone & muscle ---- */
  muscle: (
    <>
      <path
        {...A}
        d="M5.6 4.2c-1.5.4-2.2 2-1.4 3.3l2.4 4.1-.9 3.1c-.6 2.2 1 4.3 3.3 4.3H18a3 3 0 0 0 3-3c0-3.6-2.9-6.5-6.5-6.5-1.6 0-3.1.6-4.3 1.7L8.6 7.6l.7-1.4c.6-1.3-.5-2.6-1.8-2.3z"
      />
      <path d="M11.8 13.6c1-1 2.4-1.5 3.8-1.3" />
    </>
  ),
  fibres: (
    <>
      <ellipse {...A} cx="12" cy="12" rx="9.5" ry="5.5" />
      <path d="M3.5 10.3c2.8-1 5.6.8 8.5 0s5.6-1 8.5 0M3 12.6c3-1 6 .8 9 0s6-1 9 0M4 14.9c2.7-.8 5.4.7 8 0s5.4-.8 8 0" />
    </>
  ),
  spine: (
    <>
      <rect {...A} x="8.5" y="2.5" width="7" height="3.6" rx="1.4" />
      <rect {...A} x="8" y="7.5" width="8" height="3.8" rx="1.4" />
      <rect {...A} x="7.5" y="12.7" width="9" height="3.9" rx="1.4" />
      <rect {...A} x="7" y="18" width="10" height="3.6" rx="1.4" />
      <path d="M5.5 9.4h2M16.5 9.4h2M5 14.6h2.5M16.5 14.6H19" />
    </>
  ),
  pelvis: (
    <>
      <path {...A} d="M3.5 5.5c2.5.8 3.6 3.6 3.6 6.8 0 3.6 2.2 6.2 4.9 6.2s4.9-2.6 4.9-6.2c0-3.2 1.1-6 3.6-6.8-1.4 3.3-2.8 4.6-5.5 4.6H9C6.3 10.1 4.9 8.8 3.5 5.5z" />
      <circle cx="9" cy="14" r="1.5" />
      <circle cx="15" cy="14" r="1.5" />
      <path d="M12 18.5v3" />
    </>
  ),
  boneCells: (
    <>
      <circle {...A} cx="7.5" cy="12" r="4.8" />
      <path d="M7.5 9.8v4.4M5.3 12h4.4" />
      <path {...A} d="M21 9.3A4.8 4.8 0 1 0 21 14.7L16.8 12z" />
      <circle {...S} cx="17.6" cy="9.6" r=".8" />
    </>
  ),
  treadmill: (
    <>
      <path {...A} d="M3 16.5h14.5a2.2 2.2 0 0 0 0-4.4H5.5" />
      <path d="M17.5 12.1V5.5l2.5-1.2M14.5 5.5h5" />
      <circle cx="5.5" cy="14.3" r="2.2" />
      <path d="M4 20.5h16" />
      <circle {...S} cx="10" cy="5.5" r="1.5" />
      <path d="M10 7.5l-1 3M10 7.5l1.8 2.5" />
    </>
  ),
  bike: (
    <>
      <circle {...A} cx="7" cy="15" r="3.6" />
      <path d="M7 15l4-6.5h4l2.5 6.5M11 8.5L10 5.5H8M15 8.5l1.2-3H18.5M3 21h18M17.5 15v6" />
    </>
  ),
  pants: (
    <>
      <path {...A} d="M7 3h10l1.2 18h-4.4L12 10.5 10.2 21H5.8z" />
      <path d="M7.4 7.5h9.2M7 14.5h3M14 14.5h3" />
    </>
  ),
  kidney: (
    <>
      <path {...A} d="M15 3.5c-3.8 0-6.8 2.8-6.8 6 0 1.5 1.5 2 1.5 3.4S8 15.7 8 17.4a3.6 3.6 0 0 0 3.6 3.6c4.4 0 7.9-4.6 7.9-10 0-4.4-1.8-7.5-4.5-7.5z" />
      <circle {...S} cx="13.5" cy="12" r="1.5" />
      <circle {...S} cx="15.6" cy="15.2" r=".9" />
    </>
  ),
  moonFace: (
    <>
      <circle {...A} cx="12" cy="12.5" r="8.5" />
      <circle {...S} cx="9" cy="11" r="1" />
      <circle {...S} cx="15" cy="11" r="1" />
      <path d="M6.5 14.5c1.2.9 2.4.9 3.4 0M14.1 14.5c1 .9 2.2.9 3.4 0M10.5 17h3M12 1.8v1.7M9 2.6l.7 1.4M15 2.6l-.7 1.4" />
    </>
  ),
  bloodCell: (
    <>
      <circle {...A} cx="9" cy="10" r="5.5" />
      <circle cx="9" cy="10" r="2" />
      <circle cx="16.5" cy="16.5" r="3.6" />
      <circle cx="16.5" cy="16.5" r="1.2" />
    </>
  ),
  calcium: (
    <>
      <circle {...S} cx="12" cy="12" r="2.2" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse {...A} cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
    </>
  ),
  chartDown: (
    <>
      <path d="M3.5 3.5v17h17" />
      <path {...A} d="M3.5 7.5l4.5 4 3.5-2.5 6 7.5H3.5z" stroke="none" />
      <path d="M3.5 7.5l4.5 4 3.5-2.5 6 7.5M17.5 12.5v4h-4" />
    </>
  ),
  mouse: (
    <>
      <path {...A} d="M4 17.5c0-4.4 3.6-8 8-8s7 3 7.5 6.5H21v1.5H4z" />
      <circle cx="16.5" cy="8.5" r="2.3" />
      <circle {...S} cx="17.6" cy="13.4" r=".8" />
      <path d="M4 17.5C2.5 17.5 2 19 3 20s3 .5 4-.5" />
    </>
  ),
  digitalAstronaut: (
    <>
      <circle {...A} cx="12" cy="5" r="2.4" />
      <path d="M12 7.4v6.1M12 13.5l-3.2 6.5M12 13.5l3.2 6.5M7.5 10h9" />
      <circle {...S} cx="7.5" cy="10" r="1.1" />
      <circle {...S} cx="16.5" cy="10" r="1.1" />
      <circle {...S} cx="12" cy="13.5" r="1.1" />
      <circle {...S} cx="8.8" cy="20" r="1.1" />
      <circle {...S} cx="15.2" cy="20" r="1.1" />
    </>
  ),
  scale: (
    <>
      <path {...A} d="M5.5 20.5h13L17 8.5H7z" />
      <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0M12 16l2.2-2.6" />
      <circle {...S} cx="12" cy="16" r="1" />
    </>
  ),
  /* ---- Radiation ---- */
  dosimeter: (
    <>
      <rect {...A} x="6.5" y="5" width="11" height="16" rx="2.5" />
      <path d="M10 5V3h4v2M9.5 16.5h5M9.5 18.5h3" />
      <circle cx="12" cy="11" r="2.8" />
      <path d="M12 11l1.6-1.4" />
    </>
  ),
  proton: (
    <>
      <circle {...A} cx="16.5" cy="7.5" r="4" />
      <path d="M16.5 5.8v3.4M14.8 7.5h3.4M3 21l8.5-8.5M3 16.5l4-4M7.5 21l4-4" />
    </>
  ),
  alpha: (
    <>
      <circle {...A} cx="9" cy="9" r="3.6" />
      <circle {...A} cx="15" cy="9" r="3.6" />
      <circle cx="9" cy="15" r="3.6" />
      <circle cx="15" cy="15" r="3.6" />
      <path d="M9 7.6v2.8M7.6 9h2.8M15 7.6v2.8M13.6 9h2.8" />
    </>
  ),
  heavyIon: (
    <>
      <circle {...A} cx="12" cy="12" r="5.5" />
      <circle {...S} cx="10.3" cy="10.6" r="1.1" />
      <circle {...S} cx="13.7" cy="10.6" r="1.1" />
      <circle {...S} cx="12" cy="13.6" r="1.1" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </>
  ),
  magnetShield: (
    <>
      <circle {...A} cx="12" cy="12" r="3.6" />
      <path d="M12 8.4c-5-5.5-9.5-2-9.5 3.6s4.500 9.1 9.5 3.600M12 8.4c5-5.5 9.5-2 9.5 3.600s-4.500 9.1-9.500 3.600" />
      <path d="M12 3.500v2M12 18.500v2" />
    </>
  ),
  mars: (
    <>
      <circle {...A} cx="12" cy="12" r="8.5" />
      <path d="M7.6 5.2c2.600-1 6.200-1 8.800 0" strokeOpacity={0.6} />
      <path d="M5.500 13.200l4.200-1.200 3.300 1.600 5-1.800" />
      <circle cx="9" cy="8.800" r="1.300" />
      <circle {...S} cx="15.200" cy="16.200" r="1.100" />
      <circle {...S} cx="16.300" cy="9" r="0.700" />
    </>
  ),
  ray: (
    <>
      <path d="M2.500 12c1.200-4.500 2.400-4.500 3.600 0s2.400 4.500 3.600 0 2.400-4.500 3.600 0 2.400 4.500 3.600 0" />
      <path d="M17.500 8.500L21.500 12l-4 3.500" />
    </>
  ),
  ribbon: (
    <>
      <path {...A} d="M12 3c2.400 0 4 1.500 4 3.600 0 2.600-2.200 4.600-4 7.400-1.800-2.800-4-4.800-4-7.400C8 4.500 9.600 3 12 3z" />
      <path d="M10 11.200L6.500 20.500l3-1.200 1.500 2L14 13.800M14 11.200l3.500 9.300-3-1.200" />
    </>
  ),
  stomach: (
    <path
      {...A}
      d="M9.500 3v4c0 1.500-1.300 2-2.500 3-1.800 1.500-2.500 3.500-2.500 5.500 0 3 2.300 5 5.500 5 4.500 0 8.500-3.500 8.500-8.500 0-2.500-1.500-4-3.500-4-1 0-1.800.300-2.500 1V3"
    />
  ),
  liver: (
    <>
      <path {...A} d="M3 9.500C3 6.500 6 5 10 5h7.500c2 0 3.500 1.500 3.500 3.500 0 3-3 4.500-6.500 6C11 16 8.500 19 6.500 19 4.500 19 3 15.500 3 9.500z" />
      <path d="M12 5v6.500" />
    </>
  ),
  intestine: (
    <path d="M6 4h10a3 3 0 0 1 0 6H8a2.500 2.500 0 0 0 0 5h8a2.500 2.500 0 0 1 0 5H6" />
  ),
  people: (
    <>
      <circle {...A} cx="8" cy="7" r="2.800" />
      <circle {...A} cx="16.500" cy="8" r="2.300" />
      <path d="M2.500 20a5.500 5.500 0 0 1 11 0M13.500 14.300a4.600 4.600 0 0 1 8 3.200V20" />
    </>
  ),
  balance: (
    <>
      <path d="M12 4v16.500M7 20.500h10M4.500 7.500l7.500-2 7.500 2" />
      <path {...A} d="M2 13.500l2.500-6 2.500 6a2.500 2.500 0 0 1-5 0zM17 13.500l2.500-6 2.500 6a2.500 2.500 0 0 1-5 0z" />
    </>
  ),
  /* ---- Isolation ---- */
  capsule: (
    <>
      <path {...A} d="M8 4h8l3.5 10v4.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V14z" />
      <circle cx="12" cy="11" r="2.4" />
      <path d="M4.5 15h15" />
    </>
  ),
  envelope: (
    <>
      <rect {...A} x="3" y="5.5" width="18" height="13" rx="2.2" />
      <path d="M3.5 7l8.5 6.2L20.5 7" />
    </>
  ),
  delay: (
    <>
      <circle {...A} cx="11" cy="13" r="7.5" />
      <path d="M11 9v4.2l2.8 1.8M9 2.5h4M19.5 5.5l1.5-1.5" />
    </>
  ),
  paleDot: (
    <>
      <path d="M3 18c4-6 10-11 18-13" strokeOpacity={0.4} />
      <circle {...S} cx="15" cy="9.3" r="1.6" />
      <circle cx="15" cy="9.3" r="3.6" strokeOpacity={0.5} />
    </>
  ),
  sunrise: (
    <>
      <path {...A} d="M6 16a6 6 0 0 1 12 0z" />
      <path d="M2.5 16h19M12 4v3M4.6 8.6l2 2M19.4 8.6l-2 2M8 20h8" />
    </>
  ),
  lowMood: (
    <>
      <circle {...A} cx="12" cy="12" r="8.5" />
      <circle {...S} cx="9" cy="10" r="1" />
      <circle {...S} cx="15" cy="10" r="1" />
      <path d="M8.5 16.2c2-1.6 5-1.6 7 0" />
    </>
  ),
  cupola: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path {...A} d="M12 7.5l4.3 3.1-1.6 5H9.3l-1.6-5z" />
      <path d="M12 3v4.5M20.6 9.2l-4.3 1.4M17.3 19.3l-2.6-3.7M6.7 19.3l2.6-3.7M3.4 9.2l4.3 1.4" />
    </>
  ),
  dome: (
    <>
      <path {...A} d="M3 18.5a9 9 0 0 1 18 0z" />
      <path d="M2 18.5h20M10 18.5v-3.5a2 2 0 0 1 4 0v3.5M7 11l2.2 1.5M17 11l-2.2 1.5" />
    </>
  ),
  iceberg: (
    <>
      <path {...A} d="M3.5 11L8 4.5l3 3 2.5-2 5 5.5z" />
      <path d="M2 11h20" />
      <path d="M5 11l2 8.5h9l3-8.5" strokeOpacity={0.55} />
    </>
  ),
  room: (
    <>
      <path {...A} d="M4 10l8-6 8 6v10H4z" />
      <path d="M10 20v-5h4v5M9.5 11.5h5M12 9v5" />
    </>
  ),
  airflow: (
    <>
      <rect {...A} x="6" y="6" width="12" height="12" rx="2" />
      <path d="M2.5 12h4M2.5 12l1.5-1.5M2.5 12l1.5 1.5M17.5 12h4M21.5 12L20 10.5M21.5 12L20 13.5" />
    </>
  ),
  lockDoor: (
    <>
      <rect {...A} x="5" y="3" width="14" height="18" rx="1.5" />
      <rect x="9.5" y="11" width="5" height="4.5" rx="1" />
      <path d="M10.5 11V9.5a1.5 1.5 0 0 1 3 0V11" />
    </>
  ),
  flask: (
    <>
      <path {...A} d="M9.5 3.5h5M10.5 3.5v5.5L5 19a1.5 1.5 0 0 0 1.3 2.3h11.4A1.5 1.5 0 0 0 19 19l-5.5-10V3.5" />
      <path d="M7.5 15h9" />
    </>
  ),
  globe: (
    <>
      <circle {...A} cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5M12 3.5C9.4 5.9 8.2 8.7 8.2 12s1.2 6.1 3.8 8.5" />
    </>
  ),
  gear: (
    <>
      <circle {...A} cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
    </>
  ),
  calendar: (
    <>
      <rect {...A} x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" />
    </>
  ),
  headset: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect {...A} x="3" y="13" width="4" height="6.5" rx="1.6" />
      <rect {...A} x="17" y="13" width="4" height="6.5" rx="1.6" />
      <path d="M19 19.5c0 1.2-1.5 2-4 2h-2" />
    </>
  ),
  /* ---- Fluid shift ---- */
  fluidUp: (
    <>
      <circle {...A} cx="12" cy="5" r="2.6" />
      <path {...A} d="M8.5 9.5h7l-.8 5.5h-1.2l-.5 6h-2l-.5-6H9.3z" />
      <path d="M3.5 19V9.5M3.5 9.5L1.8 11.5M3.5 9.5l1.7 2M20.5 19V9.5M20.5 9.5l-1.7 2M20.5 9.5l1.7 2" />
    </>
  ),
  birdLegs: (
    <>
      <path {...A} d="M6.5 3h11l-1.5 6.5H8z" />
      <path d="M10 9.5v11M14 9.5v11M10 20.5H7.5M14 20.5h2.5" />
    </>
  ),
  clot: (
    <>
      <path d="M2.5 7.5c4 0 6 2.5 9.5 2.5s5.5-2.5 9.5-2.5M2.5 16.5c4 0 6-2.5 9.5-2.5s5.5 2.5 9.5 2.5" />
      <circle {...S} cx="12" cy="12" r="1.9" />
      <circle {...A} cx="9" cy="12" r="1.1" />
      <path d="M17 12h3.5M17 12l1.4-1.3M17 12l1.4 1.3" />
    </>
  ),
  faint: (
    <>
      <circle {...A} cx="12" cy="13" r="8" />
      <path d="M8.3 11l2.2 1.5-2.2 1.5M15.7 11l-2.2 1.5 2.2 1.5M9.8 17.3h4.4" />
      <path d="M6 3.5l1 1.5M12 2v2M18 3.5l-1 1.5" />
    </>
  ),
  salt: (
    <>
      <path {...A} d="M7.5 10h9l-1 10.5a1 1 0 0 1-1 .9h-5a1 1 0 0 1-1-.9z" />
      <path d="M7.5 10c0-3.6 2-6 4.5-6s4.5 2.4 4.5 6" />
      <circle {...S} cx="10.5" cy="7" r="0.7" />
      <circle {...S} cx="13.5" cy="7" r="0.7" />
      <circle {...S} cx="12" cy="5.4" r="0.7" />
    </>
  ),
  vacuum: (
    <>
      <path {...A} d="M8 3h8l1.5 18h-4L12 11l-1.5 10h-4z" />
      <path d="M2 7.5h3.5M5.5 7.5L4 6M5.5 7.5L4 9M2 14h3M22 7.5h-3.5M18.5 7.5L20 6M18.5 7.5L20 9M22 14h-3" />
    </>
  ),
  skullPressure: (
    <>
      <path {...A} d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.4 2.5 5.5V20h4v-2h2v2h4v-4c1.2-1.1 2.5-2.9 2.5-5.5A7.5 7.5 0 0 0 12 3z" />
      <circle cx="9.3" cy="11" r="1.5" />
      <circle cx="14.7" cy="11" r="1.5" />
      <path d="M12 6.5v-5M12 1.5l-1.4 1.4M12 1.5l1.4 1.4" />
    </>
  ),
  /* ---- Scenario simulator ---- */
  simulator: (
    <>
      <rect {...A} x="2.5" y="8" width="19" height="11" rx="5.5" />
      <path d="M7 11.5v4M5 13.5h4" />
      <circle {...S} cx="16" cy="12.3" r="1.1" />
      <circle {...S} cx="18" cy="14.7" r="1.1" />
      <path d="M12 8V5.5a2 2 0 0 1 2-2h1.5" />
    </>
  ),
  co2Cloud: (
    <>
      <path {...A} d="M6.5 18.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.7-1.3 4.6 4.6 0 0 1 .7 9.3z" />
      <path d="M9.6 12.6a1.6 1.6 0 1 0 0 2.6M12.9 12.3a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM15.6 15.3h1.4l-1.4 1.7h1.5" />
    </>
  ),
  dehydrate: (
    <>
      <path {...A} d="M12 3s-6.5 7-6.5 11.2a6.5 6.5 0 0 0 13 0C18.5 10 12 3 12 3z" />
      <path d="M12.8 9l-2 3.5h3l-2.2 4" />
    </>
  ),
  tiredEye: (
    <>
      <path {...A} d="M2.5 13c2.6-3 5.8-4.5 9.5-4.5s6.9 1.5 9.5 4.5c-2.6 3-5.8 4.5-9.5 4.5S5.1 16 2.5 13z" />
      <path d="M2.5 13c2.6 0 5.8-.7 9.5-.7s6.9.7 9.5.7" />
      <circle {...S} cx="12" cy="14.3" r="1.6" />
      <path d="M16.5 3.5h3l-3 3h3" />
    </>
  ),
  spacewalker: (
    <>
      <circle {...A} cx="14" cy="6.5" r="3.2" />
      <path d="M12.6 6.2h2.8" />
      <path {...A} d="M11 10.5h6l1 6h-2.5l-.5 4h-2.5l-.5-4H10z" />
      <path d="M11 12.5c-3 .5-5 2-6.5 4.5S2.5 21 2.5 21" strokeDasharray="1.6 1.6" />
    </>
  ),
  medKit: (
    <>
      <rect {...A} x="3" y="7" width="18" height="13" rx="2.2" />
      <path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7M12 10.5v6M9 13.5h6" />
    </>
  ),
  hatch: (
    <>
      <circle {...A} cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 7.5v9M7.5 12h9" />
    </>
  ),
  scrubber: (
    <>
      <rect {...A} x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M7.5 7.5h9M7.5 10.5h9M7.5 13.5h9" />
      <circle {...S} cx="16" cy="17.2" r="1" />
      <path d="M7.5 17.2h4" />
    </>
  ),
  waterTank: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="3" />
      <path {...A} d="M6 13c2-.8 4-.8 6 0s4 .8 6 0v5a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" />
      <path d="M10 3V1.5h4V3" />
    </>
  ),
  trophy: (
    <>
      <path {...A} d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4a3 3 0 0 0 3 4.2M17 6h3a3 3 0 0 1-3 4.2M12 14v3.5M8.5 20.5h7M9.5 17.5h5" />
    </>
  ),
  timeline: (
    <>
      <path d="M6 3v18" />
      <circle {...A} cx="6" cy="6" r="2" />
      <circle {...A} cx="6" cy="12" r="2" />
      <circle {...A} cx="6" cy="18" r="2" />
      <path d="M10.5 6h9M10.5 12h6M10.5 18h8" />
    </>
  ),
  camera: (
    <>
      <path {...A} d="M3.5 8.5a2 2 0 0 1 2-2h2l1.5-2.2h6L16.5 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.6" />
    </>
  ),
  cake: (
    <>
      <rect {...A} x="4" y="11" width="16" height="9.5" rx="2" />
      <path d="M4 15c2 1.5 4 1.5 5.3 0s4-1.5 5.4 0 4 1.5 5.3 0M12 7.5V11M12 3.5c-.9 1-.9 2.3 0 3 .9-.7.9-2 0-3z" />
    </>
  ),
  check: (
    <>
      <circle {...A} cx="12" cy="12" r="9" />
      <path d="M8 12.3l2.6 2.6L16.2 9" />
    </>
  ),
  // ----- offline support
  noSignal: (
    <>
      <rect {...A} x="15.5" y="6" width="3" height="12" rx="1" strokeOpacity={0.35} />
      <path d="M5 18v-2.5M9 18v-5M13 18v-7.5" />
      <path d="M3.5 4.5l17 15" />
    </>
  ),
  conjunction: (
    <>
      <circle {...A} cx="12" cy="12" r="3.4" />
      <path d="M12 5.5V7M12 17v1.5M7.4 7.4l1 1M15.6 15.6l1 1M16.6 7.4l-1 1M8.4 15.6l-1 1" />
      <circle {...S} cx="3.2" cy="12" r="1.7" />
      <circle cx="20.8" cy="12" r="1.7" />
    </>
  ),
  outbox: (
    <>
      <path {...A} d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5v5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5z" />
      <path d="M12 3.5v8.5M8.5 7L12 3.5 15.5 7" />
    </>
  ),
  defib: (
    <>
      <path {...A} d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.5a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z" />
      <path d="M12.9 9.6l-2.5 3.6h3.2l-2.5 3.6" />
    </>
  ),
  crewMedic: (
    <>
      <circle cx="9.5" cy="7.5" r="3.2" />
      <path {...A} d="M3.5 20c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2z" />
      <path d="M18.5 4.5v5M16 7h5" />
    </>
  ),
  report: (
    <>
      <rect {...A} x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8.5 7.5h7M8 14h2l1.4-3 2.1 6 1.4-3H16" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof ICONS;

export function Glyph({ name, className = "h-6 w-6" }: { name: GlyphName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={`glyph ${className}`} data-glyph={name} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export type GlyphTone = "sky" | "red" | "green" | "amber" | "violet" | "emerald";

const TONE: Record<GlyphTone, { tile: string; dot: string }> = {
  sky: { tile: "text-sky-300 from-sky-400/[0.16] ring-sky-300/20", dot: "bg-sky-300" },
  red: { tile: "text-rose-300 from-rose-400/[0.16] ring-rose-300/20", dot: "bg-rose-300" },
  green: { tile: "text-ok from-emerald-400/[0.16] ring-emerald-300/20", dot: "bg-ok" },
  emerald: { tile: "text-emerald-300 from-teal-400/[0.16] ring-teal-300/20", dot: "bg-teal-300" },
  amber: { tile: "text-amber-300 from-amber-400/[0.16] ring-amber-300/20", dot: "bg-amber-300" },
  violet: { tile: "text-violet-300 from-violet-400/[0.16] ring-violet-300/20", dot: "bg-violet-300" },
};

const SIZE = { sm: { box: "h-9 w-9 rounded-xl", icon: "h-5 w-5" }, md: { box: "h-12 w-12 rounded-2xl", icon: "h-6 w-6" }, lg: { box: "h-16 w-16 rounded-[20px]", icon: "h-8 w-8" } };

/** A glyph in a tinted tile with a small orbit dot. */
export function GlyphTile({ name, tone = "sky", size = "md", className = "" }: { name: GlyphName; tone?: GlyphTone; size?: keyof typeof SIZE; className?: string }) {
  const t = TONE[tone];
  const s = SIZE[size];
  return (
    <span className={`glyph-tile relative grid shrink-0 place-items-center bg-gradient-to-br to-white/[0.02] ring-1 ring-inset ${t.tile} ${s.box} ${className}`}>
      <Glyph name={name} className={s.icon} />
      <span className={`glyph-dot absolute right-1.5 top-1.5 h-1 w-1 rounded-full opacity-80 ${t.dot}`} aria-hidden="true" />
    </span>
  );
}

/** A small status dot in place of the 🟢🟡🔴 emojis. */
export function StatusDot({ status, className = "" }: { status: "NORMAL" | "WATCH" | "ACT"; className?: string }) {
  const c = status === "NORMAL" ? "bg-ok shadow-[0_0_0_3px_rgba(5,150,105,.16)]" : status === "WATCH" ? "bg-watch shadow-[0_0_0_3px_rgba(217,119,6,.16)]" : "bg-act shadow-[0_0_0_3px_rgba(220,38,38,.16)]";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${c} ${className}`} aria-hidden="true" />;
}
