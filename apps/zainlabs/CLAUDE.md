# Agent instructions: ZAIN LABS platform (apps/zainlabs)

Read the repo root `AGENTS.md` first, then `HANDOFF.md` in this folder.
Frontend work (web/, mobile/): `docs/FRONTEND_SPEC.md` is binding. Backend work (api/): `docs/API.md` and `docs/decisions/`.

Layout: `content/` (data + typed API client) · `api/` (FastAPI backend, port 8100) · `web/` (Next.js, port 3000) ·
`mobile/` (Expo) · `scripts/` (guard, approved dependencies) · `docs/` (spec, API, ADRs, design references).

- Content is entered once in `content/src/` (projects, streams, site copy). Never hard-code project
  data in `web/` or `mobile/`. Run `npm run check` in `content/` after edits.
- Keep web and app visually consistent: tokens live in `web/app/globals.css` and `mobile/src/theme.ts`;
  change both together.
- Project statuses must stay honest (Concept, PRD, In development, MVP, Live, Released, as defined in `content/src/types.ts`).
- Legal pages (Impressum, Datenschutz) are required in Germany; do not publish with placeholders.
- No third-party trackers, fonts or CDNs without the owner's approval (GDPR, zero budget).
- Before stopping: update `HANDOFF.md` here (Status, Next actions, Session log).
