/*
 * Offline first-aid assistant for school: rule-based, no AI and no internet.
 *
 * Questions that aren't first aid are answered from the knowledge library
 * (knowledge.ts and the school-*.md files in /knowledge). Red flags always win.
 *
 * It matches what the student types against keyword lists and answers with
 * general first-aid steps (based on standard guidance such as NHS and Red Cross
 * first aid, for a school setting). It is decision support, not a diagnosis:
 * every answer says when to get a teacher or the school nurse, and red-flag
 * symptoms skip straight to "get help now".
 *
 * Edit or add topics here. Keep advice general, and keep the "Get help if"
 * list on every topic.
 */

import { stem } from "@/lib/knowledge";

export type Topic = {
  id: string;
  title: string;
  keywords: string[];
  steps: string[];
  getHelp: string[];
  /** A short tip for the school setting, shown under the steps. */
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

const NURSE = "get the school nurse or a first aider";

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
      "Stop what you're doing and sit down.",
      "Tell a teacher now, and " + NURSE + " immediately.",
      "If you have asthma, use your reliever inhaler as your plan says.",
      "If it's severe, spreads to the arm or jaw, or comes with sweating or breathlessness, an adult should call an ambulance.",
    ],
  },
  {
    match: ["can't breathe", "cant breathe", "cannot breathe", "difficulty breathing", "short of breath", "shortness of breath", "choking", "struggling to breathe", "trouble breathing", "hard to breathe", "out of breath", "asthma attack", "wheezing"],
    together: [["breathe", "can't"], ["breathe", "cant"], ["breathing", "hard"], ["breath", "catch"]],
    title: "Breathing trouble needs help now",
    steps: [
      "Tell a teacher now, and " + NURSE + " immediately.",
      "Asthma: sit up straight, stay calm and use the blue reliever inhaler (with a spacer if you have one), as your asthma plan says.",
      "If someone is choking: give up to 5 back blows, then up to 5 abdominal thrusts, and repeat.",
      "If it isn't getting better, or they can't speak, an adult should call an ambulance.",
    ],
  },
  {
    match: ["unconscious", "passed out", "fainted", "not responding", "unresponsive", "seizure", "having a fit", "convulsion"],
    title: "Loss of consciousness or a seizure is an emergency",
    steps: [
      "Shout for a teacher now and " + NURSE + " immediately.",
      "Check they are breathing. If not, call an ambulance, start CPR and send someone for the defibrillator (AED).",
      "During a seizure, don't hold them down or put anything in their mouth. Move hard objects away, cushion the head and time it.",
      "Once breathing normally, put them on their side (recovery position) and stay with them.",
    ],
  },
  {
    match: ["won't stop bleeding", "wont stop bleeding", "heavy bleeding", "bleeding a lot", "spurting", "lots of blood"],
    title: "Heavy bleeding: press hard and get help",
    steps: [
      "Press firmly on the wound with a clean dressing, and don't lift it to check.",
      "If blood soaks through, add another dressing on top and keep pressing.",
      "Tell a teacher now and " + NURSE + ".",
      "Wear gloves if you're helping someone else.",
    ],
  },
  {
    match: ["hit my head", "head injury", "banged my head", "concussion", "knocked out"],
    title: "Head injury: stop and get checked",
    steps: [
      "Stop playing or working and sit down. Don't go back to sport today.",
      "Hold a cold pack on any swelling for up to 20 minutes.",
      "Tell a teacher and " + NURSE + " now if there is vomiting, confusion, drowsiness, a bad headache, blurred vision or you were knocked out.",
      "Someone should keep an eye on you for the rest of the day, and your parents should be told.",
    ],
  },
  {
    match: ["face swelling", "throat swelling", "swollen throat", "tongue swelling", "anaphylaxis", "severe allergic", "swollen lips", "swollen tongue", "allergic reaction"],
    together: [["throat", "swell"], ["throat", "swollen"], ["tongue", "swell"], ["tongue", "swollen"], ["lips", "swell"], ["lips", "swollen"]],
    title: "A severe allergic reaction is an emergency",
    steps: [
      "Use their adrenaline auto-injector (EpiPen) into the outer thigh straight away if they have one.",
      "An adult should call an ambulance and say \"anaphylaxis\". Tell a teacher and " + NURSE + ".",
      "Lie them down with legs raised, or let them sit up if breathing is hard.",
      "If there's no improvement after 5 minutes, give the second auto-injector.",
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
      "Cover it with a plaster or dressing, and change it daily.",
    ],
    getHelp: ["It's still bleeding after 10 minutes of firm pressure", "The cut is deep or gaping, or something is stuck in it", "It turns red, hot, swollen or oozes pus, or you get a fever"],
    spaceNote: "Playground grazes often have grit in them: rinse well so they don't get infected.",
  },
  {
    id: "nosebleed",
    title: "Nosebleed",
    keywords: ["nosebleed", "nose bleed", "nose bleeding", "bloody nose", "nose is bleeding"],
    steps: [
      "Sit down, lean forward (don't tip your head back) and breathe through your mouth.",
      "Pinch the soft part of your nose for 10 to 15 minutes without letting go.",
      "Hold a tissue under your nose to catch blood.",
      "Avoid blowing your nose or PE for a few hours afterwards.",
    ],
    getHelp: ["It lasts longer than 20 minutes", "It started after a hit to the head or face", "It keeps coming back"],
    spaceNote: "Nosebleeds are common in children, especially in dry, heated classrooms in winter.",
  },
  {
    id: "burn",
    title: "Burn",
    keywords: ["burn", "burned", "burnt", "scald", "scalded", "hot water", "blister"],
    steps: [
      "Cool the burn under cool (not ice-cold) running water for 20 minutes.",
      "Take off rings, watches or tight items near the burn before it swells.",
      "Cover it loosely with cling film or a clean, non-fluffy dressing.",
      "Don't use ice, butter or creams, and don't pop blisters.",
    ],
    getHelp: ["The burn is bigger than your palm", "It's on the face, hands, feet, joints or genitals", "It's from chemicals or electricity", "The skin looks white, leathery or charred"],
    spaceNote: "In science and food lessons, tell the teacher about any burn straight away, however small.",
  },
  {
    id: "sprain",
    title: "Sprain or strain",
    keywords: ["sprain", "sprained", "strain", "twisted", "pulled muscle", "ankle", "wrist", "knee", "joint", "elbow", "shoulder"],
    steps: [
      "Stop playing and rest the injured part.",
      "Hold a cold pack wrapped in a cloth on it for up to 20 minutes, every 2 to 3 hours.",
      "Wrap it with a compression bandage, firm but not tight.",
      "Raise it above heart level when you can.",
    ],
    getHelp: ["You can't move it or put weight on it", "It looks bent or out of shape", "It feels numb or tingly, or turns pale or blue", "It isn't better after a couple of days"],
    spaceNote: "Don't go back to sport until it moves freely without pain.",
  },
  {
    id: "fall",
    title: "Fall, trip or collision",
    keywords: [
      "fell", "fallen", "fall down", "fall over", "had a fall", "fell over", "flipped", "tumbled", "tumble", "jumped", "jump", "jumping",
      "slipped", "slip", "tripped", "trip", "landed", "landing", "crashed", "collided", "collision", "rolled",
      "bumped into", "hit the wall", "hit a wall", "ran into", "crashed into", "slammed into", "pushed", "tackled",
    ],
    steps: [
      "Stop, sit down, and take a few slow breaths.",
      "Check yourself from head to toe: head, neck, back, shoulders, wrists, hips, knees and ankles. Note anything that hurts or won't move normally.",
      "Hold a cold pack wrapped in a cloth on any sore spot for up to 20 minutes.",
      "Tell a teacher what happened so someone keeps an eye on you.",
      "Tell me what hurts, for example \"my wrist hurts\", and I'll give you the steps for it.",
    ],
    getHelp: [
      "You hit your head, or feel confused, sick or drowsy afterwards",
      "Your neck or back hurts, or you have numbness or tingling",
      "You can't move a joint or put weight on it, or it looks out of shape",
    ],
    spaceNote: "Most playground and PE falls only bruise, but wrists and ankles are the most often broken.",
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
      "Drink a glass of water. Not drinking enough is a very common cause.",
      "Eat something if you skipped breakfast or lunch.",
      "Rest somewhere quiet, away from screens, and ask for a window to be opened if the room is stuffy.",
      "Pain relief only from the school nurse, with your parents' permission.",
    ],
    getHelp: ["It comes on suddenly and is the worst you've had", "You also have a fever, stiff neck, rash, vision changes or confusion", "It follows a hit to the head", "It keeps coming back"],
    spaceNote: "Stuffy classrooms, skipped meals, little sleep and long screen time all cause school-day headaches.",
  },
  {
    id: "nausea",
    title: "Feeling sick or vomiting",
    keywords: ["nausea", "nauseous", "sick", "vomit", "vomiting", "throw up", "threw up", "motion sickness", "travel sick", "queasy"],
    steps: [
      "Sit down somewhere with fresh air, near a toilet or bin.",
      "Take small sips of water often.",
      "Tell a teacher. If you've been sick, you should go home.",
      "Wash your hands well after being sick.",
    ],
    getHelp: ["You can't keep fluids down", "There's blood in the vomit", "You have severe stomach pain, a fever, or it follows a hit to the head"],
    spaceNote: "After vomiting or diarrhoea, stay home until 48 hours after the last time, so it doesn't spread.",
  },
  {
    id: "stomach",
    title: "Upset stomach or diarrhoea",
    keywords: ["diarrhoea", "diarrhea", "upset stomach", "stomach ache", "stomachache", "stomach pain", "tummy", "food poisoning", "loose stools", "stomach bug", "the runs", "bad food"],
    steps: [
      "Rest, and sip water often, a little at a time.",
      "Wash your hands with soap and water after every toilet visit.",
      "Tell a teacher: you should go home if you have diarrhoea.",
      "Eat small, plain meals when you feel ready.",
    ],
    getHelp: ["It lasts more than a day, or you can't keep fluids down", "There's blood in your stool or vomit", "You have a fever or severe stomach pain", "Lots of students get the same symptoms"],
    spaceNote: "Stomach bugs spread fast in schools. Hand sanitiser doesn't kill all of them: use soap and water.",
  },
  {
    id: "back",
    title: "Back pain",
    keywords: ["back pain", "back hurts", "lower back", "spine", "backache", "back ache", "my back is", "back is killing", "back hurting", "sore back", "stiff back", "school bag", "backpack"],
    steps: [
      "Take off any heavy bag and stretch gently.",
      "Use a warm pack on the sore area for 15 to 20 minutes.",
      "Keep moving gently; long sitting makes it worse.",
      "Lighten your school bag and wear it on both shoulders.",
    ],
    getHelp: ["You have numbness or weakness in your legs", "It follows a fall or a hit", "It wakes you at night or keeps getting worse"],
    spaceNote: "A school bag should weigh no more than about 10 to 15% of your body weight.",
  },
  {
    id: "eye",
    title: "Something in the eye",
    keywords: ["eye", "eyes", "something in my eye", "dust", "particle", "eye irritation", "itchy eye", "red eye", "sore eyes"],
    steps: [
      "Don't rub it.",
      "Blink several times, then rinse the eye with clean water or eyewash from the first-aid kit.",
      "Wear safety goggles in science and technology lessons.",
    ],
    getHelp: ["A chemical got in it: rinse for 20 minutes, then get help", "Your vision changes", "The pain or redness doesn't go away after rinsing"],
    spaceNote: "Tired, sore eyes after screens? Every 20 minutes, look 6 metres away for 20 seconds.",
  },
  {
    id: "dehydration",
    title: "Dehydration",
    keywords: ["dehydrated", "dehydration", "thirsty", "dry mouth", "dark urine", "not drinking", "dark pee"],
    steps: [
      "Drink water steadily, a little at a time.",
      "Sit somewhere cool and rest.",
      "Check your pee colour: pale straw is good, dark yellow means drink more.",
      "Log your water in VITALS and keep a bottle on your desk.",
    ],
    getHelp: ["You're confused, very dizzy or faint", "Your pee is very dark, or you haven't been for many hours"],
    spaceNote: "Drink before and after PE, and more on hot days.",
  },
  {
    id: "dizzy",
    title: "Dizziness or light-headedness",
    keywords: ["dizzy", "dizziness", "light headed", "lightheaded", "light-headed", "spinning", "off balance", "vertigo", "wobbly", "faint"],
    steps: [
      "Sit or lie down straight away so you don't fall.",
      "Drink some water, and eat something if you skipped a meal.",
      "Check your heart rate and SpO2 in VITALS.",
      "Get up slowly when you feel better.",
    ],
    getHelp: ["You faint", "You also have chest pain or trouble breathing", "It keeps coming back"],
    spaceNote: "Skipping breakfast, not drinking and standing for a long time in the heat are common causes.",
  },
  {
    id: "sleep",
    title: "Poor sleep or tiredness",
    keywords: ["can't sleep", "cant sleep", "fall asleep", "falling asleep", "stay asleep", "insomnia", "sleep", "tired", "fatigue", "exhausted", "sleepy", "weak", "no energy", "drained"],
    steps: [
      "Go to bed and get up at the same time every day, even at weekends.",
      "Put phones and screens away 30 to 60 minutes before bed.",
      "Avoid energy drinks, cola and coffee, especially after lunch.",
      "Most students need 8 to 11 hours a night.",
    ],
    getHelp: ["You're falling asleep in class", "You've slept badly for several weeks, or you feel low or worried"],
  },
  {
    id: "fever",
    title: "Fever or feeling unwell",
    keywords: ["fever", "temperature", "chills", "flu", "cold", "sore throat", "cough", "unwell", "ill"],
    steps: [
      "Tell a teacher. With a fever you should go home and rest.",
      "Drink plenty of fluids.",
      "Cough or sneeze into a tissue, bin it and wash your hands.",
    ],
    getHelp: ["Your temperature is 38.0 °C or higher", "You have a rash that doesn't fade when a glass is pressed on it (emergency)", "You also have trouble breathing, a stiff neck or are very drowsy"],
  },
  {
    id: "skin",
    title: "Rash, itch or dry skin",
    keywords: ["rash", "itch", "itchy", "dry skin", "skin", "irritation", "hives", "fungal", "athlete's foot", "skin infection", "cracked skin", "head lice", "lice"],
    steps: [
      "Wash the area gently and pat it dry.",
      "Use a moisturiser for dry or cracked skin.",
      "Try not to scratch. A cold compress helps with itching.",
    ],
    getHelp: ["The rash spreads fast or blisters", "You also have a fever, or the rash doesn't fade under a glass", "Your face, lips or throat swell (emergency)"],
    spaceNote: "Don't share towels, hats or hairbrushes: it spreads lice and skin infections.",
  },
  {
    id: "cramp",
    title: "Muscle cramp",
    keywords: ["cramp", "cramps", "muscle spasm", "spasm", "stitch"],
    steps: [
      "Stop and gently stretch the muscle, holding the stretch.",
      "Massage the area.",
      "Drink some water.",
    ],
    getHelp: ["Cramps keep coming back", "There is swelling, redness or ongoing pain in the leg"],
    spaceNote: "Warming up before PE and drinking water help prevent cramps.",
  },
  {
    id: "tooth",
    title: "Toothache or a knocked-out tooth",
    keywords: ["tooth", "toothache", "teeth", "gum", "gums", "bleeding gums", "sore gums", "mouth ulcer", "dental", "jaw", "knocked out tooth"],
    steps: [
      "Rinse your mouth with warm salt water or clean water.",
      "Hold a cold pack on the outside of your cheek.",
      "Knocked-out adult tooth: hold it by the top (not the root), keep it in milk, and see a dentist within an hour.",
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

  // Small talk only for short messages, so "is it ok to drink fizzy drinks?" reaches the knowledge library.
  if (text.trim().split(" ").length <= 5) {
    for (const s of SMALL_TALK) {
      // Only at the start of the message, so "his knee" isn't taken for "hi".
      if (s.match.some((m) => text.startsWith(` ${m} `))) return { kind: "chat", text: s.text };
    }
  }
  return { kind: "unknown" };
}

/* Greetings and other small talk, so the assistant doesn't answer "hello" with "I don't know". */
const SMALL_TALK: { match: string[]; text: string }[] = [
  {
    match: ["how are you", "how r u", "how's it going", "hows it going", "how are things"],
    text: "I'm good, thanks for asking. How are you feeling today?",
  },
  {
    match: ["good night", "goodnight", "night night", "going to sleep", "going to bed"],
    text: "Good night. Screens away, and aim for 8 to 11 hours of sleep. Sleep well.",
  },
  {
    match: ["i'm scared", "im scared", "i'm afraid", "im afraid", "i'm worried", "im worried", "i'm nervous", "im nervous", "i'm anxious", "im anxious", "i'm panicking", "im panicking", "i'm stressed", "im stressed"],
    text: "That's completely understandable, and you're not alone. Take a few slow breaths, in for 4 and out for 6, and talk to a teacher, the school nurse or someone you trust. If it's about your health, tell me what's going on and I'll help you work out what to do.",
  },
  {
    match: ["hello", "hi", "hey", "hiya", "good morning", "good afternoon", "good evening", "yo"],
    text: "Hi! I'm the VITALS first-aid assistant. Tell me what happened or where it hurts, for example \"I cut my finger\" or \"I feel dizzy\".",
  },
  {
    match: ["thanks", "thank you", "thx", "cheers", "ty"],
    text: "You're welcome. If it gets worse or you're unsure, tell a teacher and get the school nurse.",
  },
  {
    match: ["help", "what can you do", "who are you", "what are you", "how do you work"],
    text: "I give general first-aid steps for everyday school injuries and symptoms, like cuts, burns, sprains, headaches, feeling sick or something in your eye, and tell you when to get a teacher or the school nurse. Serious signs like chest pain or trouble breathing go straight to \"get help now\".",
  },
  {
    match: ["bye", "goodbye", "see you", "ok", "okay", "fine", "i'm fine", "im fine", "i'm ok", "im ok"],
    text: "Okay. I'm here whenever you need me. Look after yourself.",
  },
];

/*
 * How the assistant talks about each topic: a short opener, and for the main
 * topics one follow-up question with answers, like a school nurse's triage
 * questions. Options marked urgent are shown in red and always send the student
 * to a teacher and the school nurse.
 */
const NURSE_NOW = "tell a teacher and get the school nurse now";
const NurseNow = NURSE_NOW[0].toUpperCase() + NURSE_NOW.slice(1);

export const TOPIC_TALK: Record<string, { intro: string; ask?: Ask }> = {
  cut: {
    intro: "Let's get that cut cleaned and covered.",
    ask: {
      q: "Is it still bleeding after 10 minutes of firm pressure?",
      options: [
        { label: "Yes, still bleeding", urgent: true, say: `Keep pressing firmly without lifting the dressing, add more dressing on top if blood soaks through, and ${NURSE_NOW}. Bleeding that hasn't stopped after 10 minutes of firm pressure needs help.` },
        { label: "No, it's stopped", say: "Good. Rinse it with clean water, cover it with a plaster, and change it daily. Over the next few days, watch for redness, heat, swelling or pus: those mean infection, so tell the school nurse or your parents." },
        { label: "It's deep or gaping", urgent: true, say: `Keep pressure on it and cover it, and ${NURSE_NOW}. A deep or gaping cut may need closing with strips or stitches at a clinic.` },
      ],
    },
  },
  nosebleed: {
    intro: "Nosebleeds are common at school age and usually stop on their own.",
    ask: {
      q: "Has it been bleeding for more than 20 minutes?",
      options: [
        { label: "Yes, over 20 minutes", urgent: true, say: `Keep pinching the soft part of your nose and leaning forward, and ${NURSE_NOW}.` },
        { label: "No, it's slowing down", say: "Keep pinching for the full 10 to 15 minutes without checking. Afterwards, don't blow your nose, pick it or do PE for a few hours." },
      ],
    },
  },
  burn: {
    intro: "Cool it first: that's the most important thing you can do for a burn.",
    ask: {
      q: "How big is the burn, and what caused it?",
      options: [
        { label: "Smaller than my palm", say: "Keep cooling it under running water for the full 20 minutes, then cover it loosely with cling film or a clean dressing. Don't pop blisters. Tell the school nurse if it gets red, hot, swollen or oozes." },
        { label: "Bigger than my palm", urgent: true, say: `Keep cooling it, cover it loosely with cling film or a clean dressing, and ${NURSE_NOW}. Larger burns need medical advice.` },
        { label: "Chemical or electrical", urgent: true, say: `For a chemical burn (for example in a science lesson), rinse with plenty of water for at least 20 minutes and carefully remove anything contaminated. For an electrical burn, make sure the power is off before touching anyone. Either way, ${NURSE_NOW}.` },
      ],
    },
  },
  sprain: {
    intro: "Sorry, that sounds painful. Let's check how bad it is.",
    ask: {
      q: "Can you move it and put some weight on it?",
      options: [
        { label: "Yes, but it hurts", say: "It's most likely a sprain or strain. Rest it, use a cold pack for up to 20 minutes every 2 to 3 hours, wrap it firmly but not tightly, and keep it raised when you can, for 2 to 3 days. No sport until it moves without pain." },
        { label: "No, or it looks bent", urgent: true, say: `Don't try to straighten or move it. Support it in the position it's in, and ${NURSE_NOW}. It could be a broken bone or a dislocation.` },
        { label: "It's numb or tingly", urgent: true, say: `Loosen any bandage straight away, and ${NURSE_NOW}. Numbness, tingling, or skin turning pale or blue can mean a problem with the nerves or blood flow.` },
      ],
    },
  },
  fall: {
    intro: "Okay, let's check you over. Falls in PE and at break time are really common.",
    ask: {
      q: "Did you hit your head?",
      options: [
        { label: "Yes", urgent: true, say: `Then treat it as a head injury. Stop playing for the day, sit somewhere a teacher can see you, and hold a cold pack on any bump. ${NurseNow} if you have vomiting, confusion, drowsiness, a bad headache or blurred vision.` },
        { label: "No, but something hurts", say: "Tell me where it hurts, for example \"my wrist hurts\" or \"my back hurts\", and I'll give you the steps for it." },
        { label: "No, I feel fine", say: "Good. Still take it easy for a while and check yourself again later: some pain and bruising only shows up after a few hours." },
      ],
    },
  },
  bruise: { intro: "Bumps and bruises are part of school life. A cold pack helps most." },
  headache: {
    intro: "Headaches are one of the most common reasons students visit the school nurse. Let's look for the cause.",
    ask: {
      q: "How did it start?",
      options: [
        { label: "Slowly, a dull ache", say: "That's usually from not drinking enough, skipping a meal, poor sleep, screens or a stuffy room. Drink some water, have a snack, ask for a window to be opened, and rest your eyes for a few minutes." },
        { label: "Suddenly, the worst ever", urgent: true, say: `A sudden, severe headache needs help now. ${NurseNow}.` },
        { label: "With a fever or rash", urgent: true, say: `A headache with a fever, a stiff neck, a rash or feeling very drowsy needs checking straight away. ${NurseNow}.` },
        { label: "After hitting my head", urgent: true, say: `Then treat it as a head injury. Stop playing, sit where a teacher can see you, and ${NURSE_NOW}, especially if you're vomiting, confused or drowsy.` },
      ],
    },
  },
  nausea: {
    intro: "Sorry you're feeling sick. Let's work out what to do.",
    ask: {
      q: "Have you actually been sick (vomited)?",
      options: [
        { label: "Yes", say: "Tell a teacher: you should go home and rest. Sip water often, wash your hands well, and stay home until 48 hours after the last time you were sick, so it doesn't spread." },
        { label: "No, just queasy", say: "Sit somewhere with fresh air, sip water slowly, and tell a teacher. If you're travel sick on a school trip, look at the horizon and sit near the front." },
        { label: "I can't keep water down", urgent: true, say: `If you can't keep fluids down, you can get dehydrated quickly. ${NurseNow}, and your parents should be called.` },
      ],
    },
  },
  back: {
    intro: "Back pain in students is usually from heavy bags or long hours sitting.",
    ask: {
      q: "Do you have numbness, tingling or weakness in your legs?",
      options: [
        { label: "Yes", urgent: true, say: `Back pain with numbness, tingling or weakness in the legs needs help now. ${NurseNow}.` },
        { label: "No, just the pain", say: "Take off any heavy bag, stretch gently, use a warm pack, and keep moving. Lighten your bag (no more than about 10 to 15% of your body weight) and wear it on both shoulders." },
      ],
    },
  },
  eye: {
    intro: "Try not to rub it. Let's get it rinsed.",
    ask: {
      q: "What got into your eye?",
      options: [
        { label: "Dust or a particle", say: "Blink several times, then rinse the eye with clean water or eyewash. If it still feels like something's there, ask a teacher or the school nurse to look." },
        { label: "A chemical or liquid", urgent: true, say: `Rinse the eye with clean water or eyewash right away, holding the eyelids open, and keep rinsing for at least 20 minutes. Then ${NURSE_NOW}.` },
        { label: "My vision changed", urgent: true, say: `A sudden change in vision needs checking. ${NurseNow}.` },
      ],
    },
  },
  dehydration: { intro: "Thirst comes late, so it's easy to fall behind on water during the school day." },
  dizzy: {
    intro: "Let's get you steady first. Sit down.",
    ask: {
      q: "Is it happening with chest pain, a racing heart or trouble breathing?",
      options: [
        { label: "Yes", urgent: true, say: `Dizziness with chest pain, a racing heart or trouble breathing needs help now. Sit or lie down, and ${NURSE_NOW}.` },
        { label: "No, just dizzy", say: "Sit down, drink some water and eat something if you skipped a meal. Then check your heart rate and SpO2 in VITALS. If it keeps coming back, tell the school nurse." },
        { label: "I fainted", urgent: true, say: `Fainting needs checking. Lie down with your legs raised, have someone stay with you, and ${NURSE_NOW}.` },
      ],
    },
  },
  sleep: {
    intro: "Sorry you're struggling to sleep. Lots of students don't get enough.",
    ask: {
      q: "What's keeping you awake?",
      options: [
        { label: "My mind won't settle", say: "Try a fixed wind-down routine: screens away 30 to 60 minutes before bed, dim lights, and write down what's on your mind. Slow breathing helps too: in for 4 counts, out for 6. If worry keeps you awake for weeks, talk to a parent, teacher or the school nurse." },
        { label: "My phone or games", say: "Leave your phone outside the bedroom or on silent across the room. The light and notifications keep your brain awake." },
        { label: "Noise or light", say: "Use earplugs or an eye mask, and keep your room dark and cool." },
        { label: "Several nights now", say: "Several bad nights in a row affect learning and mood. Log your sleep in VITALS and talk to your parents or the school nurse." },
      ],
    },
  },
  fever: {
    intro: "Let's check how high it is.",
    ask: {
      q: "What's your temperature?",
      options: [
        { label: "Below 38 °C", say: "Rest, drink plenty of fluids and recheck in a few hours. Tell a teacher if you feel worse." },
        { label: "38 °C or higher", urgent: true, say: `With a fever you should go home. Drink fluids, and ${NURSE_NOW} so your parents can be called.` },
        { label: "Haven't measured it", say: "Ask the school nurse to measure it. Then tell me the number and I'll tell you what to do next." },
      ],
    },
  },
  skin: { intro: "Most rashes and itches at school are harmless, but some need checking." },
  stomach: {
    intro: "Sorry you're feeling rough. Stomach bugs spread quickly at school.",
    ask: {
      q: "Does anyone else in your class have it too?",
      options: [
        { label: "Yes, others too", urgent: true, say: `Several students with the same symptoms can mean a bug spreading or a problem with food. Wash hands with soap and water, avoid shared food, and ${NURSE_NOW} so the school can act.` },
        { label: "No, just me", say: "Rest, sip fluids often, and wash your hands carefully after every toilet visit. You should go home, and stay home until 48 hours after the last time." },
      ],
    },
  },
  cramp: { intro: "Cramps usually ease within a few minutes." },
  tooth: { intro: "Let's look after that tooth." },
};

/*
 * The "Did you know?" fact shown under each topic's first-aid steps: the heading of
 * a passage in the school-*.md files in /knowledge. Hand-picked, so the fact always
 * fits the topic. If a heading is renamed there, update it here too (a missing one is
 * just skipped).
 */
export const TOPIC_FACT: Record<string, string> = {
  headache: "Can not drinking enough cause headaches?",
  back: "How should a school bag be worn?",
  dizzy: "How do I know if I'm dehydrated?",
  eye: "How can I stop eye strain from screens and the board?",
  skin: "What should I do if I get a rash at school?",
  fever: "When should a sick child stay home from school?",
  dehydration: "What colour should my pee be?",
  nosebleed: "What should I do for a nosebleed?",
  tooth: "How often should I brush my teeth?",
  fall: "How can I tell if a bone is broken?",
  burn: "How do I treat a burn?",
  sprain: "What should I do for a sprain or strain?",
  cramp: "How can students prevent sports injuries?",
  stomach: "How can we stop a stomach bug spreading in class?",
  nausea: "How can we stop a stomach bug spreading in class?",
};

/**
 * A general question ("why does stale air make students tired?", "are energy drinks safe?")
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
export const FOLLOW_UPS = ["My head hurts", "My back hurts", "My wrist hurts", "My ankle hurts", "I feel dizzy", "I fell in PE", "I feel fine"];

export const SUGGESTIONS = ["I cut my finger", "I have a headache", "I twisted my ankle", "I feel sick", "How much water should I drink?", "How heavy should my school bag be?"];
