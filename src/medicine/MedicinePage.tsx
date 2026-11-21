import { useEffect } from "react";
import { Shell } from "@/live/LivePage";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { ChatPanel, type ChatScope } from "@/sections/Assistant";

/*
 * Space medicines (#/medicine): research by Nithin (team Mission 61:4). The text is adapted
 * from the Wikipedia article "Space medicine" (CC BY-SA 4.0); citation numbers were removed,
 * see the article for references. Opened from the "Space Medicines" card in the Modules tunnel.
 */

type Block = { name: string; paras: string[]; list?: string[]; sub?: { name: string; paras: string[] }[] };
type Part = { id: string; icon: GlyphName; title: string; lead?: string[]; blocks?: Block[]; list?: string[] };

/*
 * The quick view: a VITALS glyph, a one-line summary and a key number for each topic, drawn
 * from Nithin's text below. The full text stays one click away ("Read more").
 */
const QUICK: Record<string, { icon: GlyphName; summary: string; stat?: string }> = {
  "Blood clots": { icon: "drop", summary: "Blood can slow, even flow backwards, and clot in the neck veins.", stat: "First found on the ISS in 2020" },
  "Cardiac rhythms": { icon: "heart", summary: "The heart's rhythm can stumble, so crews are screened again and again.", stat: "Regular heart-rhythm checks" },
  "Decompression illness in spaceflight": { icon: "bubbles", summary: "Dropping to spacesuit pressure can fizz nitrogen out into the blood, like opening a soda.", stat: "Suit pressure: under ⅓ of normal" },
  "Decreased immune system functioning": { icon: "shield", summary: "The body's defences weaken, and sleeping viruses wake up.", stat: "T-cells don't multiply properly" },
  "Increased infection risk": { icon: "germ", summary: "Germs grow tougher and more dangerous in space.", stat: "Salmonella turned more virulent (2006)" },
  "Effects of fatigue": { icon: "battery", summary: "Tired crews make mistakes, and can't tell how tired they are.", stat: "Errors on critical tasks" },
  "Loss of balance": { icon: "spiral", summary: "Leaving and returning to gravity scrambles the sense of balance.", stat: "Anti-dizzy pills for the trip home" },
  "Loss of bone density": { icon: "bone", summary: "Without gravity, calcium leaks out of the bones.", stat: "3–4 months up → 2–3 years to rebuild" },
  "Loss of muscle mass": { icon: "dumbbell", summary: "Unused muscles waste away, even the heart.", stat: "2+ hours of exercise a day" },
  "Impairment of eyesight": { icon: "eye", summary: "Long missions can change the shape of the eye (SANS).", stat: "A major worry for Mars" },
  "Loss of mental abilities and risk of Alzheimer's disease": { icon: "brain", summary: "Spaceflight shifts the brain's position and structure.", stat: "Longer trips, bigger changes" },
  "Light therapy": { icon: "bulb", summary: "Coloured light resets the body clock: blue to wake, red for night.", stat: "Blue 470–490 nm · red under 600 nm" },
  Melatonin: { icon: "moon", summary: "The body's own sleep hormone helps crews fall asleep faster." },
  "Non-benzodiazepine sleep medicines (\"z-drugs\")": { icon: "pill", summary: "The most common sleep pills on the ISS, with less next-day grogginess.", stat: "Most dispensed on the ISS" },
  Benzodiazepines: { icon: "hourglass", summary: "Also used, but longer-acting ones can leave crews groggy in the morning." },
  Modafinil: { icon: "cup", summary: "A wakefulness medicine kept on board for when sleep fails." },
  "Space nursing": { icon: "nurse", summary: "Nursing care for space, which also teaches us about patients on Earth." },
};

/* Each part's headline and key numbers, shown before (or instead of) its paragraphs. */
const PART_FACTS: Record<string, { highlight: string; stats: { big: string; small: string }[] }> = {
  about: {
    highlight: "Keeping astronauts healthy where no ambulance can reach.",
    stats: [
      { big: "Aviation", small: "medicine it grew out of" },
      { big: "Prevention", small: "comes first, then acute and emergency care" },
      { big: "4 stressors", small: "g-force, microgravity, odd atmospheres, radiation" },
    ],
  },
  "in-flight": {
    highlight: "Sleep is the hardest thing to get right in orbit.",
    stats: [
      { big: "75%", small: "of ISS crew took sleep medicine in space" },
      { big: "52%", small: "of their nights, among those who did" },
      { big: "6 h", small: "average sleep, out of 8.5 h scheduled" },
    ],
  },
  training: {
    highlight: "Only three space medicine fellowships exist in the world.",
    stats: [
      { big: "3", small: "fellowships: UTHealth Houston, UCLA, Harvard" },
      { big: "13", small: "areas every programme should cover" },
    ],
  },
};

