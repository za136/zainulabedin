# P09 · Companion mobile apps: Handoff

> Factory: F3 · Status: Planning (tracker progress 0 %) · Last updated: 2026-11-25 by Claude Code

## Summary
iOS/Android companion apps: media player + showroom first, then client apps for Software Factory products (e.g. Mahn-Agent approvals on the phone).

## Current status
Foundations exist: the ZAIN LABS Expo app (`apps/zainlabs/mobile`) and the Expo generator (`src/zfactory/app_factory`). No media player or companion app yet.

## Where things are
- `apps/zainlabs/mobile/`, `src/zfactory/app_factory/`, `specs/apps/`.
- Drive: "P09 Project Brief", "F3 · Architecture & Roadmap".

## How to run
See `apps/zainlabs/HANDOFF.md` and `docs/testing/mobile-and-web.md`.

## How to test
See `apps/zainlabs/HANDOFF.md`.

## Decisions
- 2026-11-25 · Expo managed workflow; iOS builds through EAS cloud because there is no Mac.

## Open questions and blockers
- Store accounts are paid (Apple USD 99/yr, Google USD 25 once) · owner: Zain.

## Next actions
1. Create the Expo template from the ZAIN LABS app (tracker next action: "Create Expo template").
2. Add an audio/video player module (expo-audio / expo-video) for the media companion app.
3. Prototype a Mahn-Agent approval client against its `/api/v1/drafts` endpoints.

## Session log
- 2026-11-25 · Claude Code · wrote this handoff · foundations verified via ZAIN LABS app.
