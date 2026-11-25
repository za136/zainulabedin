# P02 · Atlas ERP: Handoff

> Factory: F1 · Status: PRD written · in development (tracker progress 15 %) · Last updated: 2026-11-25 by Claude Code

## Summary
Modular ERP for small and mid-sized businesses: finance, inventory, procurement and sales as separate domain modules on a shared platform layer.

## Current status
Code lives in the separate GitHub repo `za136/Atlas-ERP` (Kotlin, Gradle). Inspected 2026-11-25 (read-only
clone): modules `atlas-platform`, `atlas-finance`, `atlas-inventory`, `atlas-procurement`, `atlas-sales`,
`atlas-app`; agent files `AGENTS.md`, `agent.md`; PRD `Atlas ERP — Product Requirements and Specification.md`.
Build and tests of that repo were NOT run in this session.

## Where things are
- Repo: https://github.com/za136/Atlas-ERP
- Drive: "Atlas ERP — Product Requirements and Specification", "P02 Project Brief".

## How to run
```bash
git clone https://github.com/za136/Atlas-ERP && cd Atlas-ERP
./gradlew build
```

## How to test
`./gradlew test` in the Atlas-ERP repo (not yet run by an agent from this monorepo).

## Decisions
- (none recorded in this repo yet; see the Atlas-ERP repo and its PRD)

## Open questions and blockers
- Build vs. extend Odoo/ERPNext (tracker T008) · owner: Zain.
- Should Atlas move into this monorepo or stay separate (tracker suggests Repo 1 software-factory)? · owner: Zain.

## Next actions
1. Review the PRD against the factory template (tracker T007).
2. Decide build vs. extend Odoo/ERPNext (T008).
3. Break the PRD into epics in the tracker (T009).
4. Run `./gradlew build test` and record the result here.

## Session log
- 2026-11-25 · Claude Code · inspected repo structure, wrote this handoff · no build run.
