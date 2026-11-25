# P01 · Mahn-Agent: Handoff

> Factory: F1 · Status: MVP · Last updated: 2026-11-25 by Claude Code

## Summary
Agentic dunning (Mahnwesen) for DACH SMEs and their bookkeepers on Odoo / ERPNext: finds overdue
invoices, matches payments, drafts staged German reminders (Zahlungserinnerung → 1. Mahnung →
Letzte Mahnung) with a Claude agent, and sends nothing without human approval.

## Current status
Verified on 2026-11-25:
- `make test` → 27 passed (legal maths, policy, validator, agent self-correction with a fake client,
  payment/stop logic, approval re-checks, API + UI, ERPNext and Odoo mapping with mocks).
- `make install && make demo` from a fresh copy: seed, run, approve via API (.eml in outbox),
  simulated payment matched on next run, case closed.
- `docker compose up` with Postgres + Mailpit: run created drafts, approval sent a real SMTP mail into Mailpit.
- UI screenshots of dashboard and approval queue checked.

NOT verified:
- The real Claude agent (no API key in the build session). Run `mahn-agent eval --limit 3` with a key.
- Odoo / ERPNext against live instances (only mocked responses).
- Statutory base rates (defaults DE 1.27 %, AT 1.53 %) must be checked; see `docs/assumptions.md`.

## Where things are
- Code: `src/mahn_agent/` (policy, legal, matching, service, agent/, connectors/, api + web/, cli, evals).
- ADRs: `docs/decisions/`; registers: `docs/assumptions.md`, `docs/open-questions.md`.
- Drive: "P01 · Mahn-Agent — Project Brief", "F1 · Agent Brief".

## How to run
```bash
cd apps/mahn-agent
make install && make demo                 # http://localhost:8000 (API docs /docs)
docker compose up --build                 # with Postgres + Mailpit (http://localhost:8025)
```
CLI walk-through: see README.md ("step by step").

## How to test
`make test` (27 passed) and `make eval` (template mode 9/9; agent mode needs ANTHROPIC_API_KEY).

## Decisions
- ADR-001 Deterministic core, agentic edge (money never computed by the LLM).
- ADR-002 Human approval before every send; re-check payments at send time.
- ADR-003 Stack: FastAPI, SQLAlchemy, Jinja2, SQLite/Postgres, Mailpit, Anthropic SDK.
- 2026-11-25 · Levels never skipped: first reminder for any overdue invoice is level 1.

## Open questions and blockers
See `docs/open-questions.md` (pilot ERP, write-back to ERP, camt.053 import, PDF letters, Alembic, multi-tenancy, demo video).

## Next actions
1. Run `mahn-agent eval --limit 3` with a Claude key and record pass rate here.
2. Set up an ERPNext or Odoo test instance with seeded data and run the connector against it (tracker T005).
3. Add Alembic migrations before any pilot.
4. Record the 2-minute demo for the README (tracker T006).

## Session log
- 2026-11-25 · Claude Code · built MVP, tests, Docker stack, ADRs · all verified as listed above.
