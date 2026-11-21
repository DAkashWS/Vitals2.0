# Chatbot test report

Model: Ollama `vitals` (gemma3:270m). Each question is sent with the best-matching library passage, as the website does. "Grounding" is the share of the answer's words that come from the passage or the question; the website rejects answers under 75 % and shows the library passage instead. Emergencies on the website are answered by the fixed first-aid rules before the model is asked.

## why is my face puffy in space

- **Passage used:** Why does my face look puffy in space? (fluid-shift-and-vision.md)
- **Answer:** The puffy face, bird legs, and swelling caused by weightlessness are common symptoms of a sudden shift in body fluid composition.
- **Grounding:** 64 % · **rejected, the site shows the library passage instead**

## why do i feel less thirsty up here

- **Passage used:** Why do I feel less thirsty in space? (fluid-shift-and-vision.md)
- **Answer:** The feeling of less thirst is due to the body's adaptation to weightlessness. Astronauts can lose body water without noticing, which helps them stay hydrated.
- **Grounding:** 61 % · **rejected, the site shows the library passage instead**

## how much sleep should i get

- **Passage used:** How much sleep should I get? (sleep-and-mind.md)
- **Answer:** You should get at least 7-9 hours of sleep per night.
- **Grounding:** 71 % · **rejected, the site shows the library passage instead**

## i keep waking up with a headache

- **Passage used:** How do astronauts keep from getting bored? (isolation-deep.md)
- **Answer:** You should get at least 7-9 hours of sleep per night.
- **Grounding:** 0 % · **rejected, the site shows the library passage instead**

## is space radiation dangerous

- **Passage used:** What is space radiation made of? (radiation-cancer.md)
- **Answer:** Space radiation is harmful to astronauts because it can cause damage to their DNA and other cells.
- **Grounding:** 27 % · **rejected, the site shows the library passage instead**

## how do astronauts wash their hair

- **Passage used:** How do astronauts wash their clothes? (hygiene-skin-teeth.md)
- **Answer:** Astronauts wash their hair by using a shampoo and conditioner that is designed to be gentle and leave it feeling fresh and clean.
- **Grounding:** 38 % · **rejected, the site shows the library passage instead**

## why do my bones get weaker in space

- **Passage used:** Why do bones get weaker in space, and how much bone is lost? (space-medicine.md)
- **Answer:** Bone loss in spaceflight is called spaceflight osteopenia. Calcium leaks out of the bones in microgravity. After 3 to 4 months in space, it takes about 2 to 3 years to regain the lost bone density. Diet and exercise, vibration therapy, and medicines that boost bone growth are being studied to speed recovery.
- **Grounding:** 100 % · **accepted**

## i feel low and lonely on this mission

- **Passage used:** Why do I feel low in the middle of a long mission? (sleep-and-mind.md)
- **Answer:** You may be feeling low in the middle of a long mission studies the phenomenon of "third-quarter syndrome" after the halfway point. It's common for crews to experience this, and it can help you appreciate the journey and the camaraderie. Plan things to look forward to, keep routines, and talk to crewmates or the mission psychologist.
- **Grounding:** 81 % · **accepted**

## what happens if the cabin loses pressure

- **Passage used:** What happens if the cabin loses pressure? (emergencies-on-board.md)
- **Answer:** If the cabin loses pressure, it can lead to a leak that lets air escape into space. A small leak is found and sealed while the crew watches the pressure. In a rapid loss of pressure, the crew follows the depressurisation procedure: gather, close hatches to isolate the leaking module, and be ready to leave in the docked spacecraft. Early signs of low pressure or low oxygen are ear popping, headache, dizziness and confusion.
- **Grounding:** 98 % · **accepted**

## my shoulder aches after the spacewalk, is that bad

- **Passage used:** Why do fingers and nails hurt after a spacewalk? (spacewalks.md)
- **Answer:** Yes, your shoulder aches after the spacewalk. Pressurised spacesuits gloves are stiff, and gripping tools for hours against that stiffness tire the hands. Fingertips pressing on the glove ends can bruise the nail beds, and some astronauts have even lost fingernails after spacewalks. Trimming nails short beforehand and well-fitted gloves help. Numbness or lasting pain should be reported.
- **Grounding:** 95 % · **accepted**

## what room temperature and humidity does vitals look for

- **Passage used:** What room temperature and humidity does VITALS look for? (vitals-readings-in-space.md)
- **Answer:** VITALS reads the room's temperature and humidity from its DHT11 sensor. It treats 18 to 33 °C as green and 16 to 36 °C as the yellow watch range. For humidity, 30 to 60 % is green and 25 to 75 % is yellow. Warm or dry air makes you lose water faster and dries out your eyes, nose and skin, so drink on a schedule and check the CO2 and airflow too.
- **Grounding:** 100 % · **accepted**

## what is the best medicine for a headache

- **Passage used:** How would a Mars crew get medicine? (space-medicine-deep.md)
- **Answer:** A Mars crew would need to carry everything, or make it. Researchers are studying how to grow medicine-producing microbes and plants and how to 3D-print tablets on demand, because a resupply ship could take many months.
- **Grounding:** 96 % · **accepted**

**Result: 6 of 12 answers accepted.**
