# ZAIN LABS platform (backend + website + iOS/Android app): Handoff

> Factory: F2 + F3 (covers P10 brand/portfolio, seeds P08 and P09) · Status: In development · Last updated: 2026-11-25 by Claude Code

## Summary
The main ZAIN LABS presence. A FastAPI **backend** (content API, leads, GDPR-compliant newsletter with double
opt-in, admin, OpenAPI contract), a Next.js **website** with a real-time 3D hero, and an Expo **app** for iOS
and Android. One content package feeds all three. Design from Canva templates in the owner's account.
**Division of work:** backend and contracts were built by Claude Code; the frontend will be developed further
by Gemini under the binding rules in `docs/FRONTEND_SPEC.md`.

## Current status
Verified on 2026-11-25 (commands in "How to test"):
- Backend: 17 tests pass: content endpoints and ETag, contact validation/honeypot/rate limit/owner mail and
  webhook, newsletter double opt-in incl. expiry and no-enumeration, admin auth/update/erase/purge/audit,
  committed `openapi.json` = code, client endpoints ⊆ contract, no direct `fetch("/api/…")` in frontends.
- Website: type check, production build (30 routes), **58 Playwright smoke tests** (desktop + phone): every route
  renders, one h1, no console errors, **no third-party requests**, no placeholder text, only real projects linked,
  contact form sends the exact contract payload and shows server field errors, consent unticked, honeypot off-screen,
  newsletter status pages.
- Integration (real servers): website form → proxy → backend stored the lead; newsletter signup → confirmation
  email (.eml) → link → redirect to `/newsletter?status=confirmed` → subscriber confirmed; app (Expo web export on an
  emulated iPhone) synced live content from the backend and sent a lead with `source: "app"`.
- Guard (`scripts/guard.mjs`): dependencies approved, no forbidden patterns, web/app tokens equal, legal pages present.
- Accessibility: colour contrast measured and fixed (tokens `--muted`, `--muted-on-dark`, `--accent`, `--accent-on-dark`).

NOT verified: native iOS/Android builds and real devices; Lighthouse scores; production hosting; SMTP with a real
mail server (outbox only); Postgres for this API (SQLite tested; Postgres driver is an optional extra).

## Where things are
- `api/` backend (`src/zainlabs_api/`: schemas = contract, routes/, services.py, models.py), `api/openapi.json`.
- `content/src/` data + `api.ts` typed client; `content/content.json` (generated).
- `web/` (app/, components/, lib/api.ts, tests/e2e/), `mobile/` (app/ routes, src/).
- `docs/FRONTEND_SPEC.md` (binding frontend rules), `docs/API.md`, `docs/decisions/ADR-001..003`, `docs/design/*.jpg`.
- `scripts/guard.mjs`, `scripts/approved-dependencies.json`, `Makefile`.
- Canva designs (owner account): "Infographic - DACH Tech Impact", "Infographic - Step One",
  "Mobile App UI with Geometric Form", "Your Story - ZAIN LABS".

## How to run
```bash
cd apps/zainlabs && make install && make dev     # API :8100 (/docs) + website :3000
make mobile                                      # Expo Go on your phone; see docs/testing/mobile-and-web.md (repo root)
```

## How to test
```bash
cd apps/zainlabs && make test && make e2e        # or from the repo root: scripts/verify.sh
```

## Decisions
- ADR-001 Separate backend service; frontends only via the typed client; contract guards.
- ADR-002 GDPR by design: no IPs stored, unticked consent, double opt-in, retention purge, erasure, audit.
- ADR-003 Content as typed code exported to JSON.
- 2026-11-25 · Name "ZAIN LABS", English UI with DACH focus; German/Swiss visual style; real-time 3D (owner).
- 2026-11-25 · Frontend will be continued by Gemini → strict spec, guard script, e2e tests, reference screenshots.
- 2026-11-25 · Contrast: two accent and two muted tones (light/dark backgrounds), measured ≥ 4.5:1.

## Open questions and blockers
- Impressum/Datenschutz need the owner's real data (yellow placeholders): blocks publishing · owner: Zain.
- Contact email `hello@zainlabs.example`, domain, hosting (website + API) · owner: Zain.
- Mail provider for production (SMTP credentials) · owner: Zain.
- i18n approach (German/English switch) needs owner approval (FRONTEND_SPEC §7).

## Next actions
1. Frontend (Gemini): pick the first item of `docs/FRONTEND_SPEC.md` §7 that the owner approves; follow §2 workflow.
2. Backend: Dockerfile + compose for API + website (Postgres optional), and a production deployment guide.
3. Backend: admin UI or CLI listing for leads (`zainlabs-api leads`) so the owner does not need curl.
4. Owner: test the app with Expo Go; fill Impressum/Datenschutz; choose hosting.

## Session log
- 2026-11-25 · Claude Code · Canva designs → website + app; connected via shared content.
- 2026-11-25 · Claude Code · moved backend into `api/` (FastAPI), typed client, contract + guard tests, e2e tests,
  FRONTEND_SPEC for Gemini, contrast fixes, reference screenshots · all checks above pass.
