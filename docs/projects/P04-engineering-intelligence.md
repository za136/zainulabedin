# P04 · Engineering Intelligence System (Autonomous AI Engineering Orchestrator): Handoff

> Factory: F5 · Status: Architecture / blueprint (tracker progress 15 %) · Last updated: 2026-11-25 by Claude Code

## Summary
Multi-domain engineering intelligence system orchestrated by Claude Code / Opus with human approval for consequential actions; reusable domain packs (manufacturing, maintenance, supply chain, standards, CAD, bio/peptides, GPU eval) on a shared core (decision ledger, assumptions register, open-questions register).

## Current status
No code yet. Blueprint and grant notes exist in Drive.

## Where things are
- Drive: "Autonomous AI Engineering Orchestrator — Blueprint & Grant Notes (V2)", "F5 · Architecture & Roadmap", "P04 Project Brief".
- Planned repo: "engineering-intelligence" (tracker Repo 4), or `apps/engineering-intelligence/` here.

## How to run
Nothing to run yet.

## How to test
Nothing to test yet.

## Decisions
- Contracts first: architecture and interfaces before implementation (F5 Architecture & Roadmap).

## Open questions and blockers
- Repo location (separate repo vs. this monorepo) · owner: Zain.
- No local GPU: which domain packs can run on Colab free tier? · owner: Zain.

## Next actions
1. Write the architecture and interface contracts (core ledgers, domain pack API, agent roles, approval points) as markdown + JSON Schema.
2. Pick one domain pack for a first vertical slice (e.g. maintenance) and define its golden eval cases.
3. Scaffold `apps/engineering-intelligence/` with the shared core and tests.

## Session log
- 2026-11-25 · Claude Code · wrote this handoff from Drive docs · no code.
