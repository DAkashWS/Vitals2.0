import { useEffect } from "react";
import { Shell } from "@/live/LivePage";
import { Glyph, GlyphTile, type GlyphName } from "@/components/ui/glyph";
import { ChatPanel, SCHOOL_MIN_SCORE, type ChatScope } from "@/sections/Assistant";

/*
 * School medicines (#/medicine): how schools keep students with health conditions safe, the
 * rules for giving medicines at school, and first aid for the most common emergencies.
 * Opened from the "School medicines" card. The chatbot below is unchanged.
 */

type Block = { name: string; paras: string[]; list?: string[]; sub?: { name: string; paras: string[] }[] };
type Part = { id: string; icon: GlyphName; title: string; lead?: string[]; blocks?: Block[]; list?: string[] };

/* The quick view: a VITALS glyph, a one-line summary and a key fact for each topic. */
const QUICK: Record<string, { icon: GlyphName; summary: string; stat?: string }> = {
  Asthma: { icon: "lungs", summary: "The most common long-term condition in school. The reliever inhaler must always be close by.", stat: "Inhaler stays with the student" },
  "Severe allergies (anaphylaxis)": { icon: "warning", summary: "A life-threatening reaction to food, stings or medicines. Adrenaline first, then call an ambulance.", stat: "Every second counts" },
  "Type 1 diabetes": { icon: "bloodCell", summary: "Students check blood sugar and take insulin during the day, and need snacks and toilet access any time.", stat: "Low sugar: sugar first, then help" },
  Epilepsy: { icon: "brain", summary: "Most seizures stop on their own. Keep the student safe, time it, and stay with them.", stat: "Over 5 minutes: call an ambulance" },
  "Fever, vomiting and diarrhoea": { icon: "thermometer", summary: "Infections spread fast in classrooms. Sick students go home and stay home until they're well.", stat: "48 h after the last episode" },
  "Headaches and period pain": { icon: "head", summary: "Very common reasons for a trip to the nurse. Often helped by water, food and rest.", stat: "Pain relief only with consent" },
  "Written consent": { icon: "clipboard", summary: "No medicine is given at school without a parent or carer's written permission.", stat: "Signed form on file" },
  "Original packaging": { icon: "pill", summary: "Medicines arrive in the pharmacy box, with the student's name, dose and instructions on the label.", stat: "Check the expiry date" },
  "Record every dose": { icon: "notepad", summary: "Each dose is written down: what, how much, when and who gave it.", stat: "Stops double doses" },
  "Never share medicines": { icon: "shield", summary: "A medicine that helps one student can harm another. Never give or take someone else's.", stat: "No aspirin under 16" },
  "Safe storage": { icon: "lockDoor", summary: "Most medicines are locked away, but emergency ones must be reachable in seconds.", stat: "Inhalers and adrenaline: never locked" },
  "CPR and defibrillators": { icon: "defib", summary: "If someone collapses and isn't breathing normally, call for help, start chest compressions and send for the defibrillator.", stat: "Push hard, push fast" },
  Choking: { icon: "warning", summary: "If they can't cough, speak or breathe: up to 5 back blows, then up to 5 abdominal thrusts, and call for help.", stat: "Call an ambulance if it doesn't clear" },
  Nosebleeds: { icon: "drop", summary: "Sit up, lean forward, and pinch the soft part of the nose for 10 to 15 minutes.", stat: "Don't tip the head back" },
  Burns: { icon: "flame", summary: "Cool the burn under cool running water for 20 minutes, then cover loosely with cling film.", stat: "20 minutes of cool water" },
  "Cuts and grazes": { icon: "medKit", summary: "Wear gloves, press on bleeding, clean the wound and cover it with a plaster or dressing.", stat: "Deep or gaping: needs a doctor" },
};

/* Each part's headline and key facts, shown before its paragraphs. */
const PART_FACTS: Record<string, { highlight: string; stats: { big: string; small: string }[] }> = {
  about: {
    highlight: "A school is a small town. It needs its own health care.",
    stats: [
      { big: "Health plan", small: "for every student with a long-term condition" },
      { big: "First aiders", small: "trained staff on site all day, on trips too" },
      { big: "Parents", small: "told the same day about any injury or illness" },
    ],
  },
  rules: {
    highlight: "The right medicine, the right student, the right dose, the right time.",
    stats: [
      { big: "Consent", small: "in writing before any medicine is given" },
      { big: "Labelled", small: "pharmacy box with the student's name" },
      { big: "Recorded", small: "every dose, every time" },
    ],
  },
  "first-aid": {
    highlight: "Most school emergencies are over in minutes. What you do in those minutes matters.",
    stats: [
      { big: "Call", small: "for help early: shout, then phone emergency services" },
      { big: "AED", small: "know where the school defibrillator is" },
      { big: "Gloves", small: "on before touching blood or body fluids" },
    ],
  },
};

