# P03 · Aegis / Meridian Platform: Handoff

> Factory: F1 · Status: In development (tracker progress 40 %) · Last updated: 2026-11-25 by Claude Code

## Summary
Agentic payments and simulated banking platform: deterministic double-entry ledger, ISO 20022 payment saga, MCP tool gateway with autonomy levels A0–A3, human approval inbox, and agent squads (KYC, payment repair, financial-crime investigation, reconciliation, disputes, ops copilot).

## Current status
Code lives in `za136/Aegis` (Python/FastAPI with uv, Next.js portals, Docker/Helm/Terraform, evals). Inspected
2026-11-25: `handsoff.md` progress log (Phase 0 foundations and Phase 1 walking skeleton done),
`GEMINI.md`, tests for ledger, payments, gateway, squads and evals. Model layer currently Google Gemini.
Tests of that repo were NOT run in this session.

## Where things are
- Repo: https://github.com/za136/Aegis (own handoff: `handsoff.md`, agent file `GEMINI.md`)
- Drive: "Aegis / Meridian — End-to-End Demo Walkthrough", "Aegis / Meridian — Handoff & Progress Log", "Aegis / Meridian — gemini.md", "P03 Project Brief".

## How to run
```bash
git clone https://github.com/za136/Aegis && cd Aegis
uv sync && uv run pytest
```
See `docs/running-the-platform.md` in that repo for Docker and the portals.

## How to test
`uv run pytest` in the Aegis repo (not yet run by an agent from this monorepo).

## Decisions
- Decisions 1–10 are recorded in the Aegis repo `handsoff.md` and `docs/adr/README.md`.

## Open questions and blockers
- Tracker T010: bring `GEMINI.md` in line with the factory Agent Brief (add AGENTS.md/CLAUDE.md copies).
- Owner's Agent Brief prefers non-compliance products; Aegis is compliance-heavy. Confirm priority · owner: Zain.

## Next actions
1. Add `AGENTS.md` and `CLAUDE.md` (same content as `GEMINI.md`, aligned to the F1 Agent Brief) to the Aegis repo (T010).
2. Run `uv run pytest` and record the result in `handsoff.md` (T011).
3. Reuse Mahn-Agent's validator-feedback and approval patterns where they overlap.

## Session log
- 2026-11-25 · Claude Code · inspected repo and handoff log, wrote this handoff · no tests run.
