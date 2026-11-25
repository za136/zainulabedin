# F1 · Software Factory (Agentic AI): Handoff

> Factory: F1 · Status: In development · Last updated: 2026-11-25 by Claude Code

## Summary
A reusable pipeline that turns researched ideas into PRDs and then into working agentic-AI products
for DACH businesses (multi-agent workflows, ERP-connected automations, APIs, dashboards). Every
other factory needs software, so shared templates, agents, CI and docs make each new product start
at about 60 % instead of 0 %.

## Current status
- `src/zfactory/software_factory/`: spec (TOML) → plan → build → pytest → repair loop. With Claude it
  writes and repairs code; without a key it writes a scaffold. Verified: `pytest -q` (repo root, 9 tests).
- P01 Mahn-Agent is the first product built to the factory standard (`apps/mahn-agent`, 27 tests,
  Docker stack verified). See its handoff.
- P02 Atlas ERP and P03 Aegis/Meridian live in separate GitHub repos (`za136/Atlas-ERP`, `za136/Aegis`).
- Roadmap position: Phase 0 (foundations) partly done; Phase 1 (first product) MVP reached.

## Where things are
- Engine: `src/zfactory/software_factory/` (`pipeline.py`, `prompts.py`, `templates.py`), CLI `zf software build`.
- Example spec: `specs/software/task-tracker.toml`.
- Products: `apps/mahn-agent/` (P01); external repos for P02, P03.
- Drive: "F1 · Software Factory (Agentic AI) — MAIN", "F1 · Agent Brief", "F1 · Architecture & Roadmap",
  "P01/P02/P03 Project Brief", "Atlas ERP — Product Requirements and Specification",
  "Aegis / Meridian — Handoff & Progress Log", "GitHub Repository Vault", "AI Agent Skills & Plugins Playbook".

## How to run
```bash
pip install -e ".[dev,llm]"
zf software build specs/software/task-tracker.toml --offline   # scaffold, no key needed
ANTHROPIC_API_KEY=... zf software build specs/software/task-tracker.toml   # Claude writes + repairs code
```

## How to test
`pytest -q` in the repo root (expects 9 passed).

## Decisions
- 2026-11-25 · Specs are TOML, outputs go to `out/` (git-ignored) · reviewable, diffable inputs.
- 2026-11-25 · Money, policy and other deterministic logic never delegated to an LLM (see Mahn-Agent ADR-001).
- 2026-11-25 · All products live in this monorepo under `apps/` until the 4-repo split in the tracker is confirmed.

## Open questions and blockers
- Repo layout: Master Tracker suggests 4 repos (software-factory, web-app-factory, content-studio,
  engineering-intelligence); this monorepo currently holds all of them. Owner to confirm · owner: Zain.
- GitHub push from Claude Code sessions is refused (403) until the Claude GitHub App has access to the repo.

## Next actions
1. Extract shared modules from Mahn-Agent into `packages/`: LLM client with fallbacks, approval queue,
   audit log, validator loop (roadmap Phase 2: ≥ 50 % reuse).
2. Add a TypeScript/Node target to the software factory engine.
3. Run generated builds in a container instead of the local interpreter.
4. P02: review the Atlas ERP PRD against the factory template (tracker T007).

## Session log
- 2026-11-25 · Claude Code · built the factory engine, P01 Mahn-Agent MVP, handoff system · tests pass.
