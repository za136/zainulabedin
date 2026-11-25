# P08 · Product showroom & e-commerce sites: Handoff

> Factory: F2 · Status: Planning (tracker progress 0 %) · Last updated: 2026-11-25 by Claude Code

## Summary
Showroom and e-commerce sites for songs, 3D, film and process optimisation, linked to the channels, built from one design system and content model.

## Current status
Foundations exist: the ZAIN LABS website (`apps/zainlabs/web`) with design tokens, 3D hero and content model; the static site generator with presets (`src/zfactory/web_factory`). No showroom/shop template yet.

## Where things are
- `apps/zainlabs/web/`, `apps/zainlabs/content/`, `src/zfactory/web_factory/`.
- Drive: "P08 Project Brief", "F2 · Architecture & Roadmap".

## How to run
See `apps/zainlabs/HANDOFF.md`.

## How to test
See `apps/zainlabs/HANDOFF.md`.

## Decisions
- 2026-11-25 · Reuse the ZAIN LABS design system as the F2 design system seed.

## Open questions and blockers
- E-commerce: payment provider (Stripe, PayPal, Shopify Lite?) is a paid service; needs approval · owner: Zain.

## Next actions
1. Build the design system package from the ZAIN LABS tokens/components (tracker next action).
2. Add content types `release` (song/album/film) and `product` to the content model.
3. First showroom page for the "Reborn" release with an audio player block.

## Session log
- 2026-11-25 · Claude Code · wrote this handoff · foundations verified via ZAIN LABS build.
