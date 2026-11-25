# ADR-001: Separate backend service; frontends talk to it only through a typed client

- Status: accepted · 2026-11-25

## Context
The frontend (website and app) will be developed by an AI agent (Gemini) that may hallucinate APIs and
patterns. The first version had API route handlers inside the Next.js app, where a frontend agent could
break or rewrite them.

## Decision
- Backend = `apps/zainlabs/api` (Python, FastAPI, SQLAlchemy; SQLite default, Postgres optional), same stack
  as other F1 products (Mahn-Agent).
- Contract = generated `openapi.json`, checked in tests; request models forbid unknown fields.
- Frontends call it only through `content/src/api.ts`. The website proxies `/api/*` to the backend (same
  origin); the app uses `EXPO_PUBLIC_API_URL`.
- Guards: API tests fail if the client uses an endpoint missing from the contract or if web/mobile code calls
  `fetch("/api/…")` directly; `scripts/guard.mjs` blocks unapproved dependencies and forbidden patterns.

## Consequences
+ Frontend work cannot change backend behaviour; contract drift is detected automatically.
+ The same backend serves website, app and future clients.
− Two processes in development (`make dev` starts both).
