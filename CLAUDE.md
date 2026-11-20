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
- Keep this file small; add project facts below only when they save future exploration.

## Workflow
- Cloud session: container is ephemeral. Commit and push work to the session's branch before ending.

## Project
- Vitals2.0: repo is currently empty (no code yet). Update this section once a stack is chosen
  (build/test/lint commands, key directories).
