# F4 · Content & Media Factory (Hollywood Studio): Handoff

> Factory: F4 · Status: Prototype · Last updated: 2026-11-25 by Claude Code

## Summary
A Linux-based, mostly automated "Hollywood" toolbox that produces micro dramas, AI songs and albums
and channel content for DACH audiences. Content is both a product and the marketing engine of every
other factory.

## Current status
- `src/zfactory/content_studio/`: logline + beats → story bible, treatment, Fountain screenplay, shot
  list (CSV), storyboard prompts, shoot schedule. Claude optional. Verified by tests.
- Example production spec: `specs/studio/short-film.toml` ("Last Light").
- Projects P05 KlangWerk Studio OS, P06 VideoForge AI, P07 Micro-drama & channel network exist as
  Drive documents only; handoffs in `docs/projects/`.

## Where things are
- `src/zfactory/content_studio/`, `specs/studio/`, `ventures/studio/`.
- Drive: "F4 · Content & Media Factory (Hollywood Studio) — MAIN", "F4 · Agent Brief",
  "F4 · Architecture & Roadmap", "KlangWerk Studio OS — Autonomous AI Music Studio Blueprint (DACH)",
  "VideoForge AI — Master PRD, Architecture & Antigravity Multi-Agent Blueprint", "Video editing app — idea notes",
  "video_deepseek", "AI Video Making Hacks & Prompts", "MusikAlbum" folder.
- Canva: "Presentation - Reborn by Zayn", "Feeling The Beat", "Oktoberfest Memories".

## How to run
`zf studio produce specs/studio/short-film.toml --offline` → `out/studio/last-light/`.

## How to test
`pytest -q tests/test_factories.py -k studio`.

## Decisions
- 2026-11-25 · Screenplays in Fountain (plain text, standard tooling) · diffable and tool-agnostic.

## Open questions and blockers
- Repo split: tracker plans a separate "content-studio" repo (Repo 3) · owner: Zain.
- Linux studio setup (P11) must be done before render pipelines can be tested on the owner's hardware.

## Next actions
1. ffmpeg render presets (9:16, 16:9, 1:1) as a `zf studio render` command.
2. Music release kit generator (cover-art prompt, metadata, lyric sheet, distribution checklist) for P05.
3. Prompt library for Flow / Flow Music / Nano Banana as versioned files in `specs/studio/prompts/`.

## Session log
- 2026-11-25 · Claude Code · content studio pipeline and "Last Light" spec · tests pass.
