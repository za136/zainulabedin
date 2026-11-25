# F3 · App Factory (iOS & Android): Handoff

> Factory: F3 · Status: In development · Last updated: 2026-11-25 by Claude Code

## Summary
Cross-platform mobile apps from one codebase that reuse the Website Factory's design system and the
Software Factory's back ends: navigation, auth, theming, i18n, offline cache, media/3D modules and an
EAS release pipeline.

## Current status
- `apps/zainlabs/mobile`: ZAIN LABS app (Expo SDK 58, expo-router, TypeScript). Home, Projects, Studio,
  Contact, project and stream detail screens; syncs from the website API with an offline cache.
  Verified: `npx tsc --noEmit`, `npx expo export --platform web`, and every screen exercised on an
  emulated iPhone 15 viewport in Chromium (content sync and contact submission worked).
  NOT verified: native iOS/Android builds and real devices (no Xcode/emulator in the build sandbox).
- `src/zfactory/app_factory/`: generator for Expo apps from a TOML spec (list/form/content screens).

## Where things are
- `apps/zainlabs/mobile/`, `src/zfactory/app_factory/`, `specs/apps/`.
- Canva design: "Mobile App UI with Geometric Form" (owner's Canva account).
- Drive: "F3 · App Factory (iOS & Android) — MAIN", "F3 · Agent Brief", "F3 · Architecture & Roadmap", "P09 Project Brief".

## How to run
```bash
cd apps/zainlabs/mobile && npm install && cp .env.example .env && npx expo start
```
Testing on the owner's hardware (Linux, no Mac): see `docs/testing/mobile-and-web.md`.

## How to test
`npx tsc --noEmit && npx expo export --platform web` in `apps/zainlabs/mobile`.

## Decisions
- 2026-11-25 · ZAIN LABS backend moved to `apps/zainlabs/api` (FastAPI); frontends use only the typed client; Gemini continues the frontend under `apps/zainlabs/docs/FRONTEND_SPEC.md` (binding).
- 2026-11-25 · Expo (managed) + expo-router · one codebase, cloud builds for iOS without a Mac.
- 2026-11-25 · Content bundled in the app + cached + synced from `/api/content` · works offline.
- 2026-11-25 · Expo CLI needs `EXPO_OFFLINE=1` in sandboxes that block api.expo.dev.

## Open questions and blockers
- Apple Developer (USD 99/yr) and Google Play (USD 25 one-off) accounts are paid: needed only for store release · owner: Zain.
- German translations / i18n (de/en) not implemented yet.

## Next actions
1. Run the app on the owner's phone with Expo Go (see testing guide) and note issues in this handoff.
2. Extract an Expo template (`packages/app-template`) from the ZAIN LABS app for P09 companion apps.
3. Add i18n (de/en) and an `eas.json` with development/preview/production profiles.

## Session log
- 2026-11-25 · Claude Code · backend split, contract/guard/e2e tests, frontend spec for Gemini · verified (see apps/zainlabs/HANDOFF.md).
- 2026-11-25 · Claude Code · Expo app from Canva template, connected to website API · typecheck/export/emulated run OK.
