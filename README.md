# VITALS website

Themed landing page for **VITALS** by team **Mission 61:4**, our NASA Space Apps Challenge 2026 entry: offline software that helps astronauts on long missions spot health changes early and act on them.

React 19 + TypeScript + Tailwind CSS + Vite, laid out like shadcn (`src/components/ui`). It builds to plain static files with relative paths, so it works on GitHub Pages.

## Run it

```bash
npm install
npm run dev        # http://localhost:5190
npm run build      # outputs dist/
npm run preview -- --port 5190 --host   # serve the build, also to other devices on the same network
```

## Chatbots (online only)

- Every chatbot asks the **"chat" Edge Function** in the Vitals 2.0 Supabase project (`supabase/functions/chat`), which uses Google Gemini with a school-health instruction for each bot and keeps each bot to its own topic. Only signed-in users can use it.
- Its key is the Edge Function secret `GEMINI_API_KEY` (Supabase dashboard → Edge Functions → Secrets), never in the site or the repo. `GEMINI_MODEL` can change the model (default `gemini-2.5-flash`).
- **Emergencies** (chest pain, breathing trouble, fainting or seizures, heavy bleeding, head injuries, severe allergic reactions) are answered instantly in the browser with fixed steps (`src/lib/firstAid.ts`), even offline. Everything else needs the internet.
- There is no offline knowledge library and no local AI model.

## Page sections and the components behind them

| Section | Component | Notes |
|---|---|---|
| Whole-page background | `ui/kinetic-grid.tsx` | Grid warps toward the cursor, ripples on click. Drawn once, flat, with reduced motion. |
| Hero: "VITALS" | `ui/glyph-portal.tsx` | Scroll flies the camera into a letter, then shows the challenge and our answer. MIT, © Christian Katzmann; keep the notice. |
| Modules | `ui/perspective-tunnel-hero.tsx` | 3D tunnel of the five modules and four space risks. "Crew health profile" links to the crew cards, "Health intelligence" to the assistant. |
| Readings | `sections/Sections.tsx` | Green and yellow ranges for the 9 readings. |
| Assistant | `sections/Assistant.tsx`, `lib/firstAid.ts`, `lib/knowledge.ts`, `knowledge/` | Offline chat: type an injury or symptom to get first-aid steps and when to contact the flight surgeon, or ask a question to get an answer from the knowledge library with its source. Red-flag symptoms go straight to "get help now". |
| Mission 61:4 | `ui/scroll-expansion-hero.tsx` | Media expands as you scroll, then the four-step demo story. |
| Crew view | `ui/holo-card.tsx` | One crew health card per team member: tilt, drag to spin, tap to flip to the personal baseline. |
| Buttons | `ui/liquid-glass-button.tsx`, `ui/shiny-button.tsx`, `ui/rainbow-button.tsx` | Three kinds, all liquid glass. **Shiny** (21st.dev) for the main action in a spot: See modules, Pair a device, Open hygiene, Sign in, saving your crew card, Confirm pairing, Show my vital card, Start Day, Open the Live monitor / Crew Link, Create crew, Join crew, Accept, Invite. Its colour follows the spot (`tone`: sky, violet, emerald, amber, rose). **Rainbow** (21st.dev) for a few standout moments: Mission 61:4, Add card / Take my readings, Add to crew, Preview with the demo crew; its rainbow uses the site's sky, cyan, violet, indigo and emerald. **LiquidButton** for everything else (secondary actions, chips, icons, tabs); its glass distortion shows in Chrome and Edge, other browsers get the glass rim. Both new buttons carry the same glass rim and stay still with reduced motion. The shiny button's CSS is in `index.css` (the original used Next.js `<style jsx>` and Google Fonts, neither of which this offline Vite site uses). |

Changes from the original 21st.dev versions:

- **Perspective Tunnel** and **Scroll Expansion** no longer trap the mouse wheel. Both used to block the page's scroll (Scroll Expansion even forced the page back to the top). Now each is a tall section with a sticky stage, and the page's own scroll drives the animation, so touch and keyboard work too. Tunnel cards can also be links.
- **Scroll Expansion** uses plain `<img>` instead of `next/image`, since this is a Vite site, not Next.js.
- **Holo Card** is a crew ID card instead of a payment card: name, role, status (green / yellow / red), crew ID and mission (61:4) on the front, baseline readings on the back. It has no card number or CVV.
- **Tilted Grid Hero** isn't included: only the end of its demo was pasted, without `tilted-grid-hero.tsx` itself.

## Live monitor (`#/live`)

The **Live monitor** section on the main page (and "Live monitor" in the top menu) opens a separate page at `#/live`, in `src/live/`:

