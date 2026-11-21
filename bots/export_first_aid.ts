/*
 * Exports the website's first-aid topics (src/lib/firstAid.ts) to bots/first_aid.json,
 * so the offline support bot uses exactly the team's wording.
 * Steps that mention medicine are dropped: the bots never suggest medicine.
 *
 * Run from the project folder:
 *   npx esbuild bots/export_first_aid.ts --bundle --platform=node --outfile=bots/.export.cjs "--define:import.meta.glob=__noGlob" "--banner:js=const __noGlob=()=>({});" && node bots/.export.cjs
 */
import { writeFileSync } from "node:fs";
import { TOPICS } from "../src/lib/firstAid";

const MEDICINE = /\b(medicine|medication|painkiller|tablet|pill|dose|drug|ibuprofen|paracetamol|aspirin|antihistamine|cream|ointment|electrolyte)s?\b/i;

const topics = TOPICS.map((t) => ({
  id: t.id,
  title: t.title,
  keywords: t.keywords,
  steps: t.steps.filter((s) => !MEDICINE.test(s)),
  getHelp: t.getHelp,
}));

writeFileSync("bots/first_aid.json", JSON.stringify({ source: "src/lib/firstAid.ts", topics }, null, 2) + "\n", "utf8");
console.log(`exported ${topics.length} topics`);
