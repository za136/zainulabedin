# Agent instructions: Mahn-Agent (P01, F1 Software Factory)

- Read README.md, docs/decisions/, docs/assumptions.md and docs/open-questions.md before writing code.
- Money, policy and stop logic stay deterministic (ADR-001). The LLM only writes text, and every letter passes `agent/validator.py`.
- Nothing is sent without human approval (ADR-002). Never add an automatic send path.
- German for user-facing text, English for code, comments and docs.
- Tests with every change: `make test` must pass offline (no API calls in tests).
- Log non-trivial decisions as ADRs in docs/decisions/; keep the registers up to date.
- Prefer free and open-source tools; flag any paid service.
- End each step with: decisions, assumptions, risks, artifacts, next step.
