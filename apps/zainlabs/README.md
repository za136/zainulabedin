# ZAIN LABS: backend + website + iOS/Android app

The main platform where every stream and project lives. One content source feeds the website, the
backend API and the mobile app. Design taken from Canva templates (see "Design source" below).

**Agents:** frontend work follows [`docs/FRONTEND_SPEC.md`](docs/FRONTEND_SPEC.md) (binding), backend work
[`docs/API.md`](docs/API.md) and [`docs/decisions/`](docs/decisions). State and next steps: [`HANDOFF.md`](HANDOFF.md).

```
content/   @zainlabs/content: streams, projects, site copy + the typed API client (src/api.ts)
api/       FastAPI backend (port 8100): content API, leads, newsletter double opt-in, admin, OpenAPI contract
web/       Next.js 16 website (port 3000) with real-time 3D hero; /api/* is proxied to the backend
mobile/    Expo SDK 58 app for iOS and Android; syncs from the backend, works offline
scripts/   guard.mjs (anti-hallucination rules) + approved-dependencies.json
docs/      FRONTEND_SPEC.md, API.md, decisions/ (ADRs), design/ (reference screenshots)
```

```
     content/src/*.ts ──npm run export──► content/content.json
          │ (build time)                        │
          ▼                                     ▼
   web (Next.js :3000) ──/api/* proxy──► api (FastAPI :8100) ◄── mobile (Expo)
   pages, forms                          content, leads, newsletter, admin
```

## Run it

```bash
cd apps/zainlabs
make install        # Python venv for the API + npm install for content, web, mobile
make dev            # backend http://localhost:8100 (/docs) + website http://localhost:3000
make mobile         # Expo: scan the QR code with Expo Go (set EXPO_PUBLIC_API_URL=http://<LAN-IP>:8100 in mobile/.env)
make test           # guard, content check, API tests, website build, app export
make e2e            # browser smoke tests (first time: cd web && npx playwright install chromium)
```
Admin (leads, subscribers): set `ZL_ADMIN_TOKEN` (generate with `api/.venv/bin/zainlabs-api new-admin-token`),
then e.g. `curl -H "Authorization: Bearer $ZL_ADMIN_TOKEN" localhost:8100/api/admin/leads`.

Production builds: `cd web && npm run build && npm start` (any Node host or Vercel). Store builds for the
app: `npx eas build --platform ios|android` and `npx eas submit` (needs an Expo account plus Apple
Developer / Google Play accounts).

## Add a project or stream

Edit `content/src/projects.ts` (or `streams.ts`), then `make export` (writes `content.json`, runs the checks).
The website shows it after the next build; the API serves it immediately; the app picks it up on its next
sync (pull to refresh) and new app builds ship it in the bundled offline copy.

## API

See [`docs/API.md`](docs/API.md) (summary) and `api/openapi.json` (contract, checked by tests).
Environment variables: `api/.env.example`, `mobile/.env.example`; website: `API_INTERNAL_URL` (backend URL for the proxy, default http://localhost:8100), `NEXT_PUBLIC_SITE_URL`.

## Design source (Canva)

Generated from Canva templates in the ZAIN LABS Canva account, then coded:
- Website: "DACH Tech Impact": black / warm off-white, one signal-red accent, red asterisk mark,
  glossy black 3D spheres and cubes, red stat circles, mono quote band; plus the numbered 01–05
  process rows from "Infographic - Step One".
- App: "Mobile App UI with Geometric Form": centred wordmark + "Guten Tag", stream chips, bezel
  featured card with MVP badge, icon grid, black tab bar (accent changed from blue to the web red).

The 3D hero is rendered live with three.js (studio reflections generated locally, no downloads);
the still in `web/public/brand/hero-3d.jpg` and `mobile/assets/brand/hero-3d.jpg` is a render of the same scene.

## Before going live

- Fill in the **Impressum** (`web/app/impressum/page.tsx`; required in Germany, § 5 DDG) and review
  the privacy notice (`web/app/datenschutz/page.tsx`). Placeholders are highlighted in yellow.
- Replace `hello@zainlabs.example` in `content/src/site.ts` and set `NEXT_PUBLIC_SITE_URL`.
- Set `ZL_ADMIN_TOKEN`, `ZL_OWNER_EMAIL` (lead notifications) and SMTP settings (`api/.env.example`); optionally `ZL_LEAD_WEBHOOK_URL`.
- Schedule `zainlabs-api purge` (e.g. daily cron) for the retention policy.
