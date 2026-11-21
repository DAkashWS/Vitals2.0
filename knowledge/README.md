# VITALS knowledge library

Everything in this folder is what the assistant "knows" beyond its first-aid rules. When someone asks a question, the assistant searches these files offline, finds the closest passages, and shows them with their source. There's no AI model: the answers are exactly what's written here, so what you write is what the crew reads.

## Where the information should come from

- **NASA** (nasa.gov, the Human Research Program, astronaut health pages): the main source. NASA material is generally public domain, so you can use it freely. Set `source:` to the NASA page or programme, e.g. `NASA Human Research Program`.
- **Wikipedia**: fine for general background. Wikipedia text is licensed CC BY-SA, so either summarise it in your own words, or if you copy sentences, credit it, e.g. `source: Wikipedia, "Effect of spaceflight on the human body" (CC BY-SA 4.0)`.
- Other websites, books and papers are usually copyrighted: summarise them in your own words and name the source.

## How to add information

1. Add a new `.md` file here, or add a section to an existing one.
2. Start the file with a title and a source:

   ```
   ---
   title: Fluid shift
   source: NASA Human Research Program
   ---
   ```

3. Split it into sections, each starting with `## ` and a heading written like the question someone would ask, for example `## Why does my face look puffy in space?`. Each section is one answer the assistant can show, so keep each one short (2–6 sentences) and about one thing.
4. Use the words people would type. The search matches words, so a section about loneliness should actually say "lonely" and "homesick", not only "isolation".
5. Save. The site picks it up automatically (restart `npm run dev` if it doesn't).

This file (README.md) is not searched.

## Review

The starter files are general background written from public NASA information. They are not medical advice, and they need review by the team (Vishnu) before the demo, like the first-aid rules.
