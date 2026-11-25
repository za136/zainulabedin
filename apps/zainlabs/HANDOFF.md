# ZAIN LABS platform (website + iOS/Android app): Handoff

> Factory: F2 + F3 (covers P10 brand/portfolio, seeds P08 and P09) · Status: In development · Last updated: 2026-11-25 by Claude Code

## Summary
The main ZAIN LABS presence: a Next.js website with a real-time 3D hero and public JSON API, and an
Expo app for iOS and Android. One content package (`content/`) feeds both, so every stream and
project is entered once. Design taken from Canva templates in the owner's account.

## Current status
Verified on 2026-11-25:
- `content`: `npm run check` → 5 streams, 13 projects, no errors.
- `web`: `npm run build` (31 routes), served with `next start`, screenshots of home and project page,
  3D hero renders (Chromium + SwiftShader), `/api/content` returns 5 streams / 13 projects,
  `/api/contact` validates and stores requests.
- `mobile`: `npx tsc --noEmit`, `npx expo export --platform web`; on an emulated iPhone 15 viewport all
  tabs and detail screens render, content syncs live from the API ("Up to date"), and the contact form
  stored a request with `source: "app"`.

NOT verified: native iOS/Android builds and real devices; Lighthouse scores; production hosting.

## Where things are
- `content/src/` (projects.ts, streams.ts, site.ts, types.ts, check.ts), `web/` (app/, components/, lib/),
  `mobile/` (app/ routes, src/ theme, content sync, components).
- Brand assets: `web/public/brand/hero-3d.jpg`, `web/app/icon.png`, `mobile/assets/`.
- Canva designs (owner account): "Infographic - DACH Tech Impact", "Infographic - Step One",
  "Mobile App UI with Geometric Form", "Your Story - ZAIN LABS".
- Drive: "P10 · Portfolio & showcase presence — Project Brief", "P08", "P09", F2/F3 Agent Briefs.

## How to run
```bash
cd apps/zainlabs/web && npm install && npm run dev                       # http://localhost:3000
cd apps/zainlabs/mobile && npm install && cp .env.example .env && npx expo start
```
Phone testing on Linux / no Mac: `docs/testing/mobile-and-web.md` (repo root).

## How to test
```bash
cd apps/zainlabs/content && npm install && npm run check
cd apps/zainlabs/web && npm run typecheck && npm run build
cd apps/zainlabs/mobile && npx tsc --noEmit && EXPO_OFFLINE=1 npx expo export --platform web
```

## Decisions
- 2026-11-25 · Name "ZAIN LABS", English UI with DACH focus (owner's choice).
- 2026-11-25 · Visual direction: German/Swiss professional, black + off-white + signal red, real-time 3D.
- 2026-11-25 · Content as TypeScript in a local package (`file:` dependency), not a CMS · zero cost, typed, reviewable.
- 2026-11-25 · No Google Fonts, no tracking · GDPR-friendly by default.
- 2026-11-25 · In expo-router, `Link asChild` children need flat style objects (arrays/functions break on web).

## Open questions and blockers
- Impressum and privacy notice need the owner's real data (yellow placeholders) · owner: Zain · blocks publishing.
- Contact email `hello@zainlabs.example` is a placeholder · owner: Zain.
- Domain and hosting · owner: Zain.
- P10 brief originally planned Google Sites; this Next.js site can replace it. Owner to confirm.

## Next actions
1. Owner runs the app on a phone with Expo Go (testing guide) and reports issues here.
2. Fill Impressum/Datenschutz, set the real contact email and `NEXT_PUBLIC_SITE_URL`, deploy the website.
3. Add German translations (de/en switch) for web and app.
4. Add real project screenshots/demos per project (P10 "collect demos" action).

## Session log
- 2026-11-25 · Claude Code · designs generated in Canva, website + app coded and connected · verified as above.