const PARTS: Part[] = [
  {
    id: "about",
    icon: "stethoscope",
    title: "What is space medicine?",
    lead: [
      "Space medicine is the application of medicine under conditions experienced during spaceflight. It developed from the aviation medicine specialty, and is a subspecialty of emergency medicine. Space medicine is dedicated to the prevention and treatment of medical conditions that would limit success in space operations. It focuses specifically on prevention, acute care, emergency medicine, wilderness medicine, and hyper/hypobaric medicine in order to provide medical care of astronauts and spaceflight participants.",
      "The spaceflight environment poses many unique stressors to the human body, including g-force, microgravity, unusual atmospheres such as low pressure or high carbon dioxide, and space radiation. These challenges are addressed by studying the physiological effects in space, and the application of preventive medicine, primary care, emergency medicine, acute care medicine, austere medicine, physical fitness, nutrition, public health, behavioral health, systems medicine, and toxicology, in order to inform vehicle design and mission plans, and to prevent and treat medical problems in space. This expertise is also used to inform vehicle systems design to minimize the risk to human health and performance while meeting mission objectives.",
      "Astronautical hygiene is the application of science and technology to the prevention or control of exposure to the hazards that may cause astronaut ill health. Both these sciences work together to ensure that astronauts work in a safe environment. Medical consequences such as possible visual impairment and bone loss have been associated with human spaceflight.",
      "In October 2015, the NASA Office of Inspector General issued a health hazards report related to space exploration, including a human mission to Mars.",
    ],
  },
  {
    id: "risks",
    icon: "warning",
    title: "Medical risks of spaceflight",
    blocks: [
      {
        name: "Blood clots",
        paras: [
          "Deep vein thrombosis of the internal jugular vein of the neck was first discovered in 2020 in an astronaut on a long-duration stay on the ISS, requiring treatment with blood thinners. A subsequent study of eleven astronauts found slowed blood flow in the neck veins, and even reversal of blood flow in two of the astronauts. NASA is conducting more research to study whether these abnormalities could predispose astronauts to blood clots.",
        ],
      },
      {
        name: "Cardiac rhythms",
        paras: [
          "Heart rhythm disturbances have been seen among astronauts. Most of these have been related to cardiovascular disease, but it is not clear whether this was due to pre-existing conditions or effects of spaceflight. It is hoped that advanced screening for coronary disease has greatly mitigated this risk. Other heart rhythm problems, such as atrial fibrillation, can develop over time, making periodic screening of crew members' heart rhythms necessary. Beyond these terrestrial heart risks, some concern exists that prolonged exposure to microgravity may lead to heart rhythm disturbances. Although this has not been observed to date, further surveillance is warranted.",
        ],
      },
      {
        name: "Decompression illness in spaceflight",
        paras: [
          "In space, astronauts use a spacesuit, essentially a self-contained individual spacecraft, to do spacewalks, or extravehicular activities (EVAs). Spacesuits are generally inflated with 100% oxygen at a total pressure that is less than a third of normal atmospheric pressure. Eliminating inert atmospheric components such as nitrogen allows the astronaut to breathe comfortably, but also to have the mobility to use their hands, arms and legs to complete the required work, which would be more difficult in a higher-pressure suit.",
          "After the astronaut dons the spacesuit, air is replaced by 100% oxygen in a process called a \"nitrogen purge\". To reduce the risk of decompression sickness, the astronaut must spend several hours \"pre-breathing\" at an intermediate nitrogen partial pressure, to let their body tissues outgas nitrogen slowly enough that bubbles are not formed. When the astronaut returns to the \"shirt-sleeve\" environment of the spacecraft after an EVA, pressure is restored to the spacecraft's operating pressure, generally normal atmospheric pressure. Decompression illness in spaceflight consists of decompression sickness (DCS) and other injuries due to uncompensated changes in pressure, or barotrauma.",
        ],
        sub: [
          {
            name: "Decompression sickness",
            paras: [
              "Decompression sickness is injury to the tissues of the body resulting from nitrogen bubbles in the tissues and blood. It occurs when a rapid reduction in ambient pressure causes dissolved nitrogen to come out of solution as gas bubbles within the body. In space, the risk of DCS is significantly reduced by washing out the nitrogen in the body's tissues: breathing 100% oxygen for a set period before donning the spacesuit, continued after a nitrogen purge. DCS may result from inadequate or interrupted pre-oxygenation time, or other factors including the astronaut's hydration, physical conditioning, prior injuries and age. Other risks include an inadequate nitrogen purge in the suit, a strenuous or excessively long EVA, or a loss of suit pressure. Non-EVA crew members may also be at risk if there is a loss of cabin pressure.",
              "Symptoms of DCS in space may include chest pain, shortness of breath, cough or pain with a deep breath, unusual fatigue, light-headedness, dizziness, headache, unexplained musculoskeletal pain, tingling or numbness, weakness in the arms or legs, or visual abnormalities.",
              "The main treatments are repressurizing the suit to re-dissolve the nitrogen bubbles, 100% oxygen to re-oxygenate the tissues, and hydration to improve circulation to injured tissues.",
            ],
          },
          {
            name: "Barotrauma",
            paras: [
              "Barotrauma is injury to the tissues of air-filled spaces in the body, caused by differences in pressure between those spaces and the surrounding atmosphere. Air-filled spaces include the middle ears, paranasal sinuses, lungs and gastrointestinal tract. An upper respiratory infection, nasal allergies, repeated pressure changes, dehydration or a poor equalizing technique make it more likely.",
              "Positive pressure in the air-filled spaces results from reduced barometric pressure during the depressurization phase of an EVA. It can cause abdominal distension, ear or sinus pain, decreased hearing, and dental or jaw pain. Abdominal distension can be treated by extending the abdomen, gentle massage and passing gas. Ear and sinus pressure can be relieved by passively releasing the positive pressure. Pretreatment for susceptible people can include oral and nasal decongestants, or oral and nasal steroids.",
              "Negative pressure in air-filled spaces results from increased barometric pressure during repressurization after an EVA, or after a planned restoration of a reduced cabin pressure. Common symptoms include ear or sinus pain, decreased hearing, and tooth or jaw pain. Treatment may include active positive-pressure equalization of the ears and sinuses, oral and nasal decongestants, or oral and nasal steroids, and appropriate pain medication if needed.",
            ],
          },
        ],
      },
      {
        name: "Decreased immune system functioning",
        paras: [
          "Astronauts in space have weakened immune systems, which means that, in addition to increased vulnerability to new exposures, viruses already present in the body, which would normally be suppressed, become active. In space, T-cells do not reproduce properly, and the cells that do exist are less able to fight off infection. NASA research is measuring the change in its astronauts' immune systems, as well as performing experiments with T-cells in space.",
          "In March 2019, NASA reported that latent viruses in humans may be activated during space missions, possibly adding more risk to astronauts on future deep-space missions.",
        ],
      },
      {
        name: "Increased infection risk",
        paras: [
          "A 2006 Space Shuttle experiment found that Salmonella typhimurium, a bacterium that can cause food poisoning, became more virulent when grown in space. In April 2013, NASA-funded scientists at Rensselaer Polytechnic Institute reported that, on the ISS, microbes seem to adapt to the space environment in ways \"not observed on Earth\" that \"can lead to increases in growth and virulence\". In 2017, bacteria were found to be more resistant to antibiotics and to thrive in the near-weightlessness of space. Microorganisms have been observed to survive the vacuum of outer space.",
          "In 2018, after detecting five strains of Enterobacter bugandensis bacteria on the ISS, none of them harmful to humans, researchers reported that microorganisms on the ISS should be carefully monitored to keep the environment medically healthy for astronauts.",
        ],
      },
      {
        name: "Effects of fatigue",
        paras: [
          "Human spaceflight often requires crews to endure long periods without rest. Studies have shown that lack of sleep can cause fatigue that leads to errors while performing critical tasks, and fatigued people often cannot judge how impaired they are. Astronauts and ground crews frequently suffer from sleep deprivation and circadian rhythm disruption. Fatigue due to sleep loss, sleep shifting and work overload could cause performance errors that put spaceflight participants at risk of compromising mission objectives, as well as the health and safety of those on board.",
        ],
      },
      {
        name: "Loss of balance",
        paras: [
          "Leaving and returning to Earth's gravity causes \"space sickness\", dizziness and loss of balance in astronauts. By studying how changes affect balance in the body (the senses, the brain, the inner ear and blood pressure), NASA hopes to develop treatments that can be used on Earth and in space to correct balance disorders. Until then, NASA's astronauts rely on a medication called midodrine (an \"anti-dizzy\" pill that temporarily increases blood pressure) and/or promethazine to help them carry out the tasks they need to return home safely.",
        ],
      },
      {
        name: "Loss of bone density",
        paras: [
          "Spaceflight osteopenia is the bone loss associated with human spaceflight. Calcium metabolism is limited in microgravity, which causes calcium to leak out of the bones. After a 3–4 month trip into space, it takes about 2–3 years to regain the lost bone density. New techniques are being developed to help astronauts recover faster. Research in these areas may help grow new bone:",
        ],
        list: ["Diet and exercise changes may reduce osteoporosis.", "Vibration therapy may stimulate bone growth.", "Medication could trigger the body to produce more of the protein responsible for bone growth and formation."],
      },
      {
        name: "Loss of muscle mass",
        paras: [
          "In space, muscles in the legs, back, spine and heart weaken and waste away because they are no longer needed to overcome gravity, just as people lose muscle as they age through reduced physical activity. Astronauts rely on research in these areas to build muscle and maintain body mass:",
        ],
        list: ["Exercise may build muscle if at least two hours a day are spent on resistance training.", "Neuromuscular electrical stimulation as a way to prevent muscle atrophy."],
      },
      {
        name: "Impairment of eyesight",
        paras: [
          "During long spaceflight missions, astronauts may develop eye changes and visual impairment known together as Spaceflight Associated Neuro-ocular Syndrome (SANS). These vision problems may be a major concern for future deep-space missions, including a human mission to Mars.",
        ],
      },
      {
        name: "Loss of mental abilities and risk of Alzheimer's disease",
        paras: [
          "On December 31, 2012, a NASA-supported study reported that human spaceflight may harm astronauts' brains and accelerate the onset of Alzheimer's disease.",
          "On November 2, 2017, scientists reported significant changes in the position and structure of the brain in astronauts who had travelled in space, based on MRI studies. Longer space trips were associated with greater brain changes.",
        ],
      },
    ],
  },
  {
    id: "in-flight",
    icon: "pill",
    title: "Medicine in flight: sleep",
    lead: [
      "The use of sleep medicines is widespread among astronauts: one 10-year study found that 75% of ISS crew members and 78% of space shuttle crew members reported taking them in space, on 52% of their nights. NASA allows 8.5 hours of downtime for sleep each day aboard the ISS, but astronauts average only 6 hours of sleep. Poor sleep can compromise the crew's daytime performance and attentiveness, so improving sleep has been a topic of NASA-funded research for more than half a century. These strategies have been studied for sleep in space:",
    ],
    blocks: [
      {
        name: "Light therapy",
        paras: [
          "Exposure to visible light at different intensities and wavelengths can set the body clock (circadian rhythm), and is a key topic of NASA-funded research. Photoreceptors in the eye, such as melanopsin, rhodopsin and photopsin, signal the brain's master circadian pacemaker (the suprachiasmatic nucleus). Melanopsin is most sensitive to blue light, around 470–490 nm. NASA has installed rhythmic light panels on the ISS to help set astronauts' circadian rhythms, and plans to test more advanced panels that change intensity and colour through the day: red-tinted light (under 600 nm) at 'night' for visibility, and brighter, shorter-wavelength light in the 'morning' or when alertness is needed.",
        ],
      },
      {
        name: "Melatonin",
        paras: ["Melatonin, a natural hormone made by the pineal gland, has shown positive effects in reducing the time it takes to fall asleep in orbit."],
      },
      {
        name: "Non-benzodiazepine sleep medicines (\"z-drugs\")",
        paras: [
          "Zolpidem, zopiclone and zaleplon are the most commonly dispensed medicines on the ISS. Despite their wide use, relatively little research has been done on them in spaceflight. Earlier research suggests they may cause less next-day impairment than most benzodiazepines, and the shortest-acting, zaleplon, causes little or no cognitive impairment at clinical doses even when taken an hour before waking. Because astronauts often take a second dose in the night, their shorter action may suit middle-of-the-night use.",
        ],
      },
      {
        name: "Benzodiazepines",
        paras: [
          "Benzodiazepines are often used in space, though less often than z-drugs. Longer-acting ones such as temazepam have been called \"non-ideal\" for spaceflight because they tend to cause impairment the next morning.",
        ],
      },
      {
        name: "Modafinil",
        paras: [
          "Modafinil, a wakefulness medicine, is available on the space station to reduce the harmful effects of sleep disruption and \"optimise performance while fatigued\". It has restored cognitive function to baseline after total sleep deprivation in studies on Earth, though no studies have looked at its effects in astronauts.",
        ],
      },
    ],
  },
  {
    id: "training",
    icon: "cap",
    title: "Training in space medicine",
    lead: [
      "There are currently only three fellowships in space medicine: at the University of Texas at Houston, UCLA and Harvard. Aerospace medicine offers similar preventive-medicine training pathways. These training programmes should include:",
    ],
    list: [
      "Acute care medicine",
      "Commercial spaceflight training",
      "Flight medicine",
      "Interventional radiology procedures",
      "Human life support systems for space",
      "Emergency medicine",
      "Aerospace studies",
      "Global health",
      "Hyperbaric and hypobaric medicine",
      "Public health",
      "Disaster medicine",
      "Prehospital medicine",
      "Wilderness and extreme medicine",
    ],
    blocks: [
      {
        name: "Space nursing",
        paras: ["Space nursing is the nursing specialty that studies how space travel affects human response patterns. Like space medicine, it also adds to knowledge about nursing care of patients on Earth."],
      },
    ],
  },
];

