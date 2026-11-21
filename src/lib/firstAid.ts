/*
 * Offline first-aid assistant: rule-based, no AI and no internet.
 *
 * Questions that aren't first aid are answered from the knowledge library
 * (knowledge.ts and the /knowledge folder). Red flags always win.
 *
 * It matches what the astronaut types against keyword lists and answers with
 * general first-aid steps (based on standard guidance such as NHS and Red Cross
 * first aid, adapted for a spacecraft). It is decision support, not a diagnosis:
 * every answer says when to contact the flight surgeon, and red-flag symptoms
 * skip straight to "get help now".
 *
 * Vishnu / Nithin: edit or add topics here. Keep advice general, and keep the
 * "Get help if" list on every topic.
 */

import { stem } from "@/lib/knowledge";

export type Topic = {
  id: string;
  title: string;
  keywords: string[];
  steps: string[];
  getHelp: string[];
  spaceNote?: string;
};

export type Reply =
  | { kind: "urgent"; title: string; steps: string[]; matched: string }
  | { kind: "advice"; topics: Topic[] }
  | { kind: "chat"; text: string }
  | { kind: "followup"; title: string; text: string; urgent?: boolean }
  | { kind: "unknown" };

export type AskOption = { label: string; say: string; urgent?: boolean };
export type Ask = { q: string; options: AskOption[] };

const FLIGHT_SURGEON = "contact the flight surgeon";

/* Red flags: anything here skips normal advice. */
/*
 * `match`: phrases. `together`: groups of words that, all appearing anywhere in the
 * message, also count ("my chest feels really tight" → chest + tight).
 */
const RED_FLAGS: { match: string[]; together?: string[][]; title: string; steps: string[] }[] = [
  {
    match: ["chest pain", "chest tight", "chest pressure", "pain in my chest", "heart attack", "tight chest"],
    together: [["chest", "pain"], ["chest", "tight"], ["chest", "hurt"], ["chest", "pressure"], ["chest", "ache"], ["chest", "heavy"], ["chest", "crushing"]],
    title: "Chest pain can be serious",
    steps: [
      "Stop all activity and stay still. Anchor yourself.",
      "Tell the commander now, and " + FLIGHT_SURGEON + " immediately.",
      "Record heart rate and SpO2 if you can.",
      "Follow the medical kit's chest-pain procedure as the flight surgeon directs.",
    ],
  },
  {
    match: ["can't breathe", "cant breathe", "cannot breathe", "difficulty breathing", "short of breath", "shortness of breath", "choking", "struggling to breathe", "trouble breathing", "hard to breathe", "out of breath"],
    together: [["breathe", "can't"], ["breathe", "cant"], ["breathing", "hard"], ["breath", "catch"]],
    title: "Breathing trouble needs help now",
    steps: [
      "Tell the commander now, and " + FLIGHT_SURGEON + " immediately.",
      "Check cabin CO2 and oxygen, and move to fresh air or use emergency oxygen if the procedure says so.",
      "If someone is choking: give up to 5 back blows, then up to 5 abdominal thrusts, and repeat.",
      "Record SpO2 and heart rate if you can.",
    ],
  },
  {
    match: ["unconscious", "passed out", "fainted", "not responding", "unresponsive", "seizure", "having a fit", "convulsion"],
    title: "Loss of consciousness or a seizure is an emergency",
    steps: [
      "Call the commander now and " + FLIGHT_SURGEON + " immediately.",
      "Check they are breathing. If not, start CPR as trained.",
      "During a seizure, don't restrain them. Clear the area and protect the head.",
      "Once breathing normally, keep them secured on their side and stay with them.",
    ],
  },
  {
    match: ["won't stop bleeding", "wont stop bleeding", "heavy bleeding", "bleeding a lot", "spurting", "lots of blood"],
    title: "Heavy bleeding: press hard and get help",
    steps: [
      "Press firmly on the wound with a clean dressing, and don't lift it to check.",
      "If blood soaks through, add another dressing on top and keep pressing.",
      "Tell the commander now and " + FLIGHT_SURGEON + ".",
      "In microgravity, contain floating blood with gauze or wipes.",
    ],
  },
  {
    match: ["hit my head", "head injury", "banged my head", "concussion", "knocked out"],
    title: "Head injury: watch closely",
    steps: [
      "Stop work and rest. Don't be alone for the next 24 hours.",
      "Hold a cold pack on any swelling for up to 20 minutes.",
      FLIGHT_SURGEON[0].toUpperCase() + FLIGHT_SURGEON.slice(1) + " now if there is vomiting, confusion, drowsiness, a severe headache, blurred vision or loss of consciousness.",
      "Do a reaction-time test in VITALS to compare with your baseline.",
    ],
  },
  {
    match: ["face swelling", "throat swelling", "swollen throat", "tongue swelling", "anaphylaxis", "severe allergic", "swollen lips", "swollen tongue"],
    together: [["throat", "swell"], ["throat", "swollen"], ["tongue", "swell"], ["tongue", "swollen"], ["lips", "swell"], ["lips", "swollen"]],
    title: "A severe allergic reaction is an emergency",
    steps: [
      "Use the adrenaline auto-injector from the medical kit if one is prescribed.",
      "Tell the commander now and " + FLIGHT_SURGEON + " immediately.",
      "Stay upright if breathing is hard.",
    ],
  },
];

