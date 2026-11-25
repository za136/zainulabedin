# F2 · Website Factory: Handoff

> Factory: F2 · Status: In development · Last updated: 2026-11-25 by Claude Code

## Summary
One generator for modern, 3D, SEO- and AI-search-optimised showroom and e-commerce sites for every
product and channel: shared design system, content model and deploy pipeline, so a new product gets a
site in a day.

## Current status
- `apps/zainlabs/web`: the ZAIN LABS main website (Next.js 16, three.js 3D hero, project/stream pages,
  JSON API, contact form, Impressum/Datenschutz). Design from Canva templates. Verified: `npm run build`
  and in-browser screenshots (Chromium); API and contact endpoint tested with curl.
- `src/zfactory/web_factory/`: static site generator with presets (aesthetic clinic, facials spa, film
  studio, SaaS). Verified by tests and a browser screenshot.
- The ZAIN LABS design system (colors, type, components in `apps/zainlabs/web/app/globals.css`) is the
  seed of the F2 design system (P08).

## Where things are
- `apps/zainlabs/web/`, `apps/zainlabs/content/` (shared content), `src/zfactory/web_factory/`, `specs/sites/`.
- Canva designs in the owner's account: "Infographic - DACH Tech Impact" (website), "Infographic - Step One".
- Drive: "F2 · Website Factory — MAIN", "F2 · Agent Brief", "F2 · Architecture & Roadmap", "P08 Project Brief".

## How to run
```bash
cd apps/zainlabs/web && npm install && npm run dev        # http://localhost:3000
zf web build specs/sites/aesthetic-clinic.toml --offline   # static generator
```

## How to test
`cd apps/zainlabs/web && npm run typecheck && npm run build`; `pytest -q` in the repo root.

## Decisions
- 2026-11-25 · Next.js App Router + plain CSS design tokens (no CSS framework) · small, fast, no build plugins.
- 2026-11-25 · System font stack, no Google Fonts · GDPR (no third-party requests) and zero cost.
- 2026-11-25 · 3D with three.js + locally generated environment map, no HDR downloads.

## Open questions and blockers
- Hosting and domain for zainlabs (Vercel free tier, Netlify or own server) · owner: Zain.
- Impressum data (legally required in Germany) must be filled in before publishing · owner: Zain.

## Next actions
1. Extract the ZAIN LABS tokens and components into `packages/design-system` for reuse by P08 sites.
2. Add Lighthouse CI (KPI "Lighthouse / Core Web Vitals scores").
3. P08: first showroom page template (product, collection, release) on the shared content model.

## Session log
- 2026-11-25 · Claude Code · web factory presets; ZAIN LABS website from Canva templates · build + screenshots OK.
