# ZAIN LABS frontend specification (website + app)

**Audience:** any AI agent (Gemini, Claude, Codex …) or developer changing the website (`apps/zainlabs/web`)
or the iOS/Android app (`apps/zainlabs/mobile`).
**Status:** binding. If this document and your memory disagree, this document wins. If this document
and the code disagree, the code wins: stop and report the difference instead of guessing.

> Read this whole file before writing code. Every rule has a number; cite it in your report
> (e.g. "followed R-API-2"). If a task needs something this spec forbids or does not cover,
> **stop and ask the owner**. Do not invent a workaround.

---

## 0. Ground truth: what exists today

| Thing | Where | Facts |
|---|---|---|
| Website | `web/` | Next.js **16.4.6**, **App Router** (`web/app/`), React **19.3.0**, TypeScript, plain CSS in `web/app/globals.css` |
| 3D | `web/components/Hero3D.tsx` | three **0.187.0** + @react-three/fiber **9.8.2**. **No** @react-three/drei, no GLTF models, no HDR files |
| App | `mobile/` | Expo SDK **58** (expo 58.0.26), React Native **0.88.1**, expo-router **58.0.32**, routes in `mobile/app/` |
| Content | `content/src/` | TypeScript data: `site.ts`, `streams.ts`, `projects.ts`, `types.ts`. Exported to `content/content.json` |
| API client | `content/src/api.ts` | The **only** way to call the backend: `createApi(baseUrl)` → `getContent`, `getProject`, `sendContact`, `subscribe` |
| Backend | `api/` (Python/FastAPI) | **Not frontend territory.** Contract: `api/openapi.json`, summary in `docs/API.md` |
| Design references | `docs/design/*.jpg` | Approved screenshots of every page and app screen. Your result must match them unless the task says otherwise |
| Origin of the design | Canva (owner's account) | Website: "DACH Tech Impact" + "Step One"; app: "Mobile App UI with Geometric Form" |

**Not installed (do not import, do not assume):** Tailwind, shadcn/ui, Radix, framer-motion, @react-three/drei,
styled-components, Emotion, MUI, Chakra, Bootstrap, next-intl, i18next, axios, SWR, React Query, Zustand,
Redux, lucide-react, any icon library, Google Fonts, analytics/tracking SDKs, react-native-svg, NativeWind,
Reanimated, expo-av. If a task seems to need one: stop and ask (R-DEP-1).

---

## 1. Hard rules (MUST / MUST NOT)

### Scope and files
- **R-SCOPE-1** You MAY edit: `web/app/**` (except the ones listed below), `web/components/**`, `web/app/globals.css`,
  `web/public/**` (owner-supplied assets only), `mobile/app/**`, `mobile/src/components.tsx`, `mobile/src/theme.ts`,
  `web/tests/e2e/**` (add tests; never delete or weaken existing ones).
- **R-SCOPE-2** You MUST NOT edit: `api/**`, `content/src/api.ts`, `content/src/types.ts`, `content/content.json`
  (generated), `api/openapi.json` (generated), `web/next.config.ts`, `web/lib/api.ts`, `mobile/src/content.tsx`,
  `mobile/metro.config.js`, `scripts/**`, `package.json` dependency lists, lockfiles.
- **R-SCOPE-3** Content changes (new projects, copy) happen only in `content/src/{projects,streams,site}.ts`,
  followed by `npm run export && npm run check` in `content/`. Only the owner decides what a project says.
- **R-SCOPE-4** Never delete, skip (`test.skip`, `.only`) or weaken a test to make it pass. Fix the code.

### Content and honesty
- **R-CONTENT-1** Every project, stream, status, number and claim shown comes from `@zainlabs/content`. Never
  hard-code project titles, summaries or counts in components (the guard script detects copies).
- **R-CONTENT-2** Never invent: clients, logos, testimonials, quotes attributed to people, team members,
  awards, prices, metrics ("500+ customers"), case-study results, partner names, addresses, phone numbers.
  If a design needs such a block, render it only when real data exists in the content package; otherwise omit it.
- **R-CONTENT-3** No placeholder text (lorem ipsum, "Coming soon" filler, "TODO"). Legal placeholders in
  Impressum/Datenschutz are the only exception and are styled with `.todo`; the owner fills them.
- **R-CONTENT-4** Project statuses are exactly: `Concept`, `PRD`, `In development`, `MVP`, `Live`, `Released`.
  Display them with the status classes in §4 (R-UI-6). Do not rename or reword them.
- **R-CONTENT-5** Language: English UI with DACH focus (owner's decision). German words already in the
  content (e.g. "Guten Tag", "Impressum", "Datenschutz") stay German. Do not translate content files unless
  the task is the i18n task.
- **R-CONTENT-6** Medical/cosmetic topics (clinic projects): no outcome guarantees; keep disclaimers.

### API
- **R-API-1** Call the backend only through the typed client: website `import { api } from "@/lib/api"`,
  app `import { api } from "@/content"` (or the helpers in `mobile/src/content.tsx`). Never `fetch("/api/...")`.
- **R-API-2** The only endpoints the frontends use are in §5. Endpoints such as `/api/subscribe`,
  `/api/leads`, `/api/auth`, `/api/search`, `/api/users` **do not exist**. Admin endpoints are never used by
  the public frontends.
- **R-API-3** Request bodies are strict: unknown fields are rejected with 422. Send exactly the fields of
  `ContactInput` / `NewsletterInput` in `content/src/api.ts`.
- **R-API-4** Handle every result: `if (result.ok) … else show result.error`, and map `result.fields`
  (field → message) to the inputs. Show messages in an element with `role="alert"` inside the form.
- **R-API-5** Disable the submit button while sending; show "Sending…". Never submit twice.
- **R-API-6** Forms keep the hidden honeypot input `name="website"` (class `hp`, `tabIndex={-1}`,
  `autoComplete="off"`, `aria-hidden="true"`) and send its value as `website`.
- **R-API-7** Consent checkboxes are required and **never pre-checked** (GDPR). Text must say what is stored
  and link to `/datenschutz`.

### Dependencies, privacy, performance
- **R-DEP-1** No new dependencies without the owner's written approval; then add them to
  `scripts/approved-dependencies.json`. The guard fails otherwise.
- **R-PRIV-1** No requests to third-party domains at runtime (fonts, CDNs, analytics, maps, video embeds,
  icon CDNs). The e2e tests fail on any non-localhost request. Self-host everything in `web/public/`.
- **R-PRIV-2** No cookies, localStorage tracking or fingerprinting on the website.
- **R-PERF-1** Keep the 3D hero lightweight: dynamic import with `ssr: false` (already in `Hero3DClient`),
  `dpr={[1, 2]}`, ≤ 12 meshes, no textures > 1024 px, no post-processing, respect `prefers-reduced-motion`
  (render still). Never add a second WebGL canvas on the same page.
- **R-PERF-2** Images: use files in `web/public/`, provide `width`/`height` or fixed CSS size, `alt` text
  (empty `alt=""` only for decorative images). JPG/WebP ≤ 300 KB each.

### Accessibility (WCAG 2.2 AA)
- **R-A11Y-1** One `<h1>` per page (tested). Headings in order, no skipped levels inside sections.
- **R-A11Y-2** Every input has a visible `<label>`. Buttons have text. Links describe their target.
- **R-A11Y-3** Text contrast ≥ 4.5:1 (normal text) / 3:1 (≥ 24 px or ≥ 19 px bold). On light backgrounds use
  `--muted` / `--accent` for small text; on `--ink` use `--muted-on-dark` / `--accent-on-dark` (or `#b3b0a9`
  for body copy). Never put `--accent` small text on `--ink` (3.7:1, fails). Values were measured, see §4.
- **R-A11Y-4** Visible focus styles; everything reachable by keyboard; skip link stays first in `<body>`.
- **R-A11Y-5** Motion: respect `prefers-reduced-motion`; no auto-playing audio/video.

### Next.js 16 / React 19 facts (do not use older patterns)
- **R-NEXT-1** App Router only. No `pages/` directory, no `getServerSideProps`/`getStaticProps`, no `next/router`
  (use `next/navigation`), no `next/head` (use `export const metadata` / `generateMetadata`).
- **R-NEXT-2** `params` and `searchParams` are **Promises** in pages and `generateMetadata`:
  `export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; }`.
- **R-NEXT-3** Components are Server Components by default. Add `"use client"` only for state, effects,
  event handlers or browser APIs (forms, 3D). Do not put `"use client"` on pages.
- **R-NEXT-4** No `next/font/google` (GDPR). Fonts are the system stacks in §4.
- **R-NEXT-5** New routes: add them to `web/app/sitemap.ts` and to `ROUTES` in `web/tests/e2e/smoke.spec.ts`.
- **R-NEXT-6** If unsure about an API, read the installed types in `web/node_modules/next/dist/` or the
  official docs for **version 16**. Never rely on memory of Next 12–14 behaviour.

### Expo / React Native facts (app)
- **R-RN-1** Routes are files in `mobile/app/` (expo-router). Tabs: `mobile/app/(tabs)/`. Non-route code in `mobile/src/`.
- **R-RN-2** Inside `<Link asChild>`, the child gets a **flat style object** (`StyleSheet.flatten([...])`).
  Style arrays and style functions break on web (crash: "Failed to set an indexed property on CSSStyleDeclaration").
- **R-RN-3** Colors only from `mobile/src/theme.ts` (`colors.*`), which must equal the web tokens (guard checks).
  On ink backgrounds use `colors.accentOnDark` / `colors.mutedOnDark` (e.g. `<Eyebrow onDark>`).
- **R-RN-4** No native modules beyond the approved list: anything needing `expo prebuild`/a dev build needs approval.
- **R-RN-5** Use `SafeAreaView` from `react-native-safe-area-context`, not from `react-native`.
- **R-RN-6** Expo CLI in sandboxes without access to api.expo.dev: prefix with `EXPO_OFFLINE=1`.

---

## 2. Workflow for every task
1. Read: this spec, `apps/zainlabs/HANDOFF.md`, the files you will touch, the matching reference image in `docs/design/`.
2. Plan: write down the list of files you will change and why (≤ 10 files per step). If any is in R-SCOPE-2, stop.
3. Implement in small steps. After each step run the checks in §8.
4. Compare your screen with the reference image (or describe the intended difference if the task changes the design).
5. Update `apps/zainlabs/HANDOFF.md` (Current status, Next actions, Session log) and run `zf handoff check` from the repo root.
6. Report using the template in §9.

## 3. Information architecture

### Website routes (all exist; `docs/design/web-*.jpg`)
| Route | Purpose | Sections in order | Data |
|---|---|---|---|
| `/` | Home | Header · Hero (claim, intro, 2 CTAs, 3D stage) · Streams (5 cells) · Stats (3 red dots) · Quote band · Featured projects + "See all" tile · Process 01–05 · CTA split (3D still + red panel) · Footer | `site`, `streams`, `projects`, `featuredProjects()`, `stats()` |
| `/projects` | All projects | Page head · Stream filter chips (`?stream=slug`) · Project grid | `projects`, `streams` |
| `/projects/[slug]` | Project detail | Page head (crumbs, title, summary) · Body paragraphs · Aside (status, highlights, stack, links, "Ask about this project") | `getProject(slug)` |
| `/streams/[slug]` | Stream detail | Page head · Capabilities · Project grid | `getStream`, `projectsIn` |
| `/contact` | Lead form | Page head · Contact form (`?project=slug` prefills) | `streams`, `api.sendContact` |
| `/newsletter` | Newsletter | Page head (text depends on `?status=confirmed|unsubscribed|invalid`) · Newsletter form | `api.subscribe` |
| `/impressum`, `/datenschutz` | Legal (German law) | Text only | static |

Header nav: Streams (`/#streams`), Projects, Process (`/#process`), Contact + red "Start a project" button.
Footer: logo, location, Streams list, Studio links (All projects, Contact, Newsletter, Public API), Legal links.

### App screens (`docs/design/app-*.jpg`)
Tabs (black tab bar): **Home** (wordmark "ZAIN LABS", greeting by time of day, stream chips, featured card with
3D image + red status badge, project grid 3 columns, stats bar) · **Projects** (filter chips + rows) ·
**Studio** (dark screen, F4 stream projects) · **Contact** (form + consent switch).
Stack screens: `project/[slug]`, `stream/[slug]`.

## 4. Design system (from the Canva templates; values are binding)

### Tokens (`web/app/globals.css` `:root`; mirrored in `mobile/src/theme.ts`)
| Token | Value | Use |
|---|---|---|
| `--ink` | `#0e0e0f` | dark sections, header, footer, primary text on light |
| `--ink-2` | `#1a1a1c` | hover on dark cards |
| `--paper` | `#f4f2ee` | page background (warm off-white) |
| `--paper-2` | `#e9e6e0` | hover on light cards |
| `--line-dark` | `#2b2b2e` | hairlines on dark |
| `--line-light` | `#d9d5cd` | hairlines on light |
| `--muted` | `#6f6e69` | secondary text on light backgrounds (4.6:1 on paper) |
| `--muted-on-dark` | `#8b8a86` | secondary text on `--ink` (5.6:1) |
| `--accent` | `#d4241d` | the ONE accent: buttons, fills, status MVP, numbers, asterisk, red text on light (4.6:1). Never a second accent hue |
| `--accent-on-dark` | `#ff4d42` | the same accent for **small text on `--ink`** (eyebrows, codes, crumbs) (5.9:1) |
| `--accent-ink` | `#ffffff` | text on accent |
| `--radius` | `4px` | inputs; buttons and chips are pills (`999px`) |
| `--max` | `1240px` | content width (`.wrap`) |
| `--sans` | Helvetica Neue stack | all text |
| `--mono` | ui-monospace stack | eyebrows, crumbs, codes, quote band |

Typography: headings weight 400–500, letter-spacing −0.02em; hero h1 `clamp(2.6rem, 5.6vw, 5rem)`;
section h2 `clamp(2rem, 3.6vw, 3.1rem)`; body 17 px / 1.55. Eyebrows: mono, uppercase, accent, with the asterisk.
Layout: Swiss grid, hairline borders instead of shadows, generous whitespace (sections 110 px, 72 px ≤ 980 px).
Breakpoint: one, at **980 px** (`@media (max-width: 980px)`). No shadows, no gradients except the 3D stage backdrop, no rounded cards on the website (app cards are rounded 14–26 px per the app template).

### Component and class inventory (use these; do not create look-alikes)
| Class / component | Use |
|---|---|
| `.wrap` | page-width container |
| `.btn`, `.btn-ghost`, `.btn-small` | primary (red pill), outline, small. One primary CTA per section |
| `.eyebrow.mono` + `<Asterisk size={14}/>` | section kicker |
| `.section-head` | 2-column title + intro |
| `.section-dark` | dark section variant |
| `.streams` / `.stream` | 5-column stream grid |
| `.stats` / `.stat` / `.dot` | red circle numbers |
| `.quote` | mono quote band (only real ZAIN LABS principles, R-CONTENT-2) |
| `.pgrid` / `<ProjectCard>` / `.pcard-more` | project grid, card, "see all" tile |
| `.status` + `st-mvp` / `st-live` / `st-dev` / `st-plan` | status pill; map via `statusClass()` in `web/lib/site.ts` |
| `.process` / `.step` / `.num` | numbered rows 01–05 |
| `.cta` / `.cta-visual` / `.cta-copy` | split CTA |
| `.page-head`, `.crumbs` | top of inner pages |
| `.detail`, `.aside`, `.tags`/`.tag`, `ul.ticks` | detail layout |
| `.filters` / `.chip` (`.active`) | filter chips |
| `form.contact`, `.consent`, `.hp`, `.notice.ok/.err` | forms |
| `<Asterisk>` (`web/components/Asterisk.tsx`, `mobile/src/components.tsx`) | brand mark; red on dark or light; never recolored except white on red |
| `<Hero3DClient>` | the only 3D canvas |

Logo: red eight-arm asterisk + "ZAIN LABS" in bold, letter-spacing 0.14em. Do not draw a new logo.

## 5. API contract used by the frontends (full contract: `api/openapi.json`, `docs/API.md`)

| Client function | HTTP | Success | Errors |
|---|---|---|---|
| `api.getContent()` | `GET /api/content` | 200 `ContentBundle` (+ ETag) | network → keep bundled/cached content |
| `api.getProject(slug)` | `GET /api/projects/{slug}` | 200 `Project` | 404 `not_found` |
| `api.sendContact(input)` | `POST /api/contact` | 201 `{ok: true, id}` | 422 `validation_error` + `fields`; 429 `rate_limited` |
| `api.subscribe(input)` | `POST /api/newsletter` | 202 `{ok: true, status: "pending"}`: tell the user to confirm via email | 422, 429 |

Error shape (always): `{ "error": "message for the user", "code": "…", "fields"?: { "email": "…" } }`.
The website uses same-origin `/api/*` (proxied to the backend by `next.config.ts`); the app uses
`EXPO_PUBLIC_API_URL` (default `http://localhost:8100`). Newsletter confirmation links go to the API, which
redirects to `/newsletter?status=confirmed|unsubscribed|invalid`.

## 6. Hallucination traps seen in practice

| Wrong (do not) | Right |
|---|---|
| `import { useRouter } from "next/router"` | `next/navigation` |
| `function Page({ params }) { params.slug }` | `const { slug } = await params` (R-NEXT-2) |
| `fetch("/api/subscribe")` | `api.subscribe(...)` → `POST /api/newsletter` |
| Adding `className="flex gap-4"` (Tailwind) | classes from `globals.css` or a new rule there |
| `import { OrbitControls, Environment } from "@react-three/drei"` | not installed; use three.js directly (see `Hero3D.tsx`) |
| `<Environment preset="city" />` / loading `.hdr` from a CDN | `RoomEnvironment` + `PMREMGenerator` (already in `Hero3D.tsx`) |
| `next/font/google` (Inter, Space Grotesk…) | `var(--sans)` / `var(--mono)` |
| Inventing a testimonials or "trusted by" logo row | omit (R-CONTENT-2) |
| `<Link asChild><Pressable style={[a, b]}>` (app) | `style={StyleSheet.flatten([a, b])}` (R-RN-2) |
| `SafeAreaView` from `react-native` | from `react-native-safe-area-context` |
| Adding `pages/api/...` or `app/api/...` handlers | backend lives in `apps/zainlabs/api`; ask the owner |
| Renaming status "In development" → "WIP" | statuses are fixed (R-CONTENT-4) |

## 7. Suggested backlog for the frontend agent (confirm each with the owner before starting)
Each item is about one session.
1. **German/English switch** (de default for DACH optional): needs owner approval of approach (no new deps preferred: a small dictionary + `[lang]` route segment). Ask first.
2. **Project media**: show owner-supplied screenshots per project (add an optional `images` field via the owner/backend agent first; R-SCOPE-2).
3. **Newsletter block on Home** reusing `<NewsletterForm>` inside a `.section-dark` section.
4. **App: newsletter screen** using `api.subscribe` with `source: "app"`.
5. **Polish**: hover/focus states, 404 page styling, print styles for project pages.

## 8. Checks that must pass before you report "done"
From `apps/zainlabs`:
```bash
node scripts/guard.mjs                                  # rules R-DEP, R-API, R-PRIV, tokens, no hard-coded content
(cd content && npm run check)                           # content valid and exported
(cd web && npx tsc --noEmit && npx next build)          # types + production build
(cd web && npm run test:e2e)                            # 58+ browser checks (first time: npx playwright install chromium)
(cd mobile && npx tsc --noEmit && EXPO_OFFLINE=1 npx expo export --platform web --output-dir /tmp/zl-export)
(cd api && python -m pytest -q)                         # includes the contract guard tests
```
From the repo root: `zf handoff check` and, before committing, `scripts/verify.sh`.

## 9. Report template (end of every session)
```
Task: <one line>
Files changed: <list>
Rules relevant: <R-… numbers>
Checks: guard ✓/✗, content ✓/✗, web build ✓/✗, e2e ✓/✗ (n passed), mobile ✓/✗, api tests ✓/✗
Visual check: compared with docs/design/<file> → <same | intended difference: …>
Not done / open questions: <…>
Assumptions: <…>
Next step: <…>
```
