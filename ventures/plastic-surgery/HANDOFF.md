# V01 · Plastic surgery clinic: Handoff

> Factory: venture (uses F2 + F3) · Status: Concept · Last updated: 2026-11-25 by Claude Code

## Summary
Business venture in DACH. The website and the client app are produced by the website and app factories;
the business plan checklist is in `README.md` in this folder.

## Current status
- Website spec `specs/sites/aesthetic-clinic.toml` and app spec `specs/apps/aesthetic-clinic-app.toml` exist and generate
  successfully (verified by `pytest -q` in the repo root).
- No business plan, legal setup or bookings yet. Not listed in the Factory HQ tracker.

## Where things are
- `ventures/plastic-surgery/README.md` (checklist), `specs/sites/aesthetic-clinic.toml`, `specs/apps/aesthetic-clinic-app.toml`.

## How to run
```bash
zf web build specs/sites/aesthetic-clinic.toml --offline     # site in out/sites/
zf app build specs/apps/aesthetic-clinic-app.toml                 # Expo app in out/apps/
```

## How to test
`pytest -q tests/test_factories.py`

## Decisions
- 2026-11-25 · Medical/cosmetic copy carries a disclaimer and no outcome guarantees (AGENTS.md rule).

## Open questions and blockers
- Is this venture active, and in which country/city? · owner: Zain.
- Licensing and medical regulation must be researched before any public site (see checklist).

## Next actions
1. Owner confirms whether this venture is active; if yes, add it to the Factory HQ tracker.
2. Fill the business plan checklist in `README.md`.
3. Regenerate the site with real business details and a booking backend (`form_action`).

## Session log
- 2026-11-25 · Claude Code · specs and checklist created, generators verified by tests.