export const TOPICS: Topic[] = [
  {
    id: "cut",
    title: "Cut or scrape",
    keywords: ["cut", "scrape", "graze", "scratch", "laceration", "bleeding", "bleed", "wound", "sliced", "gash"],
    steps: [
      "Wash your hands or put on gloves.",
      "Press on the cut with a clean dressing until it stops bleeding.",
      "Rinse the wound with clean water and pat it dry.",
      "Cover it with a sterile dressing or plaster, and change it daily.",
    ],
    getHelp: ["It's still bleeding after 10 minutes of firm pressure", "The cut is deep or gaping, or something is stuck in it", "It turns red, hot, swollen or oozes pus, or you get a fever"],
    spaceNote: "Blood and water float in microgravity. Catch them with gauze or wipes.",
  },
  {
    id: "nosebleed",
    title: "Nosebleed",
    keywords: ["nosebleed", "nose bleed", "nose bleeding", "bloody nose", "nose is bleeding"],
    steps: [
      "Lean forward (don't tip your head back) and breathe through your mouth.",
      "Pinch the soft part of your nose for 10 to 15 minutes without letting go.",
      "Hold gauze under your nose to catch blood.",
      "Avoid blowing your nose for a few hours afterwards.",
    ],
    getHelp: ["It lasts longer than 20 minutes", "It started after a head injury", "It keeps coming back"],
    spaceNote: "Blood doesn't drain away in microgravity, so keep gauze ready to catch it.",
  },
  {
    id: "burn",
    title: "Burn",
    keywords: ["burn", "burned", "burnt", "scald", "scalded", "hot water", "blister"],
    steps: [
      "Cool the burn under cool (not ice-cold) water, or hold a cool, wet compress on it, for 20 minutes.",
      "Take off rings or tight items near the burn before it swells.",
      "Cover it loosely with cling film or a clean, non-fluffy dressing.",
      "Don't use ice, butter or creams, and don't pop blisters.",
    ],
    getHelp: ["The burn is bigger than your palm", "It's on the face, hands, feet, joints or genitals", "It's from chemicals or electricity", "The skin looks white, leathery or charred"],
  },
  {
    id: "sprain",
    title: "Sprain or strain",
    keywords: ["sprain", "sprained", "strain", "twisted", "pulled muscle", "ankle", "wrist", "knee", "joint", "elbow", "shoulder"],
    steps: [
      "Rest the injured part and stop the activity that hurt it.",
      "Hold a cold pack wrapped in a cloth on it for up to 20 minutes, every 2 to 3 hours.",
      "Wrap it with a compression bandage, firm but not tight.",
      "Raise it above heart level when you can.",
    ],
    getHelp: ["You can't move it or put any load on it", "It looks bent or out of shape", "It feels numb or tingly, or turns pale or blue", "It isn't better after a few days"],
  },
  {
    id: "fall",
    title: "Fall, tumble or collision",
    keywords: [
      "fell", "fallen", "fall down", "fall over", "had a fall", "fell over", "flipped", "flip", "flips", "tumbled", "tumble", "jumped", "jump", "jumping",
      "slipped", "slip", "tripped", "trip", "landed", "landing", "crashed", "collided", "collision", "rolled", "spun",
      "bumped into", "hit the wall", "hit a wall", "hit my wall", "flew into", "drifted into", "lost my grip", "crashed into", "slammed into",
    ],
    steps: [
      "Stop, anchor yourself, and take a few slow breaths.",
      "Check yourself from head to toe: head, neck, back, shoulders, wrists, hips, knees and ankles. Note anything that hurts or won't move normally.",
      "Hold a cold pack wrapped in a cloth on any sore spot for up to 20 minutes.",
      "Rest for a while, and tell a crewmate what happened so someone keeps an eye on you.",
      "Tell me what hurts, for example \"my wrist hurts\", and I'll give you the steps for it.",
    ],
    getHelp: [
      "You hit your head, or feel confused, sick or drowsy afterwards",
      "Your neck or back hurts, or you have numbness or tingling",
      "You can't move a joint or put load on it, or it looks out of shape",
    ],
    spaceNote:
      "In microgravity a spin or push-off can carry you into a wall or handrail harder than you expect. On the Moon or Mars, low gravity makes jumps higher and landings harder to judge.",
  },
  {
    id: "bruise",
    title: "Bruise or bump",
    keywords: ["bruise", "bruised", "bump", "bumped", "hit my", "knock", "knocked"],
    steps: [
      "Hold a cold pack wrapped in a cloth on it for up to 20 minutes.",
      "Rest the area.",
      "Repeat the cold pack a few times a day for the first 2 days.",
    ],
    getHelp: ["The swelling is large or keeps growing", "The pain is severe, or you can't move the area", "It was a hit to the head (see Head injury)"],
  },
  {
    id: "headache",
    title: "Headache",
    keywords: ["headache", "head ache", "head hurts", "migraine", "head pain", "pressure in my head", "head is pounding", "pounding head", "head is killing", "head hurting", "throbbing head", "head is throbbing"],
    steps: [
      "Check the cabin CO2 reading. A CO2 rise is a common cause of headaches on a spacecraft.",
      "Drink water. Fluid shift means you may not feel thirsty.",
      "Rest somewhere quiet and dim, away from screens.",
      "Use pain relief from the medical kit only as the flight surgeon directs.",
    ],
    getHelp: ["It comes on suddenly and is the worst you've had", "You also have vision changes, confusion, weakness or a stiff neck", "It follows a hit to the head", "It lasts more than a day"],
    spaceNote: "Fluids shift toward the head in microgravity, which can cause head pressure and a stuffy nose.",
  },
  {
    id: "nausea",
    title: "Nausea or space motion sickness",
    keywords: ["nausea", "nauseous", "sick", "vomit", "vomiting", "throw up", "threw up", "motion sickness", "space sickness", "queasy"],
    steps: [
      "Keep your head still and avoid quick head movements.",
      "Fix your eyes on a stable point. Keep a consistent 'up' in the module.",
      "Take small sips of water often.",
      "Ask the flight surgeon about motion sickness medicine from the kit.",
    ],
    getHelp: ["You can't keep fluids down for 24 hours", "There's blood in the vomit", "You have severe stomach pain or signs of dehydration"],
    spaceNote: "Space motion sickness is common in the first 2 to 3 days and usually eases as the body adapts.",
  },
  {
    id: "stomach",
    title: "Upset stomach or diarrhoea",
    keywords: ["diarrhoea", "diarrhea", "upset stomach", "stomach ache", "stomachache", "stomach pain", "tummy", "food poisoning", "loose stools", "stomach bug", "the runs", "bad food"],
    steps: [
      "Rest, and sip water or oral rehydration salts from the kit often, a little at a time.",
      "Clean your hands carefully after every toilet visit, and clean the toilet area after use.",
      "Don't prepare or share food for the crew until you're better.",
      "Eat small, plain meals when you feel ready.",
    ],
    getHelp: ["It lasts more than 24 hours, or you can't keep fluids down", "There's blood in your stool or vomit", "You have a fever or severe stomach pain", "Other crew members get the same symptoms"],
    spaceNote: "In a sealed cabin, stomach bugs spread easily: bag waste tightly and wipe shared surfaces more often.",
  },
  {
    id: "back",
    title: "Back pain",
    keywords: ["back pain", "back hurts", "lower back", "spine", "backache", "back ache", "my back is", "back is killing", "back hurting", "sore back", "stiff back"],
    steps: [
      "Gently pull your knees toward your chest and hold it, which eases the spine.",
      "Do gentle stretches, and keep up your exercise routine.",
      "Use a heat pack on the sore area for 15 to 20 minutes.",
    ],
    getHelp: ["You have numbness or weakness in your legs", "You lose bladder or bowel control", "It follows a fall or a hit", "It keeps getting worse"],
    spaceNote: "The spine lengthens in microgravity, so back pain is common in the first weeks.",
  },
  {
    id: "eye",
    title: "Something in the eye",
    keywords: ["eye", "eyes", "something in my eye", "dust", "particle", "eye irritation", "itchy eye", "red eye"],
    steps: [
      "Don't rub it.",
      "Blink several times, then flush the eye with clean water or the eyewash from the kit.",
      "Wear eye protection when particles may be floating.",
    ],
    getHelp: ["A chemical got in it: flush for 20 minutes, then get help", "Your vision changes", "The pain or redness doesn't go away after flushing"],
    spaceNote: "Dust and particles float in microgravity, so eye injuries are more common than on Earth.",
  },
  {
    id: "dehydration",
    title: "Dehydration",
    keywords: ["dehydrated", "dehydration", "thirsty", "dry mouth", "dark urine", "not drinking", "dark pee"],
    steps: [
      "Drink water steadily, a little at a time.",
      "Use oral rehydration salts from the medical kit if you have them.",
      "Check your urine colour: 1 to 3 on the chart is good, 4 to 5 is watch, 6 to 8 means act.",
      "Log your water intake in VITALS (green range: 2.5 to 3.5 litres a day).",
    ],
    getHelp: ["You're confused, very dizzy or faint", "Your urine is very dark (6 to 8 on the chart), or you aren't passing urine"],
    spaceNote: "You may not feel thirsty in space, so drink on a schedule.",
  },
  {
    id: "dizzy",
    title: "Dizziness or light-headedness",
    keywords: ["dizzy", "dizziness", "light headed", "lightheaded", "light-headed", "spinning", "off balance", "vertigo", "wobbly"],
    steps: [
      "Stop and anchor yourself so you can't drift into anything.",
      "Drink some water.",
      "Check your heart rate and SpO2 in VITALS.",
      "Move slowly for a while.",
    ],
    getHelp: ["You faint", "You also have chest pain or trouble breathing", "It keeps coming back"],
  },
  {
    id: "sleep",
    title: "Poor sleep or tiredness",
    keywords: ["can't sleep", "cant sleep", "fall asleep", "falling asleep", "stay asleep", "insomnia", "sleep", "tired", "fatigue", "exhausted", "sleepy", "weak", "no energy", "drained"],
    steps: [
      "Keep a regular sleep schedule, even on busy days.",
      "Dim the lights before sleep and use an eye mask and earplugs.",
      "Avoid caffeine in the 6 hours before sleep.",
      "Secure your sleeping bag so you don't drift.",
    ],
    getHelp: ["You're under 6 hours a night for several nights", "Tiredness affects your work or safety"],
  },
  {
    id: "fever",
    title: "Fever or feeling unwell",
    keywords: ["fever", "temperature", "chills", "flu", "cold", "sore throat", "cough", "unwell", "ill"],
    steps: [
      "Rest and drink plenty of fluids.",
      "Check your temperature in VITALS (green range: 36.1 to 37.2 °C).",
      "Keep away from crewmates where you can, and clean shared surfaces.",
    ],
    getHelp: ["Your temperature goes above 38.0 °C", "It lasts more than 2 days", "You also have trouble breathing or chest pain"],
  },
  {
    id: "skin",
    title: "Rash, itch or dry skin",
    keywords: ["rash", "itch", "itchy", "dry skin", "skin", "irritation", "hives", "fungal", "athlete's foot", "skin infection", "cracked skin"],
    steps: [
      "Clean the area gently with a no-rinse cleanser and pat it dry.",
      "Use a moisturiser from the kit.",
      "Try not to scratch. A cold compress helps with itching.",
    ],
    getHelp: ["The rash spreads fast or blisters", "You also have a fever", "Your face, lips or throat swell (emergency)"],
  },
  {
    id: "cramp",
    title: "Muscle cramp",
    keywords: ["cramp", "cramps", "muscle spasm", "spasm", "charley horse"],
    steps: [
      "Gently stretch the muscle and hold the stretch.",
      "Massage the area.",
      "Drink some water.",
    ],
    getHelp: ["Cramps keep coming back", "There is swelling, redness or ongoing pain in the leg"],
  },
  {
    id: "tooth",
    title: "Toothache",
    keywords: ["tooth", "toothache", "teeth", "gum", "gums", "bleeding gums", "sore gums", "mouth ulcer", "dental", "jaw"],
    steps: [
      "Rinse your mouth with warm salt water if you have it, or clean water.",
      "Hold a cold pack on the outside of your cheek.",
      "Use pain relief from the medical kit only as the flight surgeon directs.",
    ],
    getHelp: ["Your face or jaw swells", "You have a fever", "The pain is severe or lasts more than a day"],
  },
];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ")} `;
/** The same text with each word reduced to its stem, so "sleeping" matches "sleep" and "cuts" matches "cut". */
const stemmed = (s: string) => ` ${s.trim().split(" ").map((w) => stem(w.replace(/'/g, ""))).join(" ")} `;

