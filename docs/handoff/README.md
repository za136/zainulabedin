# Handoff protocol

Any agent (Claude Code, Gemini / Antigravity, Codex, Cursor, a human) must be able to stop and another
must be able to continue from the files alone. No chat history is required.

## Where things are

| Level | File | Contains |
|---|---|---|
| Repo | `AGENTS.md` (= `CLAUDE.md` = `GEMINI.md`) | Rules and conventions for every agent. Read first. |
| Repo | `HANDOFF.md` | Current state of everything, environment notes, global next actions, session log. |
| Registry | `projects.toml` | Machine-readable list of factories, projects and ventures, with handoff paths and run/test commands. |
| Factory | `docs/factories/F<n>-*.md` | Mission, modules in this repo, projects, roadmap, next actions. |
| Project | `docs/projects/P<nn>-*.md` or `apps/<name>/HANDOFF.md` | Status, how to run and test, decisions, blockers, next actions, log. |

## Rules

1. **Start of a session:** read `AGENTS.md`, then `HANDOFF.md`, then the handoff of the factory/project you work on.
2. **End of a session (or before you stop for any reason):** update the project handoff
   (Status, Next actions, Session log) and the table in `HANDOFF.md`. Run `zf handoff check`.
3. Handoffs state facts: what exists, what was verified (with the command), what was not. No guesses
   presented as facts; label assumptions as assumptions.
4. Keep the required sections (see `TEMPLATE.md`). `zf handoff check` fails if one is missing.
5. Secrets never go into handoffs. Refer to environment variable names instead.
6. Source of truth for plans and research is the Google Drive "Factory HQ" (titles are cited in each
   handoff); the repo is the source of truth for code and its status.
