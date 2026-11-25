# P05 · KlangWerk Studio OS (AI music studio): Handoff

> Factory: F4 · Status: Blueprint (tracker progress 10 %) · Last updated: 2026-11-25 by Claude Code

## Summary
Autonomous AI music studio for DACH: songs and albums made with Flow Music, release kits (cover, metadata, lyrics) and distribution. Existing work includes the "Reborn" release by Zayn.

## Current status
No code yet. Blueprint in Drive; music assets in the Drive folder "MusikAlbum"; Canva designs "Presentation - Reborn by Zayn", "Feeling The Beat", "Oktoberfest Memories".

## Where things are
- Drive: "KlangWerk Studio OS — Autonomous AI Music Studio Blueprint (DACH)", "MusikAlbum" folder, "P05 Project Brief".
- Engine to extend: `src/zfactory/content_studio/`.
- Listed on the website as project `reborn` in `apps/zainlabs/content/src/projects.ts`.

## How to run
Nothing to run yet.

## How to test
Nothing to test yet.

## Decisions
- (none recorded yet)

## Open questions and blockers
- Distribution service choice (free vs. paid distributors) · owner: Zain.
- Rights and licensing terms of the AI music tools used · owner: Zain.

## Next actions
1. Organise the MusikAlbum folder into an asset structure: album/track/{audio,cover,lyrics,metadata} (tracker next action).
2. Add a `zf studio release` command that generates a release kit (metadata JSON, lyric sheet, cover prompt, distribution checklist) from a TOML spec.
3. Add the real "Reborn" details (date, platforms, links) to the website content.

## Session log
- 2026-11-25 · Claude Code · wrote this handoff from Drive/Canva · no code.
