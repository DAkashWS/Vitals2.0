# CLAUDE.md

## User preferences
- Address the user as "BRO". No emojis.

## Token-saving rules
- Answers: short and direct. No recaps, no restating the question, no listing options I won't pursue.
- Don't re-read files already in context; read only the line ranges needed.
- Search with Grep/Glob before opening files; don't dump whole large files.
- Batch independent tool calls in one turn.
- Don't spawn subagents unless asked.
- Skip verification re-reads after edits (Edit errors if it fails).
- Ask a question only when truly blocked; otherwise pick the sensible default and say so in one line.
- Never read lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`), `.next/`, `dist/`, or `node_modules/`.
- When adding 21st.dev or shadcn UI components, keep pasted code/SVGs intact in clean modular files, and use `lucide-react` instead of generating new inline SVGs from scratch.
- Only read a full file when refactoring the whole UI component or when the file is under 150 lines; otherwise use Grep + Read (offset/limit).
- Keep this file small; add project facts below only when they save future exploration.

## Workflow
- Cloud session: container is ephemeral. Commit and push work to the session's branch before ending.

## Project
- Vitals2.0: repo is currently empty (no code yet). Update this section once a stack is chosen
  (build/test/lint commands, key directories).