1. **Pair a device** over **Bluetooth**, **Wi-Fi** or a **USB cable**, or pick the **demo device** (simulated readings, no hardware). The USB list only shows the USB-serial chips ESP32 boards use (CP210x, CH340, ESP32 USB, FTDI), so built-in ports like COM1 don't appear; "Show all ports" lists everything. "Devices ready to pair" lists devices paired before, and a USB sensor used before is recognised as soon as it's plugged in. Browsers make you pick a new device yourself the first time; no site can grab one silently.
2. **Confirm pairing**.
3. **What's your name?** (remembered in this browser only).
4. **Your vital card** at the top (the Crew section's card, with your name, live status and readings on the back), with a greeting, the overall status and the device; then the readings as large tiles with emojis: heart rate, SpO2, ECG heart rate, room temperature and humidity, the ECG trace, cabin air and the daily log. Each tile says where its value comes from: **Live** (sensor), **Demo**, **Typed in** or **No reading**. With real hardware, nothing is simulated: readings the sensor doesn't measure stay empty and can be typed in (e.g. the daily log of sleep, water and exercise). If a port sends nothing for 6 seconds, the page says it's probably the wrong port and what to check. Ranges are the same as the Readings section (`src/content.ts`).

| Connection | How | Browsers |
|---|---|---|
| USB cable | Web Serial, 115200 baud, the JSON lines from `hardware/vitals_firmware` | Chrome / Edge on a computer |
| Bluetooth | Web Bluetooth, BLE Nordic UART Service (`6e400001-…`); device name starts with `VITALS`; JSON lines notified on TX (`6e400003-…`), page writes to RX (`6e400002-…`) | Chrome / Edge on a computer or Android |
| Wi-Fi | WebSocket `ws://<address>:81/` (default `vitals.local`), one JSON line per message | Any, but only when the site is opened over **http** on the same network (browsers block it from https pages, like the tunnel link) |

All three carry the same data format as the firmware (see `hardware/README.md`), plus optional `ecgSimulated`; room temperature and humidity come from `cabinTemp` and `cabinHumidity` (DHT11). The page sends typed-in body values back every 2 seconds as `{"sim":{...}}` for OLED 3. **The firmware only speaks USB so far**: Bluetooth and Wi-Fi need the firmware to add the BLE service and the WebSocket server above.

`hardware/vitals_firmware_v2/` adds a **body temperature sensor** (MAX30205 or MLX90614) and a **simulated ECG** for when no electrodes are attached; see its README. (The website no longer shows body temperature: it uses the DHT11 room temperature and humidity instead.) A simulated ECG is labelled **Simulated** on the page and never counts towards the health status. The demo device sends a simulated ECG and body temperature too.

## Crew Link (`#/crew-link`)

Crew members link their crew cards into one crew and look after each other. It opens from **Health → Crew Link** in the floating menu, **Explore**, or **Open Crew Link** on the account page. `src/crewlink/CrewLinkPage.tsx`, with the data side in `src/lib/crewLink.ts`.

- **Create crew or Join crew** (two liquid-glass buttons).
  - **Create crew:** name the crew, then tap the **^** button: a search pops up above it, and typing a name or any part of a crew card number shows the best few matches as small crew cards (so two people with the same name can be told apart). Tap one to add it. Nothing is listed until you type, so it stays tidy with thousands of accounts. Each person picked gets an invitation to accept or decline on their own Crew Link page; nobody is added without saying yes. The creator leads the crew and can invite more cards later.
  - **Join crew:** type the crew's code, 10 random digits like `48213-90375`. Every crew gets its own; the database makes sure no two crews share one.
  - One crew per person, up to 12 members. If the lead leaves, the longest-serving member takes over.
- **Crew card numbers** are random ("2026" + 12 digits) and unique per account, checked by the database.
- **Live crew board.** A wide board with one large panel per crew member: their own holographic crew card (tilt, spin, tap to flip to their latest readings) and all nine readings from their account: heart rate, blood oxygen, ECG heart rate, room temperature, humidity, air quality, sleep, water and exercise, each with its normal range and coloured when it leaves it. Each person takes their readings in their own account on the Live monitor; they sync to the account and show on every crewmate's board within seconds (Supabase Realtime, with a 30-second refresh as a fallback). Each heart icon beats at that person's heart rate.
- **Crew readiness, alerts and cabin.** The share of the crew that is green and live, a list of who needs attention (a reading in yellow or red, a help call, or no sync for an hour), and the cabin's average temperature and humidity across everyone's sensors, flagging modules that differ by 3 °C or more.
- **Buddy pairs.** Everyone is paired with a crewmate in the order they joined (a trio if the number is odd), and gets a one-tap **Buddy check**.
- **Check-ins and the crew log.** "I'm good", "Feeling off", "Need help" or a note, shared with the crew. "Need help" also reminds them to contact the flight surgeon.
- **Offline.** The last board is kept on the device and shown at once with no connection. Check-ins written offline wait in an outbox and are sent when the link is back; each carries an ID made on the device, so a re-send is never stored twice.
- **Demo crew.** Guests, and anyone who taps **Preview with the demo crew**, see the team's crew cards as a simulated crew.

**Privacy.** Joining a crew shares your status, your latest readings and when you last synced with your crewmates, the same as commanders see. Your full history stays private. The database enforces this: crews are made, joined and left only through its functions, and members can read only their own crew.

**Setup.** Run `supabase/schema.sql` again in Supabase → SQL Editor. The new "Crew Link" part adds the `crews`, `crew_members` and `crew_log` tables, the `crew_invites` table, the `create_crew`, `join_crew`, `crew_directory`, `invite_to_crew`, `my_invites`, `accept_invite`, `decline_invite`, `leave_crew` and `crew_roster` functions, their access rules, and Realtime for `crew_status` and `crew_log`. It's safe to run more than once.

## Hygiene & sanitation (`#/hygiene`)

The **Hygiene & sanitation** section on the main page (and "Hygiene" in the top menu) opens its own page, `src/hygiene/HygienePage.tsx`:

- **Today's score**: how many of the 12 daily items are on track, with a progress bar. Not-yet-done items are yellow "To do"; red is only for real problems (a failed water check, mould found, a week in the same clothes).
- **Personal hygiene**: hand cleaning (count, green 5+ a day), teeth brushed (green twice a day), flossed, body wipe-down, skin moisturised, days in the same clothes (green 3 or fewer).
- **Cabin sanitation**: shared surfaces wiped, food area cleaned, toilet cleaned & checked, waste bagged & stowed, water quality check (passed / not done / failed), mould & damp check (all clear / not done / found).
- **Hygiene assistant**: its own chatbot (the same engine as the main assistant, `ChatPanel` in `sections/Assistant.tsx`) limited to the hygiene and sanitation library (`knowledge/hygiene-*.md`, `cabin-air-water-food.md`) and to the skin, stomach, teeth, cut, eye and nausea first-aid topics. Red flags still always get "get help now".

The log is kept in that browser only and starts fresh each day. The targets are **draft values** that need the team's review.

At the top is your **hygiene vital card** (`hygiene/HygieneCard.tsx`, set in **Jost**, bundled from `@fontsource/jost`): your name, your cabin and a **hygiene score out of 100**. The score is weighted and **scaled to your cabin** (`hygiene/model.ts`): more crew sharing it raises the hand-cleaning target and the weight of hands, surfaces, toilet and waste; humidity of 60% or more makes the mould check count double (triple from 70%); 30% or less makes skin care count double; poor air quality makes surfaces and waste count more. Humidity and air quality come from the Live monitor's sensor automatically when it has paired in the last 15 minutes, or you type them in.

## Environment (`#/environment`)

Vishnu's research on cabin temperature, CO2, radiation, humidity and pressure: the health risks and how space agencies handle them, with sources. It opens from the **Environment monitor** card in the Modules tunnel (not from the top of the main page or the menu). `src/environment/EnvironmentPage.tsx`.

## Bone & Muscle (`#/bone`)

The gist of Nithin's research on how spaceflight affects the body, with a focus on bone and muscle (adapted from Wikipedia, "Effect of spaceflight on the human body", CC BY-SA 4.0, credited on the page): headline numbers, the big picture, muscle and the fibre switch, bone and the cell balance, the ISS gym, and NASA's digital astronaut. It opens from the **Bone and muscle** card in the Modules tunnel. At the bottom is the **bone & muscle coach** chatbot, answering from `knowledge/bone-muscle-research.md` and `knowledge/bones-muscles-exercise.md`. `src/bone/BonePage.tsx`.

Each chatbot has its own colour theme and avatar (`tone` and `avatar` in its `ChatScope`): the main assistant sky, hygiene emerald, space medicine violet, bone & muscle amber.

## Isolation (`#/isolation`)

The gist of the team's research on isolation: the two kinds (social and physical), its effects on the mind, why it gets worse on the way to Mars, how astronauts cope, Earth analog missions (HI-SEAS, Mars-500, Antarctica, CHAPEA), hospital isolation classes N, P, S and Q, and other meanings of the word. It opens from the **Isolation** card in the Modules tunnel (the Radiation card was removed). At the bottom is the **crew support** chatbot, answering from `knowledge/isolation.md`. `src/isolation/IsolationPage.tsx`.

## Space Medicines (`#/medicine`)

Nithin's research on space medicine: what it is, the medical risks of spaceflight (blood clots, heart rhythm, decompression illness and barotrauma, immune system, infection, fatigue, balance, bone, muscle, eyesight, brain), sleep medicine in flight, and training. It opens from the **Space Medicines** card in the Modules tunnel. The text is adapted from the Wikipedia article "Space medicine" (CC BY-SA 4.0), credited on the page as the licence requires. `src/medicine/MedicinePage.tsx`.

At the bottom is the **space medicine assistant**, a chatbot that answers only from `knowledge/space-medicine.md` (Nithin's research, one passage per question: blood clots, DCS and barotrauma, immune system, infections, fatigue, balance, bone, muscle, SANS, the brain, sleep medicines, training). Red flags like chest pain still get the emergency steps, and it points to the main assistant for injuries.

## Knowledge library

The `knowledge/` folder holds what the assistant knows beyond first aid: plain Markdown files, one passage per `## ` section, each with a title and a source. It starts with 17 files and about 120 passages, written in our own words from public NASA information and Wikipedia:

- general: greetings, what VITALS is, the team, what the readings mean in space;
- the body in space: the five hazards, fluid shift and vision, bones, muscles and exercise, surprising changes (growing taller, peeling feet, space anemia, "space fever", tears, kidney stones, immune changes);
- risks and emergencies: radiation (including light flashes and the South Atlantic Anomaly), fire, depressurisation, ammonia leaks, CPR in weightlessness, spacewalks and the bends;
- daily life: sleep (including CO2 pockets around the head), mood, boredom and conflict, motion sickness, cabin air, water, food, hygiene, skin and teeth;
- beyond orbit: the Moon and Mars (dust, gravity, message delays) and returning to Earth.

When someone asks a question, `src/lib/knowledge.ts` searches the library offline (BM25 keyword ranking, the classic search-engine method) and shows the best one or two passages with their source. There's no AI model, so the assistant only ever says what's written in the library, which keeps it predictable and safe. If nothing matches, it says so and asks where it hurts.

How it decides what to answer:

1. **Red flags** (chest pain, trouble breathing, fainting…) always come first: "get help now". The one exception is a general question with a strong library answer, like "why do astronauts faint after landing?". Anything about "I" or "my" stays on the safe path.
2. **First-aid topics** get a short opener, the steps, when to contact the flight surgeon, a hand-picked "Did you know?" fact (`TOPIC_FACT` in `firstAid.ts`), and for 12 topics a **follow-up question** with answer buttons, like a medic's triage (`TOPIC_TALK`). Typed answers like "yes", "no" or "first few days" work too. Urgent answers are shown in red.
3. **"Why / what / is it normal" questions** with a very strong library answer get the explanation instead of first-aid steps.
4. **Small talk**: hello, thanks, how are you, good night, I'm scared.
5. **The library**: the best passage, its source, and "You might also want to know" buttons with related questions.
6. If nothing matches, it says so and asks where it hurts, with buttons.

To add information, add or edit a file in `knowledge/`; see `knowledge/README.md` for the format and for how to credit NASA and Wikipedia. The site bundles the files at build time, so there's no extra step. The starter files still need the team's review (Vishnu) before the demo.

## First-aid assistant

`src/lib/firstAid.ts` holds every answer as plain text: 16 topics (cuts, burns, sprains, falls, headache, nausea and more) and a list of red flags (chest pain, trouble breathing, loss of consciousness, heavy bleeding, head injury, severe allergic reaction). The advice is general first aid based on NHS and Red Cross style guidance, adapted for a spacecraft. **It still needs review by the team (Vishnu) before the demo.** It's decision support, not a diagnosis.

## Images and video

Every media path lives in `src/media.ts`, and the files are in `public/media/`. They're placeholder space photos from Unsplash until the **Seedance 2.0** clips are ready. To use a clip:

1. Put the file in `public/media/`, for example `public/media/mission-61-4.mp4`.
2. In `src/media.ts`, set `missionVideo: "media/mission-61-4.mp4"` and `missionType: "video"`. Tunnel cards and the hero image swap the same way.
3. Keep paths relative (no leading `/`).

## Words

All copy is in `src/content.ts` (modules, readings, demo story, crew, team), taken from the "VITALS: Project Gist" doc. The crew cards are our six team members with **sample** readings for the demo.
