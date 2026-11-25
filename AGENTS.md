# AGENTS.md: instructions for every AI agent and developer

This file is identical in `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` (`zf handoff check` enforces it).
Edit `AGENTS.md`, then run `scripts/sync-agent-files.sh`.

## Read in this order
1. This file.
2. `HANDOFF.md`: current state of every factory and project, environment notes, what to do next.
3. The handoff of the factory or project you are working on (paths in `HANDOFF.md` and `projects.toml`).
4. `docs/handoff/README.md` if you have never worked in this repo.

## Owner context
- Solo developer (Zain). Target market: DACH (Germany, Austria, Switzerland). Product UX German-first
  or English with DACH focus; code, comments and docs in English.
- Budget for tools is EUR 0: prefer free and open-source; flag any paid service before adding it.
- Hardware: Lenovo i5-7300U / 16 GB (main dev machine, moving to Debian-based Linux), an older NVIDIA
  laptop (Linux Mint), a storage laptop. No Mac. See `docs/testing/mobile-and-web.md`.
- Plans and research live in the Google Drive "Factory HQ" (START HERE doc, Master Tracker sheet,
  one MAIN doc + Agent Brief + Architecture & Roadmap per factory, one Project Brief per project).
  Build on that research; do not redo it.

## Repo map
```
AGENTS.md / CLAUDE.md / GEMINI.md   this file (identical copies)
HANDOFF.md                          state of everything + session log
projects.toml                       registry: factories, projects, ventures, handoff paths, commands
apps/mahn-agent/                    P01 Mahn-Agent (Python/FastAPI, Claude agent, Docker)
apps/zainlabs/                      ZAIN LABS website (Next.js) + iOS/Android app (Expo) + shared content
src/zfactory/                       factory engines + `zf` CLI (software, app, web, studio, research)
specs/                              input specs for the factory engines
docs/factories/                     F1–F5 handoffs
docs/projects/                      P02–P11 handoffs (P01 lives in apps/mahn-agent/HANDOFF.md)
docs/testing/                       how to test web, iOS and Android on the owner's laptops
ventures/                           business ventures (clinic, spa, studio, setups)
scripts/                            verify.sh (run every test/build), sync-agent-files.sh
```

## Rules
- Work in small, reviewable steps. End each step with: decisions, assumptions, risks, artifacts, next step.
- **Update the handoff before you stop**: project handoff (Status, Next actions, Session log) and the
  table in `HANDOFF.md`. Then run `zf handoff check`.
- Tests with every change. A feature is done only when it works on seeded demo data and the tests pass.
  Run `scripts/verify.sh` before committing (or at least the tests of what you touched).
- Tests stay offline: no real API calls, no network in unit tests.
- Every factory and product must run without API keys (template / demo mode). LLM features are optional layers.
- Ask the owner before anything that sends messages, spends money, deletes data or publishes publicly.
  Products keep humans in the loop for such actions (see Mahn-Agent ADR-002).
- Medical / cosmetic content: no outcome guarantees, keep disclaimers.
- Never commit secrets. Use `.env` files (ignored) and document variable names in `.env.example`.
- Log non-trivial decisions as ADRs (`docs/decisions/` inside the project) and keep
  assumptions / open questions registers up to date.
- Register every new project in `projects.toml`, give it a handoff file from `docs/handoff/TEMPLATE.md`,
  and add it to the tables in `HANDOFF.md` and `README.md`.
- Git: branch `main` stays demo-able; feature branches `feat/*`, `fix/*`; conventional commits.

## Commands
```bash
pip install -e ".[dev]"            # factory engines + zf CLI
zf projects                        # list everything by priority
zf handoff check                   # verify handoffs and agent files
scripts/verify.sh                  # run all tests and builds (Python, Mahn-Agent, website, app)
```

## Agent-specific notes
- Claude Code, Gemini CLI / Antigravity, Codex and others all read this same content. Do not put
  tool-specific instructions here that other agents cannot follow; put them in the project handoff
  under "Decisions" if they matter.
