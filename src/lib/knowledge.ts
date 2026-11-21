/*
 * The VITALS knowledge library: offline search over the Markdown files in /knowledge.
 *
 * Every "## " section of every file is one passage. Vite bundles the files into
 * the site at build time, so searching needs no internet and no AI model. The
 * search is BM25 (the classic keyword-ranking method used by search engines),
 * with a light word-ending trim so "sleeping" finds "sleep".
 *
 * To add knowledge, add or edit files in /knowledge (see knowledge/README.md).
 */

export type Passage = {
  id: string;
  /** The file's title, e.g. "Fluid shift and vision". */
  title: string;
  /** Where the information comes from, e.g. "NASA Human Research Program". */
  source: string;
  /** The section heading, e.g. "Why does my face look puffy in space?". */
  heading: string;
  text: string;
};

export type Hit = Passage & { score: number };

const files = import.meta.glob("../../knowledge/*.md", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

function parseFile(path: string, raw: string): Passage[] {
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  if (name.toLowerCase() === "readme") return [];
  let body = raw.replace(/\r\n/g, "\n");
  let title = name.replace(/[-_]/g, " ");
  let source = "VITALS library";
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    for (const line of fm[1].split("\n")) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m?.[1] === "title") title = m[2].trim();
      if (m?.[1] === "source") source = m[2].trim();
    }
    body = body.slice(fm[0].length);
  }
  return body
    .split(/^## +/m)
    .slice(1)
    .map((chunk, i) => {
      const [heading, ...rest] = chunk.split("\n");
      return { id: `${name}#${i}`, title, source, heading: heading.trim(), text: rest.join(" ").replace(/\s+/g, " ").trim() };
    })
    .filter((p) => p.heading && p.text);
}

export const PASSAGES: Passage[] = Object.entries(files).flatMap(([path, raw]) => parseFile(path, raw));

const STOP = new Set(
  (
    "a an and are as at be been but by can could do does did for from had has have how i i'm im if in into is it its " +
    "it's me my of on or our so than that the their them then there these they this to too up us was we were what " +
    "when where which who why will with would you your yours about after all also am any because before being both " +
    "each few get got just more most no not now off once only other out over own same should some such very " +
    "while tell please know want need help hi feel feels feeling felt really thing things keep kept still always " +
    "lot lots bit little quite hurt hurts hurting pain pains painful ache aches sore killing bad"
  ).split(" "),
);

/** Words people use that mean the same thing as a word in the library. Applied after stemming. */
const SYNONYMS: Record<string, string> = {
  difficulty: "hard",
  difficult: "hard",
  trouble: "hard",
  struggle: "hard",
  struggl: "hard",
  cant: "hard",
  cannot: "hard",
  unable: "hard",
  insomnia: "sleep",
  asleep: "sleep",
  sleepless: "sleep",
  slept: "sleep",
  sleepy: "sleep",
  lonely: "lonely",
  homesick: "lonely",
  loneliness: "lonely",
  sad: "mood",
  depressed: "mood",
  anxious: "stress",
  anxiety: "stress",
  stressed: "stress",
  eyesight: "vision",
  sight: "vision",
  blurry: "vision",
  drink: "water",
  thirst: "thirsty",
  dehydrat: "thirsty",
  eat: "food",
  meal: "food",
  bath: "clean",
  shower: "clean",
  wash: "clean",
  carbon: "co2",
  dioxide: "co2",
  doctor: "surgeon",
  weightless: "microgravity",
  zero: "microgravity",
  dizzy: "wobbly",
  unsteady: "wobbly",
  balance: "wobbly",
  loud: "noise",
  noisy: "noise",
  throw: "vomit",
  puke: "vomit",
  vomiting: "vomit",
  sickness: "sick",
  nausea: "sick",
  nauseous: "sick",
  queasy: "sick",
  bends: "decompression",
  bend: "decompression",
  scared: "stress",
  afraid: "stress",
  worried: "stress",
  nervous: "stress",
};

/** Light stemming: enough to match "sleeping"/"sleep", "bones"/"bone", "shifted"/"shift". */
export function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ied")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es") && /(ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => SYNONYMS[w] ?? SYNONYMS[stem(w)] ?? stem(w));
}

/* Build the index once. The heading counts twice: it says what the passage is about. */
const DOCS = PASSAGES.map((p) => {
  const head = tokens(p.heading);
  const toks = [...head, ...head, ...tokens(p.title), ...tokens(p.text)];
  const tf = new Map<string, number>();
  for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
  return { p, tf, len: toks.length, head: new Set(head) };
});
const AVG_LEN = DOCS.reduce((n, d) => n + d.len, 0) / Math.max(DOCS.length, 1);
const DF = new Map<string, number>();
for (const d of DOCS) for (const t of d.tf.keys()) DF.set(t, (DF.get(t) ?? 0) + 1);
const idf = (t: string) => {
  const df = DF.get(t) ?? 0;
  return Math.log(1 + (DOCS.length - df + 0.5) / (df + 0.5));
};

/** Minimum score for a passage to count as an answer. Tuned on the starter library. */
export const MIN_SCORE = 4.5;

/** A passage this strong is shown even under first-aid steps (weaker ones only when nothing else matched). */
export const STRONG_SCORE = 6;

/** Extra score when the question's words appear in a passage's heading (the heading is the question it answers). */
const HEADING_BONUS = 4;

/** The best matching passages for a question, best first. Empty when nothing is relevant enough. */
export function searchKnowledge(query: string, limit = 3, only?: (p: Passage) => boolean): Hit[] {
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const k1 = 1.2;
  const b = 0.75;
  const scored = (only ? DOCS.filter((d) => only(d.p)) : DOCS).map(({ p, tf, len, head }) => {
    let score = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      score += idf(t) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * len) / AVG_LEN)));
    }
    if (score > 0) score += HEADING_BONUS * (q.filter((t) => head.has(t)).length / q.length);
    return { ...p, score };
  })
    .filter((h) => h.score >= MIN_SCORE)
    .sort((a, b2) => b2.score - a.score);
  if (!scored.length) return [];
  // Keep only passages close to the best one, so a weak side-match doesn't tag along.
  return scored.filter((h) => h.score >= scored[0].score * 0.6).slice(0, limit);
}
