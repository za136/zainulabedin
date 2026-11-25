# Agent instructions: ZAIN LABS backend (apps/zainlabs/api)

Read the repo root `AGENTS.md`, `apps/zainlabs/HANDOFF.md`, `apps/zainlabs/docs/API.md` and `docs/decisions/` first.

- This folder is backend territory. Frontend agents must not change it (FRONTEND_SPEC R-SCOPE-2).
- The contract is `openapi.json`, generated from `src/zainlabs_api/schemas.py` + routes. After any change:
  `zainlabs-api openapi > openapi.json`, update `../content/src/api.ts` and `../docs/API.md`, note it in `HANDOFF.md`.
- Request models forbid unknown fields; every error uses `{error, code, fields?}` (`errors.py`). Keep both.
- GDPR (ADR-002): store no IPs/user agents; consent required; double opt-in; erasure + retention; audit every change.
  A new personal-data field needs an update of `web/app/datenschutz/page.tsx` and ADR-002.
- Tests offline only (`python -m pytest -q`); side effects (mail, webhook) are injected/mocked.
- Run: `.venv/bin/zainlabs-api serve --port 8100` (see `apps/zainlabs/Makefile`).
