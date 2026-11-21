// Site copy, taken from the "VITALS: Project Gist" doc. Edit words here, not in the sections.

export const modules = [
  {
    title: "Crew health profile",
    caption: "Each astronaut's water, exercise, sleep, fatigue, heart rate and symptoms, measured against their own normal.",
    href: "#crew",
  },
  { title: "Environment monitor", caption: "The air you can't feel: cabin heat, CO2, radiation, humidity and pressure.", href: "#/environment" },
  {
    title: "Health intelligence",
    caption: "Connects the dots between readings and raises the alarm early. Hurt? Ask the assistant.",
    href: "#assistant",
  },
  {
    title: "Scenario simulator",
    caption: "Rehearse the bad days: CO2 build-up, a radiation storm, dehydration, sleepless nights, a spacewalk.",
    href: "#/simulator",
  },
  { title: "Offline support", caption: "First-aid steps, a built-in assistant and a flight surgeon report, with no signal needed.", href: "#/offline" },
  { title: "Bone and muscle", caption: "Without gravity, bones and muscles waste away. Every minute of exercise fights back.", href: "#/bone" },
  { title: "Isolation", caption: "Months in a small cabin, far from home. Mood, sleep and reaction time, tracked all mission.", href: "#/isolation" },
  { title: "Fluid shift", caption: "Fluids drift towards the head, so your thirst lies to you. VITALS doesn't.", href: "#/fluid" },
  {
    title: "Space Medicines",
    caption: "How doctors keep a crew healthy far beyond the nearest hospital.",
    href: "#/medicine",
  },
];

export type Reading = { name: string; key: string; green: string; yellow: string; unit: string };

// Draft ranges for a healthy adult at rest; being verified against NHS, AHA and NASA sources.
export const readings: Reading[] = [
  { name: "Heart rate", key: "heartRate", green: "60–100", yellow: "50–110", unit: "bpm" },
  { name: "Oxygen (SpO2)", key: "spo2", green: "95–100", yellow: "92–100", unit: "%" },
  { name: "Room temperature", key: "roomTemp", green: "18–33", yellow: "16–36", unit: "°C" },
  { name: "Humidity", key: "humidity", green: "30–60", yellow: "25–75", unit: "%" },
  { name: "Sleep", key: "sleep", green: "7–9", yellow: "6–10", unit: "hrs" },
  { name: "Water intake", key: "waterIntake", green: "2.5–3.5", yellow: "1.8–4.0", unit: "L/day" },
  { name: "Exercise", key: "exercise", green: "30–180", yellow: "15–240", unit: "min/day" },
];

export const missionSteps = [
  { t: "06:00", title: "Readings drift", body: "Sleep slips to 6.4 hours and water to 2.1 litres. On their own, each is just a yellow flag, easy to shrug off." },
  { t: "09:40", title: "An alert fires", body: "The astronaut logs a headache. VITALS spots that cabin CO2 rose at the same time, and links the two." },
  { t: "09:41", title: "The report explains", body: "What changed, what changed together, which part of the cabin may be to blame, and what to check first." },
  { t: "10:15", title: "The crew acts", body: "Check the air, drink 500 ml, rest. If the headache stays, the report is already waiting for the flight surgeon." },
];

// The crew cards: the team's own readings, stored in the browser database by src/lib/crewDb.ts
// (bump TEAM_VERSION there after changing them). Status is worked out from the Readings ranges
// above, never typed in. A reading the team hasn't given is left out, not filled in.
// Air quality is "% worse than clean air"; +0 % for everyone.
export const crew: {
  name: string;
  role: string;
  crewId: string;
  readings: { heart?: number; spo2?: number; ecg?: number; room?: number; humidity?: number; sleep?: number; air?: number };
}[] = [
  { name: "Akash", role: "Team Lead + Software", crewId: "2026 5183 3747 9358", readings: { heart: 100, spo2: 99, ecg: 80, room: 23.6, sleep: 7.5, air: 0 } },
  { name: "Darsan", role: "Charts", crewId: "2026 1253 7207 7473", readings: { heart: 90, spo2: 100, room: 23, sleep: 9, air: 0 } },
  { name: "Nithin", role: "Logic + Intelligence", crewId: "2026 9656 1490 0352", readings: { heart: 93, spo2: 99, ecg: 85, room: 23.5, sleep: 7.5, air: 0 } },
  { name: "Vishnu", role: "Research", crewId: "2026 5211 8437 9812", readings: { heart: 95, spo2: 99, room: 22.9, sleep: 8, air: 0 } },
  { name: "Kirthik", role: "Hardware + QA", crewId: "2026 0779 0821 9505", readings: { heart: 90, spo2: 100, ecg: 85, room: 23.4, sleep: 8.5, air: 0 } },
];

export const unique = [
  { title: "Space baselines, not Earth's normal", body: "Every astronaut is measured against their own in-flight normal, not a textbook average." },
  { title: "Space-only risks", body: "Radiation, bone loss and isolation never show up on a smartwatch. In VITALS, each one has its own place." },
  { title: "Body plus environment", body: "A headache next to a CO2 spike is no coincidence. VITALS links the two and says \"check the air\"." },
  { title: "Works offline", body: "No phone, no cloud, no signal. Exactly right when a message to Earth takes minutes." },
  { title: "Tells you what to do next", body: "Every alert comes with a clear next step, and the moment it's time to call for help." },
  { title: "Crew view", body: "The commander sees at a glance who's doing fine and who's struggling." },
  { title: "Flight surgeon report", body: "A ready-made report, written to survive the long delay to Earth." },
  { title: "Works with watches", body: "A wearable is just one data source. VITALS is the brain that sits on top." },
];

export const team = [
  { name: "Akash", role: "Team Lead + Software" },
  { name: "Darsan", role: "Charts" },
  { name: "Nithin", role: "Logic + Intelligence" },
  { name: "Vishnu", role: "Research" },
  { name: "Kirthik", role: "Hardware + QA" },
  { name: "Ms. Aarthy", role: "Educator" },
];