/** Does the message contain this keyword or phrase, in any common word form? */
function has(text: string, textStem: string, phrase: string): boolean {
  return text.includes(` ${phrase} `) || textStem.includes(stemmed(phrase));
}

export function answer(input: string): Reply {
  const text = norm(input);
  if (!text.trim()) return { kind: "unknown" };
  const textStem = stemmed(text);

  for (const flag of RED_FLAGS) {
    const hit =
      flag.match.find((m) => has(text, textStem, m)) ??
      flag.together?.find((words) => words.every((w) => has(text, textStem, w)))?.join(" + ");
    if (hit) return { kind: "urgent", title: flag.title, steps: flag.steps, matched: hit };
  }

  const scored = TOPICS.map((t) => ({
    t,
    score: t.keywords.reduce((n, k) => n + (has(text, textStem, k) ? k.split(" ").length : 0), 0),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length) return { kind: "advice", topics: scored.slice(0, 2).map((x) => x.t) };

  // Small talk only for short messages, so "is it ok to drink recycled water?" reaches the knowledge library.
  if (text.trim().split(" ").length <= 5) {
    for (const s of SMALL_TALK) {
      // Only at the start of the message, so "what is HI-SEAS" isn't taken for "hi".
      if (s.match.some((m) => text.startsWith(` ${m} `))) return { kind: "chat", text: s.text };
    }
  }
  return { kind: "unknown" };
}

/* Greetings and other small talk, so the assistant doesn't answer "hello" with "I don't know". */
const SMALL_TALK: { match: string[]; text: string }[] = [
  {
    match: ["how are you", "how r u", "how's it going", "hows it going", "how are things"],
    text: "All systems green on my side, thanks for asking. How are you feeling today?",
  },
  {
    match: ["good night", "goodnight", "night night", "going to sleep", "going to bed"],
    text: "Good night. Make sure your ventilation fan is on and your sleeping bag is secured. Sleep well.",
  },
  {
    match: ["i'm scared", "im scared", "i'm afraid", "im afraid", "i'm worried", "im worried", "i'm nervous", "im nervous", "i'm anxious", "im anxious", "i'm panicking", "im panicking"],
    text: "That's completely understandable: long missions are hard, and feeling scared is normal. Take a few slow breaths, in for 4 and out for 6, and talk to a crewmate. If it's about your health, tell me what's going on and I'll help you work out what to do. The mission psychologist is there for this too.",
  },
  {
    match: ["hello", "hi", "hey", "hiya", "good morning", "good afternoon", "good evening", "yo"],
    text: "Hi! I'm the VITALS first-aid assistant. Tell me what happened or where it hurts, for example \"I cut my finger\" or \"I feel dizzy\".",
  },
  {
    match: ["thanks", "thank you", "thx", "cheers", "ty"],
    text: "You're welcome. If it gets worse or you're unsure, tell the commander and contact the flight surgeon.",
  },
  {
    match: ["help", "what can you do", "who are you", "what are you", "how do you work"],
    text: "I give general first-aid steps for minor injuries and symptoms in space, like cuts, burns, sprains, headaches, nausea or something in your eye, and tell you when to contact the flight surgeon. Serious signs like chest pain or trouble breathing go straight to \"get help now\".",
  },
  {
    match: ["bye", "goodbye", "see you", "ok", "okay", "fine", "i'm fine", "im fine", "i'm ok", "im ok"],
    text: "Okay. I'm here whenever you need me. Stay safe up there.",
  },
];

/*
 * How the assistant talks about each topic: a short opener, and for the main
 * topics one follow-up question with answers, like a medic's triage questions.
 * Options marked urgent are shown in red and always send the crew member to
 * the flight surgeon.
 */
const SURGEON_NOW = "tell the commander and contact the flight surgeon now";

export const TOPIC_TALK: Record<string, { intro: string; ask?: Ask }> = {
  cut: {
    intro: "Let's get that cut cleaned and covered.",
    ask: {
      q: "Is it still bleeding after 10 minutes of firm pressure?",
      options: [
        { label: "Yes, still bleeding", urgent: true, say: `Keep pressing firmly without lifting the dressing, add more dressing on top if blood soaks through, and ${SURGEON_NOW}. Bleeding that hasn't stopped after 10 minutes of firm pressure needs help.` },
        { label: "No, it's stopped", say: "Good. Rinse it with clean water, cover it with a sterile dressing, and change the dressing daily. Over the next few days, watch for redness, heat, swelling or pus: those mean infection, and the flight surgeon should know." },
        { label: "It's deep or gaping", urgent: true, say: `Keep pressure on it and cover it, and ${SURGEON_NOW}. A deep or gaping cut may need closing with wound strips or stitches, which the crew medical officer can do with the flight surgeon's guidance.` },
      ],
    },
  },
  nosebleed: {
    intro: "Nosebleeds are fairly common in space because of the dry air and the fluid shift toward the head.",
    ask: {
      q: "Has it been bleeding for more than 20 minutes?",
      options: [
        { label: "Yes, over 20 minutes", urgent: true, say: `Keep pinching the soft part of your nose and leaning forward, catch the blood with gauze, and ${SURGEON_NOW}.` },
        { label: "No, it's slowing down", say: "Keep pinching for the full 10 to 15 minutes without checking. Afterwards, don't blow your nose or strain for a few hours, and keep the inside of your nose moist with a saline spray from the kit if there is one. Dry cabin air makes nosebleeds come back." },
      ],
    },
  },
  burn: {
    intro: "Cool it first: that's the most important thing you can do for a burn.",
    ask: {
      q: "How big is the burn, and what caused it?",
      options: [
        { label: "Smaller than my palm", say: "Keep cooling it for the full 20 minutes, then cover it loosely with cling film or a clean, non-fluffy dressing. Don't pop blisters. Check it daily, and tell the flight surgeon if it gets red, hot, swollen or oozes." },
        { label: "Bigger than my palm", urgent: true, say: `Keep cooling it, cover it loosely with cling film or a clean dressing, and ${SURGEON_NOW}. Larger burns need medical advice, and you may need fluids.` },
        { label: "Chemical or electrical", urgent: true, say: `For a chemical burn, rinse with plenty of water for at least 20 minutes and carefully remove anything contaminated. For an electrical burn, make sure the power is off before touching anyone; there may be hidden damage inside. Either way, ${SURGEON_NOW}.` },
      ],
    },
  },
  sprain: {
    intro: "Sorry, that sounds painful. Let's check how bad it is.",
    ask: {
      q: "Can you move it and put some load on it?",
      options: [
        { label: "Yes, but it hurts", say: "It's most likely a sprain or strain. Rest it, use a cold pack for up to 20 minutes every 2 to 3 hours, wrap it firmly but not tightly, and keep it raised when you can, for 2 to 3 days. Then start gentle movement. In space, avoid pushing off with it until it feels better." },
        { label: "No, or it looks bent", urgent: true, say: `Don't try to straighten or move it. Support it in the position you found it, and ${SURGEON_NOW}. It could be a fracture or dislocation.` },
        { label: "It's numb or tingly", urgent: true, say: `Loosen any bandage straight away, and ${SURGEON_NOW}. Numbness, tingling, or skin turning pale or blue can mean a problem with the nerves or blood flow.` },
      ],
    },
  },
  fall: {
    intro: "Okay, let's check you over. It's easy to misjudge a push-off or a spin in weightlessness.",
    ask: {
      q: "Did you hit your head?",
      options: [
        { label: "Yes", urgent: true, say: `Then treat it as a head injury. Stop work and rest, don't be alone for the next 24 hours, and hold a cold pack on any bump. ${SURGEON_NOW[0].toUpperCase() + SURGEON_NOW.slice(1)} if you have vomiting, confusion, drowsiness, a bad headache or blurred vision. A reaction-time test in VITALS can be compared with your baseline.` },
        { label: "No, but something hurts", say: "Tell me where it hurts, for example \"my wrist hurts\" or \"my back hurts\", and I'll give you the steps for it." },
        { label: "No, I feel fine", say: "Good. Still take it easy for a while and check yourself again in an hour or two: some pain and bruising only shows up later." },
      ],
    },
  },
  bruise: { intro: "Bumps and bruises are common while you get used to moving in weightlessness." },
  headache: {
    intro: "Headaches are one of the most common complaints in space, so let's look for the cause.",
    ask: {
      q: "How did it start?",
      options: [
        { label: "Slowly, a dull ache", say: "That's typical of a CO2 or fluid-shift headache. Check the cabin CO2 reading, drink water, move closer to an air vent, and rest somewhere dim. If several crew members have headaches at the same time, CO2 is the likely cause: tell the commander." },
        { label: "Suddenly, the worst ever", urgent: true, say: `A sudden, severe headache needs help now. ${SURGEON_NOW[0].toUpperCase() + SURGEON_NOW.slice(1)}, and record your heart rate.` },
        { label: "With blurry vision", urgent: true, say: `A headache with vision changes needs the flight surgeon: it can be linked to pressure changes in the head. Note what you see, and ${SURGEON_NOW}.` },
        { label: "After hitting my head", urgent: true, say: `Then treat it as a head injury. Stop work and rest, don't be alone for 24 hours, and ${SURGEON_NOW}, especially if you're vomiting, confused or drowsy.` },
      ],
    },
  },
  nausea: {
    intro: "Feeling sick is very common in space, especially at first, and it usually passes.",
    ask: {
      q: "How long have you been in space?",
      options: [
        { label: "First few days", say: "Then it's very likely space motion sickness, which affects more than half of astronauts and usually eases within 2 to 3 days. Keep your head still, keep a consistent sense of \"up\", sip water often, and ask the flight surgeon about motion sickness medicine from the kit." },
        { label: "Longer than a week", say: "Nausea later in a mission is less likely to be motion sickness. It could be food, an infection, a medicine, stress or something else. Rest and sip water, and tell the flight surgeon, especially if you also have a fever, stomach pain or diarrhoea." },
        { label: "I can't keep water down", urgent: true, say: `If you can't keep fluids down, you can get dehydrated quickly. ${SURGEON_NOW[0].toUpperCase() + SURGEON_NOW.slice(1)}: the medical kit has medicines and fluids for this.` },
      ],
    },
  },
  back: {
    intro: "Back pain is very common in space, mostly because your spine stretches out without gravity.",
    ask: {
      q: "Do you have numbness, tingling or weakness in your legs?",
      options: [
        { label: "Yes", urgent: true, say: `Back pain with numbness, tingling or weakness in the legs, or any loss of bladder or bowel control, needs help now. ${SURGEON_NOW[0].toUpperCase() + SURGEON_NOW.slice(1)}.` },
        { label: "No, just the pain", say: "Then it's most likely your spine stretching in weightlessness. Pull your knees to your chest and hold for a minute, stretch gently, use a heat pack, and keep up your exercise. It usually eases after the first few weeks." },
      ],
    },
  },
  eye: {
    intro: "Particles float everywhere in space, so things get into eyes a lot. Try not to rub it.",
    ask: {
      q: "What got into your eye?",
      options: [
        { label: "Dust or a particle", say: "Blink several times, then flush the eye with clean water or the eyewash from the kit. If it still feels like something's there, ask a crewmate to look, and use eye protection when particles may be floating." },
        { label: "A chemical or liquid", urgent: true, say: `Flush the eye with clean water or eyewash right away, holding the eyelids open, and keep flushing for at least 20 minutes. Then ${SURGEON_NOW}.` },
        { label: "My vision changed", urgent: true, say: `A change in vision needs the flight surgeon. Long missions can cause eye changes (SANS), and the crew can do eye checks with the equipment on board. ${SURGEON_NOW[0].toUpperCase() + SURGEON_NOW.slice(1)}.` },
      ],
    },
  },
  dehydration: { intro: "In space you often don't feel thirsty, so it's easy to fall behind on water." },
  dizzy: {
    intro: "Let's get you steady first.",
    ask: {
      q: "Is it happening with chest pain, a racing heart or trouble breathing?",
      options: [
        { label: "Yes", urgent: true, say: `Dizziness with chest pain, a racing heart or trouble breathing needs help now. Anchor yourself, and ${SURGEON_NOW}.` },
        { label: "No, just dizzy", say: "Anchor yourself and drink some water, then check your heart rate and SpO2 in VITALS. In the first days of a mission, dizziness is often part of adapting to weightlessness. If it keeps coming back, tell the flight surgeon." },
        { label: "I fainted", urgent: true, say: `Fainting needs the flight surgeon. Stay secured and still, have a crewmate stay with you, record your heart rate and SpO2, and ${SURGEON_NOW}.` },
      ],
    },
  },
  sleep: {
    intro: "Sorry you're struggling to sleep. It's one of the most common problems in space: astronauts average only about six hours a night.",
    ask: {
      q: "What's keeping you awake?",
      options: [
        { label: "My mind won't settle", say: "Try a fixed wind-down routine: dim the lights, put screens away 30 minutes before bed, and write down what's on your mind. Slow breathing helps too: in for 4 counts, out for 6. If stress keeps you awake for several nights, talk to the flight surgeon or the mission psychologist." },
        { label: "Noise or light", say: "Use earplugs and an eye mask, and check the cabin lighting is on its evening setting (warmer and dimmer). Ask the crew to keep noise down during your sleep period." },
        { label: "Headache or stuffy head", say: "That can be CO2 collecting around your face, or the fluid shift. Check that the ventilation fan in your crew quarters is on and blowing near your head, check the CO2 reading, and drink some water." },
        { label: "Several nights now", say: "Several bad nights in a row affect alertness and safety. Log your sleep in VITALS and tell the flight surgeon: they can adjust your schedule, and prescribe sleep medicine from the kit if it's needed." },
      ],
    },
  },
  fever: {
    intro: "Let's check how high it is.",
    ask: {
      q: "What's your temperature?",
      options: [
        { label: "Below 38 °C", say: "Rest, drink plenty of fluids and recheck in a few hours. Remember that core temperature runs about 1 °C higher in space, so compare with your own in-flight baseline. Keep apart from crewmates where you can and clean shared surfaces." },
        { label: "38 °C or higher", urgent: true, say: `Rest, drink fluids, record your temperature every few hours, keep apart from the crew, and ${SURGEON_NOW}.` },
        { label: "Haven't measured it", say: "Measure it with the thermometer and log it in VITALS (green is 36.1 to 37.2 °C). Then tell me the number and I'll tell you what to do next." },
      ],
    },
  },
  skin: { intro: "Skin rashes and itching are among the most common complaints in space, mostly because the air is dry." },
  stomach: {
    intro: "Sorry you're feeling rough. In a sealed spacecraft, a stomach bug is also a hygiene issue for the whole crew.",
    ask: {
      q: "Does anyone else on the crew have it too?",
      options: [
        { label: "Yes, others too", urgent: true, say: `Several crew members with the same symptoms can mean contaminated food or water, or a bug spreading. Stop using any shared food or water you suspect, bag it for testing, clean shared surfaces and the toilet area, and ${SURGEON_NOW}.` },
        { label: "No, just me", say: "Rest, sip fluids often, and clean your hands carefully after every toilet visit. Keep away from the food area until you're better, and tell the flight surgeon if it lasts more than a day or you get a fever." },
      ],
    },
  },
  cramp: { intro: "Cramps usually ease within a few minutes." },
  tooth: { intro: "There's no dentist on board, so let's look after it carefully." },
};

/*
 * The "Did you know?" fact shown under each topic's first-aid steps: the heading of
 * a passage in /knowledge. Hand-picked, so the fact always fits the topic. If a
 * heading is renamed in /knowledge, update it here too (a missing one is just skipped).
 */
export const TOPIC_FACT: Record<string, string> = {
  sleep: "Can CO2 build up around my head while I sleep?",
  headache: "Why do I get headaches in space?",
  nausea: "What is space motion sickness?",
  back: "Why am I taller in space?",
  dizzy: "Why do I feel upside down or confused about direction?",
  eye: "Why do floating particles matter?",
  skin: "Why is skin so dry and itchy in space?",
  fever: "Why does my body temperature run higher in space?",
  dehydration: "Why do I feel less thirsty in space?",
  nosebleed: "Why is my nose stuffy and my head full in space?",
  tooth: "How do you brush your teeth in space?",
  fall: "What changes when moving to the Moon or Mars?",
  burn: "How does fire behave in space?",
  sprain: "Do muscles get weaker in space?",
  cramp: "Why is exercise so important in space?",
  stomach: "How is food kept safe in space?",
};

/**
 * A general question ("why do astronauts faint after landing?", "is moon dust dangerous?")
 * rather than someone describing their own problem ("I fainted", "my eye hurts").
 * General questions with a strong library answer get that answer instead of first-aid steps.
 */
export function isGeneralQuestion(input: string): boolean {
  const s = input.toLowerCase().replace(/[’]/g, "'").trim();
  const asks = /^(why|how|what|what's|whats|when|where|which|who|is|are|does|do|can|could|should|will|would|tell me about|explain)\b/.test(s);
  const personal = /\b(i|i'm|im|i've|ive|i'd|my|me|mine|myself)\b/.test(s);
  return asks && !personal;
}

/** "Why…", "what is…", "is it normal…": the person wants an explanation, even about themselves. */
export function isExplainQuestion(input: string): boolean {
  return /^(why|what|what's|whats|how come|is it normal|is this normal|is that normal|is it common)\b/.test(
    input.toLowerCase().replace(/[’]/g, "'").trim(),
  );
}

/* Offered when the assistant doesn't understand, so the conversation can carry on. */
export const FOLLOW_UPS = ["My head hurts", "My back hurts", "My wrist hurts", "My ankle hurts", "I feel dizzy", "I fell or bumped into something", "I feel fine"];

export const SUGGESTIONS = ["I cut my finger", "I have a headache", "I twisted my ankle", "I feel sick", "Why is my face puffy in space?", "Is space radiation dangerous?"];
