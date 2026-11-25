# F5 · Deep-Tech & Engineering Intelligence Factory: Handoff

> Factory: F5 · Status: Blueprint · Last updated: 2026-11-25 by Claude Code

## Summary
A production-grade, multi-domain engineering intelligence system plus deep-tech experiments
(3D/CAD, imaging, drones, semiconductors, biolabs). Long-horizon work that reuses Software Factory
agents across domains. Also home of research and market intelligence (DACH ecosystem maps).

## Current status
- `src/zfactory/research/`: research project scaffold (question, hypotheses, plan, notes, sources,
  findings) + optional AI-drafted research plan. Verified by tests.
- P04 Engineering Intelligence System: blueprint in Drive only; handoff in `docs/projects/P04-engineering-intelligence.md`.
- No engineering-intelligence code yet.

## Where things are
- `src/zfactory/research/`, `research/` (projects created with `zf research new`).
- Drive: "F5 · Deep-Tech & Engineering Intelligence Factory — MAIN", "F5 · Agent Brief",
  "F5 · Architecture & Roadmap", "Autonomous AI Engineering Orchestrator — Blueprint & Grant Notes (V2)",
  "08 · Research & Market Intel" (Germany, Austria, Switzerland, Liechtenstein, Luxembourg ecosystem maps,
  Swiss AI & Deep Tech Ecosystem Directory).

## How to run
`zf research new "Your question?" --domain engineering` then `zf research plan research/<slug>`.

## How to test
`pytest -q tests/test_factories.py -k research`.

## Decisions
- 2026-11-25 · Research projects use one fixed layout (plan, notes, sources.bib, data, findings) · any agent can continue them.

## Open questions and blockers
- Repo split: tracker plans "engineering-intelligence" (Repo 4) · owner: Zain.
- No local GPU: models stay small or run on Colab free tier.

## Next actions
1. P04: write the architecture and interface contracts (decision ledger, assumptions register, domain pack API) as files in `docs/projects/` or a new `apps/engineering-intelligence/`.
2. Import the DACH ecosystem maps as structured data (CSV/JSON) so other factories can query them.

## Session log
- 2026-11-25 · Claude Code · research scaffold, factory handoff · tests pass.
