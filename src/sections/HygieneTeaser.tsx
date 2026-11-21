import { GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { ShinyButton } from "@/components/ui/shiny-button";

/** The "Hygiene & sanitation" section on the main page: a button that opens #/hygiene. */
export default function HygieneTeaser() {
  return (
    <section id="hygiene" className="relative px-6 py-28 sm:px-12">
      <div className="mx-auto grid max-w-6xl items-center gap-12 rounded-3xl border border-white/10 bg-[#ffffff]/90 p-8 sm:p-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.35em] text-sky-300">Hygiene & sanitation</p>
          <h2 className="mb-5 max-w-[18ch] text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            A clean crew in a clean cabin.
          </h2>
          <p className="mb-8 max-w-[52ch] leading-relaxed text-white/65">
            One person's germs soon become everyone's. Track the daily routine and get a hygiene score tuned to your cabin.
          </p>
          <ShinyButton tone="emerald" className="h-12 w-48" onClick={() => (window.location.hash = "/hygiene")}>
            Open hygiene
          </ShinyButton>
        </div>
        <ul className="grid gap-3 text-sm text-white/75">
          {[
            ["soap", "Personal hygiene", "Hands, teeth, skin and clothes, day by day"],
            ["satellite", "Cabin sanitation", "Surfaces, galley, toilet, waste, water and mould"],
            ["gauge", "Your hygiene card", "A score out of 100, tuned to your cabin"],
            ["chat", "Hygiene assistant", "An offline chatbot that only talks clean"],
          ].map(([icon, title, body]) => (
            <li key={title} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <GlyphTile name={icon as GlyphName} tone="emerald" size="sm" />
              <span>
                <span className="block font-semibold text-white">{title}</span>
                <span className="text-white/55">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
