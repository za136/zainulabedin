# P07 · Micro-drama & channel network: Handoff

> Factory: F4 · Status: Planning (tracker progress 5 %) · Last updated: 2026-11-25 by Claude Code

## Summary
Micro-drama series made with Google Flow plus faceless and with-face channels on YouTube, Instagram and Facebook for DACH audiences.

## Current status
No code. Pre-production tooling exists: `zf studio produce` creates bible, treatment, screenplay, shot list, storyboard prompts and schedule (example: `specs/studio/short-film.toml`).

## Where things are
- Drive: "AI Video Making Hacks & Prompts", "P07 Project Brief", "F4 · Agent Brief".
- Engine: `src/zfactory/content_studio/`.

## How to run
`zf studio produce specs/studio/short-film.toml --offline`

## How to test
`pytest -q tests/test_factories.py -k studio`

## Decisions
- (none recorded yet)

## Open questions and blockers
- Channel line-up (which channels, languages, face/faceless) · owner: Zain.
- Publishing always needs the owner's approval (AGENTS.md rule).

## Next actions
1. Decide the channel line-up (tracker next action) and record it here.
2. Write a spec for episode 1 of the first micro-drama in `specs/studio/` and generate its pre-production pack.
3. Add a content calendar generator (posts per channel per week) to the studio engine.

## Session log
- 2026-11-25 · Claude Code · wrote this handoff · pre-production tooling verified by tests.