const PARTS: Part[] = [
  {
    id: "about",
    icon: "stethoscope",
    title: "Health care at school",
    lead: [
      "Children and teenagers spend a large part of their waking day at school, so schools need a plan for students who are unwell, injured, or living with a long-term health condition.",
      "A good school health plan names who is responsible (usually a school nurse or trained staff), keeps an individual health care plan for each student with a condition like asthma, allergies, diabetes or epilepsy, trains staff in first aid, and makes sure emergency medicines go wherever the student goes, including PE and school trips.",
      "Health care plans are written with the student, their parents and their doctor. They say what the condition is, what the daily needs are, what an emergency looks like, and exactly what to do.",
    ],
  },
  {
    id: "conditions",
    icon: "warning",
    title: "Common conditions at school",
    blocks: [
      {
        name: "Asthma",
        paras: [
          "Asthma makes the airways narrow and inflamed. Signs of an attack: coughing, wheezing, a tight chest and being short of breath.",
          "In an attack, help the student sit up straight, stay calm, and take their blue reliever inhaler (with a spacer if they have one) as their plan says. If they don't improve, are too breathless to talk, or you are worried, call an ambulance.",
        ],
      },
      {
        name: "Severe allergies (anaphylaxis)",
        paras: [
          "Common triggers at school are nuts, other foods, insect stings and latex. Signs include swelling of the lips, face or throat, difficulty breathing, wheezing, feeling faint, or collapse.",
          "Give the student's adrenaline auto-injector straight away, into the outer thigh, and call an ambulance saying \"anaphylaxis\". Lie them down with legs raised (or sitting up if breathing is hard). A second dose can be given after 5 minutes if there's no improvement.",
        ],
      },
      {
        name: "Type 1 diabetes",
        paras: [
          "Students with type 1 diabetes need insulin and regular blood sugar checks. Low blood sugar (a \"hypo\") can come on fast: shaky, sweaty, pale, confused or grumpy.",
          "For a hypo, give fast-acting sugar such as glucose tablets or a sugary drink, wait 10 to 15 minutes and recheck. Never send a student with a hypo anywhere alone.",
        ],
      },
      {
        name: "Epilepsy",
        paras: [
          "During a seizure, protect the student from injury: move hard objects away and cushion their head. Don't hold them down or put anything in their mouth. Time the seizure.",
          "When it stops, put them in the recovery position and stay with them until they are fully awake. Call an ambulance if the seizure lasts more than 5 minutes, if one seizure follows another, if they are injured, or if it's their first seizure.",
        ],
      },
      {
        name: "Fever, vomiting and diarrhoea",
        paras: [
          "Infections such as flu, colds and stomach bugs spread quickly between students. A student who is clearly unwell, has a high temperature, or is vomiting should go home.",
          "A common school rule is to stay home until 48 hours after the last episode of vomiting or diarrhoea, to stop the bug spreading round the class.",
        ],
      },
      {
        name: "Headaches and period pain",
        paras: [
          "Many headaches at school come from not drinking enough, skipping breakfast, poor sleep or eye strain. Water, a snack and a short rest often help.",
          "Period pain is common in teenagers. A warm pack, gentle movement and pain relief (only with parent consent) can help. Severe pain that stops a student from going to school should be checked by a doctor.",
        ],
      },
    ],
  },
  {
    id: "rules",
    icon: "pill",
    title: "Giving medicines safely",
    blocks: [
      { name: "Written consent", paras: ["Schools should only give a medicine when a parent or carer has asked in writing, and the form says the medicine, dose, time and how to give it."] },
      { name: "Original packaging", paras: ["Medicines should come in the original pharmacy container with the student's name and dosage instructions. Staff check the label and the expiry date before every dose."] },
      { name: "Record every dose", paras: ["Each dose is recorded with the date, time, amount and the name of the staff member who gave it. This prevents missed or double doses and helps parents and doctors."] },
      {
        name: "Never share medicines",
        paras: ["Students must never share medicines. Aspirin should not be given to anyone under 16 unless a doctor prescribes it, because of the risk of a rare but serious illness called Reye's syndrome."],
      },
      {
        name: "Safe storage",
        paras: ["Medicines are stored safely, out of reach, and some in a fridge. Emergency medicines such as reliever inhalers and adrenaline auto-injectors are never locked away: they stay with the student or somewhere everyone knows."],
        list: ["Inhalers go to PE and on trips.", "Spare adrenaline auto-injectors are kept in a known place.", "Out-of-date medicines go back to parents."],
      },
    ],
  },
  {
    id: "first-aid",
    icon: "medKit",
    title: "First aid at school",
    lead: [
      "Every school should have trained first aiders, stocked first-aid kits, a defibrillator (AED), and a clear way to call for help. Students can learn the basics too: many lives are saved by whoever is nearest.",
    ],
    blocks: [
      { name: "CPR and defibrillators", paras: ["If someone collapses and is not breathing normally, call emergency services and start CPR: hard, fast chest compressions in the centre of the chest, about 100 to 120 a minute. Send someone for the defibrillator and follow its spoken instructions."] },
      { name: "Choking", paras: ["If a student can cough, encourage them to keep coughing. If they can't cough, speak or breathe, give up to 5 firm back blows between the shoulder blades, then up to 5 abdominal thrusts. Call an ambulance if it doesn't clear."] },
      { name: "Nosebleeds", paras: ["Sit the student down, lean them forward, and pinch the soft part of the nose just above the nostrils for 10 to 15 minutes. Tipping the head back makes them swallow blood. Get help if it lasts over 20 minutes."] },
      { name: "Burns", paras: ["Cool the burn under cool or lukewarm running water for 20 minutes. Remove jewellery or clothing near it unless stuck. Cover with cling film or a clean plastic bag. Don't use ice, creams or butter. Large, deep or face burns need a hospital."] },
      { name: "Cuts and grazes", paras: ["Put on gloves. Press on the wound with a clean pad to stop bleeding, rinse with clean water, and cover with a plaster or dressing. Deep, gaping or dirty wounds, or bleeding that won't stop, need medical help."] },
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

const MEDICINE_SCOPE: ChatScope = {
  name: "School medicine assistant",
  inputId: "medicine-input",
  placeholder: "Ask about medicines, asthma, allergies or first aid…",
  tone: "violet",
  avatar: "stethoscope",
  hello: (
    <>
      Hi, I'm the school medicine assistant. Ask me how schools give medicines safely, what to do in an asthma attack or anaphylaxis, how to help with a hypo or a seizure, or basic first aid like burns, nosebleeds and CPR. General information, not medical advice.
    </>
  ),
  greet: "Hi! I'm the school medicine assistant. Ask me about medicines at school, long-term conditions and first aid.",
  suggestions: ["Can a school give my child medicine?", "What should I do in an asthma attack?", "How do I use an EpiPen?", "What do I do if a diabetic student has a hypo?", "What should I do during a seizure?", "How do I do CPR?"],
  followUps: ["Can children take aspirin?", "Where are medicines kept at school?", "What is an individual health care plan?", "When should a sick child stay home?", "How do I treat a burn?", "What should I do for a nosebleed?", "What do I do if someone is choking?"],
  unknownText:
    "I only cover school medicines and first aid, and I don't have that in my library yet. Try one of these. In an emergency, call your local emergency number and get a first aider.",
  library: (p) => p.id.startsWith("school-medicines#"),
  minScore: SCHOOL_MIN_SCORE,
  topics: [],
};

export default function MedicinePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Shell
      eyebrow="School medicines"
      title="Health care, between lessons."
      intro="Inhalers, allergy pens, a fever in maths, a fall at break. Here's how a school keeps every student safe."
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
            <GlyphTile name="chat" tone="violet" size="lg" /> Ask about school medicines
          </h2>
          <p className="max-w-[46ch] leading-relaxed text-white/65">
            Medicine rules, asthma, allergies, diabetes, seizures and first aid. Ask the school medicine assistant.
          </p>
        </div>
        <ChatPanel scope={MEDICINE_SCOPE} />
      </section>

      <div className="mt-24 space-y-2 border-t border-white/10 pt-6 text-sm text-white/50">
        <p>School health guidance by team VITALS.</p>
        <p>
          General information, not medical advice. Always follow the student's own health care plan, your school's policy
          and local first-aid training. In an emergency, call your local emergency number.
        </p>
      </div>
    </Shell>
  );
}
