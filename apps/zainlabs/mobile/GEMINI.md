# Agent instructions: ZAIN LABS app (apps/zainlabs/mobile)

Read the repo root `AGENTS.md`, `apps/zainlabs/docs/FRONTEND_SPEC.md` (binding rules R-…; app rules R-RN-*)
and `apps/zainlabs/HANDOFF.md` first. Reference screens: `apps/zainlabs/docs/design/app-*.jpg`.

Project specifics (override the generic Expo notes below where they differ):
- Routes live in `app/` (not `src/app/`); non-route code is in `src/` (`theme.ts`, `content.tsx`, `components.tsx`), imported as `@/…`.
- Content comes from `../content` (`@zainlabs/content`); never hard-code projects here.
- Backend only through `api` / `sendContact` from `src/content.tsx` (typed client). Endpoints: `apps/zainlabs/docs/API.md`.
- No new dependencies or native modules without the owner's approval (`apps/zainlabs/scripts/approved-dependencies.json`).
- Colors only from `src/theme.ts`; on dark backgrounds use `colors.accentOnDark` / `colors.mutedOnDark`.
- Inside `Link asChild`, give the child a flat style object (`StyleSheet.flatten`), not an array or function: arrays crash on web.
- In sandboxes that block api.expo.dev, prefix Expo CLI commands with `EXPO_OFFLINE=1`.
- Verify: `npx tsc --noEmit`, `EXPO_OFFLINE=1 npx expo export --platform web --output-dir /tmp/zl-export`, and `node ../scripts/guard.mjs`.

---

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