/** A compact card: glyph, title, one-line summary, key number, and the full text behind "Read more". */
function Card({ b }: { b: Block }) {
  const q = QUICK[b.name];
  return (
    <div className="flex flex-col rounded-3xl border border-white/10 bg-[#ffffff]/95 p-6 transition-colors hover:border-white/20">
      {q && (
        <GlyphTile name={q.icon} tone="violet" className="mb-4" />
      )}
      <h3 className="text-lg font-semibold leading-snug text-white">{b.name}</h3>
      {q && <p className="mt-2 text-[15px] leading-relaxed text-white/75">{q.summary}</p>}
      {q?.stat && (
        <p className="mt-4 w-fit rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">{q.stat}</p>
      )}
      <details className="group mt-4 border-t border-white/10 pt-3 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer select-none items-center gap-1.5 text-sm font-medium text-sky-300 hover:text-sky-200">
          <span className="transition-transform group-open:rotate-90" aria-hidden="true">
            ›
          </span>
          <span className="group-open:hidden">Read more</span>
          <span className="hidden group-open:inline">Show less</span>
        </summary>
        <FullText b={b} />
      </details>
    </div>
  );
}

function FullText({ b }: { b: Block }) {
  return (
    <>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/65">
        {b.paras.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
        {b.list && (
          <ul className="list-disc space-y-1 pl-5">
            {b.list.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>
      {b.sub && (
        <div className="mt-5 space-y-4">
          {b.sub.map((s) => (
            <div key={s.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="font-semibold text-white">{s.name}</h4>
              <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-white/65">
                {s.paras.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** A part's headline and big numbers, with its full introduction one click away. */
function PartIntro({ p }: { p: Part }) {
  const f = PART_FACTS[p.id];
  if (!f) return null;
  return (
    <div className="mb-10 space-y-6">
      <p className="max-w-3xl text-2xl font-medium leading-snug text-white/90 sm:text-3xl">{f.highlight}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {f.stats.map((s) => (
          <div key={s.small} className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-400/[0.08] to-transparent p-6">
            <p className="text-4xl font-bold tracking-tight text-white">{s.big}</p>
            <p className="mt-1.5 text-sm text-white/60">{s.small}</p>
          </div>
        ))}
      </div>
      {p.lead && (
        <details className="group max-w-3xl [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex w-fit cursor-pointer select-none items-center gap-1.5 text-sm font-medium text-sky-300 hover:text-sky-200">
            <span className="transition-transform group-open:rotate-90" aria-hidden="true">
              ›
            </span>
            <span className="group-open:hidden">Read the full notes</span>
            <span className="hidden group-open:inline">Show less</span>
          </summary>
          <div className="mt-3 space-y-4 text-[16px] leading-relaxed text-white/70">
            {p.lead.map((l) => (
              <p key={l.slice(0, 40)}>{l}</p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/* The Space Medicines chatbot: answers only from knowledge/space-medicine.md (Nithin's research). */
const MEDICINE_SCOPE: ChatScope = {
  name: "Space medicine assistant",
  inputId: "medicine-input",
  placeholder: "Ask about space medicine…",
  hello: (
    <>
      Hi, I'm the space medicine assistant. Ask me how spaceflight affects the body and how doctors deal with it: blood
      clots, decompression sickness, bone and muscle loss, eyesight, the immune system, or the sleep medicines astronauts
      use. I share general information from the VITALS research library, not medical advice.
    </>
  ),
  suggestions: ["What is space medicine?", "Can astronauts get blood clots?", "What is decompression sickness?", "Do astronauts take sleeping pills?", "How much bone do astronauts lose?", "What is SANS?"],
  followUps: ["What is space medicine?", "Why is the immune system weaker in space?", "How is decompression sickness treated?", "How do doctors train in space medicine?", "How do you do CPR in weightlessness?", "Do medicines expire faster in space?", "Has anyone been evacuated from space for a medical reason?"],
  unknownText:
    "I only cover space medicine, and I don't have that in my library yet. Try one of these. For an injury or symptom, use the main VITALS assistant, and if it's serious, tell the commander and contact the flight surgeon.",
  library: (p) => p.id.startsWith("space-medicine#") || p.id.startsWith("space-medicine-deep#"),
  topics: [],
  tone: "violet",
  avatar: "stethoscope",
  greet: "Hi! I'm the space medicine assistant. Ask me how spaceflight affects the body, like blood clots, the bends, bone loss or sleep in orbit.",
};

export default function MedicinePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Shell
      eyebrow="Space medicines"
      title="Medicine, far from any hospital."
      intro="When the nearest hospital is a rocket ride away, medicine flies with the crew."
      back={{ label: "Back to VITALS" }}
    >
      <nav aria-label="Topics" className="-mt-4 mb-16 flex flex-wrap gap-2">
        {PARTS.map((p) => (
          <a
            key={p.id}
            href="#/medicine"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(`med-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:border-primary/60 hover:text-white"
          >
            <Glyph name={p.icon} className="h-4 w-4 text-violet-300" /> {p.title}
          </a>
        ))}
      </nav>

      <div className="space-y-24">
        {PARTS.map((p) => (
          <section key={p.id} id={`med-${p.id}`} className="scroll-mt-8">
            <h2 className="mb-6 flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              <GlyphTile name={p.icon} tone="violet" size="lg" /> {p.title}
            </h2>
            {PART_FACTS[p.id] ? (
              <PartIntro p={p} />
            ) : (
              p.lead && (
                <div className="mb-8 max-w-3xl space-y-4 text-lg leading-relaxed text-white/70">
                  {p.lead.map((l) => (
                    <p key={l.slice(0, 40)}>{l}</p>
                  ))}
                </div>
              )
            )}
            {p.list && (
              <ul className="mb-8 flex flex-wrap gap-2">
                {p.list.map((l) => (
                  <li key={l} className="rounded-full border border-white/15 bg-white/[0.03] px-3.5 py-1.5 text-sm text-white/75">
                    {l}
                  </li>
                ))}
              </ul>
            )}
            {p.blocks && (
              <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {p.blocks.map((b) => (
                  <Card key={b.name} b={b} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <section id="med-assistant" className="mt-24 grid scroll-mt-8 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <h2 className="mb-4 flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            <GlyphTile name="chat" tone="violet" size="lg" /> Ask about space medicine
          </h2>
          <p className="max-w-[46ch] leading-relaxed text-white/65">
            Blood clots, the bends, sleeping pills in orbit, bone loss. Ask anything from the research library.
          </p>
        </div>
        <ChatPanel scope={MEDICINE_SCOPE} />
      </section>

      <div className="mt-24 space-y-2 border-t border-white/10 pt-6 text-sm text-white/50">
        <p>
          Research by team Mission 61:4.
        </p>
        <p>
          Text adapted from the Wikipedia article{" "}
          <a href="https://en.wikipedia.org/wiki/Space_medicine" target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
            "Space medicine"
          </a>
          , licensed under{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
            CC BY-SA 4.0
          </a>
          . Lightly edited, with citation numbers removed: see the article for its references.
        </p>
        <p>General information, not medical advice. On a mission, medicines are only used as the flight surgeon directs.</p>
      </div>
    </Shell>
  );
}
