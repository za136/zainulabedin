# Agent instructions: ZAIN LABS website (apps/zainlabs/web)

You are working on the **frontend**. Before writing any code, read completely:
1. `apps/zainlabs/docs/FRONTEND_SPEC.md` (binding rules R-…, design system, routes, API, traps).
2. `apps/zainlabs/HANDOFF.md` (current state and next actions).
3. The reference image for the page you change in `apps/zainlabs/docs/design/`.

Non-negotiable summary (details and reasons in the spec):
- Next.js **16** App Router, React **19**. `params`/`searchParams` are Promises. No `pages/`, no `next/router`,
  no `next/head`, no `next/font/google`.
- Styling only with `app/globals.css` (tokens + classes). **No Tailwind**, no UI kits, no new dependencies
  (check `apps/zainlabs/scripts/approved-dependencies.json`; ask the owner to add one).
- Data only from `@zainlabs/content`; backend only via `import { api } from "@/lib/api"`. Endpoints that are
  not in `apps/zainlabs/docs/API.md` do not exist.
- Never invent clients, testimonials, numbers, logos or people. No placeholder text.
- No third-party requests (fonts, CDNs, analytics, embeds). Consent boxes never pre-checked.
- Do not edit: `next.config.ts`, `lib/api.ts`, `../api/**`, `../content/src/api.ts`, `../content/src/types.ts`, lockfiles.
- Never delete or weaken tests. If something in the spec seems wrong, stop and ask.

Done means all pass (from `apps/zainlabs`): `node scripts/guard.mjs`, `cd web && npx tsc --noEmit && npx next build && npm run test:e2e`,
plus the other checks in spec §8; `HANDOFF.md` updated; report in the format of spec §9.
