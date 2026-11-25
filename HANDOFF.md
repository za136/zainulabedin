# HANDOFF — E-Commerce Store Factory

> **Audience:** AI coding agents (Claude Code, Codex, Hydrogen-style storefront agents, …) and human developers taking over this codebase.
> **Goal of this document:** after reading it you can run, extend, rebrand, re-point and deploy the platform without reading every file first.
> **Status date:** 2026-11-25 · Branch `claude/ecommerce-store-factory-rj88wa`

---

## 0. TL;DR for agents

1. `pnpm install && pnpm dev` → storefront :3000, API :4000 (docs at `/docs`). No database server needed (embedded PGlite).
2. **Never put business rules in the frontend or in routes.** Money/tax/discount/legal rules live in `packages/core` (pure, tested). Routes call services; services call core.
3. **A store = a folder in `stores/`.** Change a shop by editing JSON there, not code. `pnpm factory validate --all` must pass.
4. **German first.** Default locale `de` lives at `/`; every UI string exists in `packages/i18n/src/de.json` *and* `en.json` (keys must match; shared by website and app).
5. Before committing: `pnpm typecheck && pnpm test && pnpm factory validate --all && pnpm --filter @factory/web build`.
6. Money is **integer minor units** (cents), **gross** (VAT included). Never floats.
7. Read §12 (legal) before touching checkout, prices, discounts, reviews or subscriptions — there are German laws behind each of them.

---

## 1. What was built (status)

| Area | Status | Notes |
| --- | --- | --- |
| Domain core (tax, pricing, discounts, shipping, legal, orders, kinds, diagrams) | ✅ complete, 32 unit tests | `packages/core` |
| Store blueprint + presets + JSON Schemas | ✅ | `packages/config`, 7 presets |
| Database (Postgres/PGlite), migrations, idempotent seed | ✅ tested on PGlite **and** PostgreSQL 16 | `packages/db` |
| Headless API (≈42 endpoints, OpenAPI) | ✅ 28 end-to-end tests | `apps/api` |
| Payments: mock (dev), Vorkasse (bank transfer) | ✅ tested | |
| Payments: Stripe Checkout + webhooks | ⚠️ implemented, **not tested against live Stripe** (no key in this environment) | `apps/api/src/modules/payments/stripe.ts` |
| Fulfillment: shipments, e-books (watermark), 3D books, courses, downloads, licence keys, subscriptions, bookings | ✅ | |
| Subscriptions: purchase, entitlement, § 312k cancel, renewal job | ⚠️ renewal **extends the period without charging** — wire to Stripe Billing before selling real subscriptions | `library.service.ts → renewSubscriptions` |
| Storefront (Next.js 16): home, listing/search, product pages per kind, cart, checkout, mock pay, success, account/library, legal, 3D viewer, admin | ✅ production build passes, real-browser journey passes with 0 console errors | `apps/web` |
| Factory CLI | ✅ 10 tests | `tools/factory` |
| PWA (installable website: iOS, Android, Windows, macOS, Linux, ChromeOS) | ✅ manifest, store-themed icons, service worker, offline page — verified in Chromium | `apps/web/src/app/manifest.ts`, `app-icon/`, `public/sw.js` |
| Native iOS + Android app (Expo SDK 58 / React Native 0.88) | ✅ iOS & Android Hermes bundles compile; full purchase journey verified on the Expo **web** build in an emulated iPhone 13 + tablet. ⚠️ **Not yet run on a physical device or iOS/Android simulator** (none available here) and not yet built/signed with EAS | `apps/mobile` |
| Canva | ✅ `canva:pull` via Canva Connect API (untested without a token); brand kit `kAHVj-kOybo` recorded in `stores/wissenswerk/store.json` | §10 |
| Docker / compose / CI | ⚠️ written, **images not built in this environment** (no Docker daemon) | `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml` |
| Email | ⚠️ console mailer only (logs mails) — add SMTP/Postmark adapter | `notifications/mailer.ts` |
| File storage | ⚠️ local disk adapter; missing files are served as demo placeholders outside production | `library.service.ts → resolveDownload` |

---

## 2. Running it

### Zero setup (default)
```bash
pnpm install
pnpm dev                       # = API (tsx watch) + web (next dev) in parallel
```
The API creates an embedded Postgres in `apps/api/.data/<store>` on first boot, runs migrations and seeds the catalog from the store folder.

### With PostgreSQL
```bash
cp .env.example .env           # repo-root .env is loaded by the API
# DATABASE_URL=postgres://factory:factory@localhost:5432/factory
pnpm dev
```

### Full stack in containers
```bash
docker compose up --build      # db + api + web; STORE=<id> docker compose up to switch store
```

### Useful commands
| Command | Purpose |
| --- | --- |
| `pnpm dev:api` / `pnpm dev:web` | run one side |
| `pnpm db:generate` | create a SQL migration after editing `packages/db/src/schema.ts` |
| `pnpm db:seed` | re-sync catalog from `stores/$STORE` (idempotent: slug/SKU matching) |
| `pnpm --filter @factory/api openapi` | write `apps/api/openapi.json` |
| `pnpm --filter @factory/api admin:create you@x.de 'long-password'` | create/promote an admin |
| `pnpm --filter @factory/config schema` | regenerate JSON Schemas after changing the config schema |
| `node apps/web/e2e/storefront-journey.cjs /tmp/shots` | browser smoke test (API + web must be running) |

---

## 3. Repository map

```
.
├── HANDOFF.md / AGENTS.md / CLAUDE.md   ← you are here
├── stores/
│   └── wissenswerk/                     ← flagship store (the "blueprint" the factory renders)
│       ├── store.json                   identity, legal entity, markets, tax, shipping, payments, theme, home layout
│       ├── catalog/10-books.json …      categories, products, coupons, sellers (merged by filename order)
│       ├── diagrams/*.json              3D diagram scenes (interactive books)
│       └── content/{de,en}/*.md         Impressum, AGB, Widerruf, Datenschutz, Versand (with {{placeholders}})
├── packages/
│   ├── core/      pure domain (no I/O, isomorphic, runs in browser too)
│   ├── config/    store.json schema, loader, cross-validation, presets, emitted *.schema.json
│   ├── db/        Drizzle schema, migrations (drizzle/), client (pg | pglite), seed
│   ├── sdk/       typed API client + public API types
│   └── i18n/      UI translations (de/en) shared by web and mobile
├── apps/
│   ├── api/       Fastify API (src/modules/* = one folder per bounded context)
│   ├── web/       Next.js storefront + PWA (src/app/[locale]/*, src/components/*)
│   └── mobile/    Expo / React Native app for iOS, Android, web (app/* = expo-router screens, src/*)
└── tools/factory/ CLI + templates (legal pages, starter diagram)
```

---

## 4. Architecture

```
            ┌────────────────────────── stores/<id>/ (JSON + Markdown) ──────────────────────────┐
            │ store.json · catalog/*.json · diagrams/*.json · content/<locale>/*.md                │
            └───────────────┬───────────────────────────────────────────┬──────────────────────┘
                            │ loadStore() (validated, cross-checked)     │ seedStore()
                            ▼                                            ▼
 Browser ──► Next.js (apps/web) ──server actions / RSC──► Fastify API (apps/api) ──► PostgreSQL / PGlite
   ▲          BFF: session token in httpOnly cookie       modules → services → @factory/core (pure rules)
   │          @factory/sdk                                transactional outbox → mailer/webhooks
   └── three.js 3D diagram viewer (client-only)            payment providers (mock, Vorkasse, Stripe)
```

**Layering rules (enforced by convention — keep them):**
- `core` imports nothing but `zod`. No Node APIs (uses Web Crypto) → also bundled into the browser.
- `config` → `core`. `db` → `core`, `config`. `api` → all packages. `web` → `core` + `sdk` only (never `db`/`api`).
- API services receive an explicit `AppContext` (`apps/api/src/context.ts`): `env`, `store`, `db`, `payments`, `mailer`, `vat`, `now()`. No globals → tests inject a clock, mailer, in-memory DB.
- Adapters are chosen in exactly one place: `apps/api/src/bootstrap.ts`.

**Single-tenant per deployment.** One database = one store. Simple data isolation, GDPR deletion, backups and scaling. To run many stores, run many deployments (same image, different `STORE` + `DATABASE_URL`). Marketplace sellers exist *inside* a store (`features.marketplace`).

---

## 5. The factory: stores, presets, rebuilds

### Store anatomy (`stores/<id>/store.json`)
Validated by `packages/config/src/schema.ts`; editors get autocompletion through `"$schema": "../../packages/config/store.schema.json"`.

| Key | Meaning |
| --- | --- |
| `id`, `name`, `tagline`, `url` | identity |
| `locales` | `{ default: "de", supported: ["de","en"] }` |
| `markets` | country → currency, e.g. DE/AT → EUR, CH → CHF |
| `legal` | Impressum data (§ 5 DDG), VAT ID, register, LUCID (VerpackG), WEEE no., dispute resolution text |
| `tax` | `originCountry`, `oss`, `registrations` (e.g. `["CH"]`), `smallBusiness` (§ 19 UStG), `priceStrategy`, `rateOverrides` |
| `catalog` | `enabledKinds`, `priceBindingDefault` (Buchpreisbindung), `lowStockThreshold` |
| `shipping.zones` | countries, rates per currency, free-shipping thresholds, weight limits |
| `payments.providers` | `mock`, `prepayment` (bank data), `stripe` (methods) |
| `features` | `guestCheckout`, `reviews`, `wishlist`, `b2b`, `marketplace` |
| `theme` | colours, radius, fonts, logo → CSS variables in the storefront |
| `design` | `source: local|canva`, `canva.brandKitId`, `canva.assets[]` |
| `home.sections` | ordered list of `hero`, `kinds`, `products`, `categories`, `usp`, `banner`, `diagram` |
| `seo` | title template, description |

### Presets (`packages/config/src/presets.ts`)
`general`, `bookstore`, `electronics`, `digital`, `academy`, `consulting`, `marketplace` — each decides kinds, theme, home layout and a demo catalog. Add a preset by adding an entry to `PRESETS`; `tools/factory/test/factory.test.ts` automatically checks that it produces a valid store.

### "Point it and rebuild"
- `STORE=<id>` (or `STORE_DIR=/abs/path`) selects the store for API, seed and CLI.
- Changing catalog JSON → `pnpm db:seed` (or `POST /v1/admin/reseed`) updates in place.
- Changing theme/home/legal → picked up on next API boot (storefront reads everything from `GET /v1/store`).
- New store → `pnpm factory create <id> --preset <p>` or `--from <existing>`; then fill `legal`, run `validate`.

---

## 6. Domain model (packages/core)

### 6.1 Product kinds — the extensibility core
`packages/core/src/product-kinds.ts` defines every kind once:

| kind | fulfillment | default tax | withdrawal | price binding |
| --- | --- | --- | --- | --- |
| `physical` (electronics, goods) | shipment | standard | 14 days | – |
| `book` | shipment | books | 14 days | ✓ |
| `ebook` | entitlement (watermarked files) | ebooks | digital content | ✓ |
| `interactive_book` (3D) | entitlement (diagrams) | ebooks ⚠️ verify | digital content | ✓ |
| `digital_download` | download | digital_services | digital content | – |
| `license` (digital tools) | licence key | digital_services | digital content | – |
| `subscription` | subscription + entitlement | digital_services | digital content | – |
| `course` | entitlement + progress | digital_services | digital content | – |
| `service` (consulting) | booking (slots) | services | service | – |

Kind-specific data lives in `products.attributes`, validated by `attributeSchemas[kind]` (GPSR manufacturer data, ISBN, course modules, licence seats, …).

**Checklist — adding a new kind (e.g. `gift_card`, `bundle`, `rental`):**
1. `core/src/product-kinds.ts`: add attribute schema + `PRODUCT_KIND_DEFINITIONS` entry (choose or add a `FulfillmentStrategy`).
2. New strategy? add handler in `apps/api/src/modules/fulfillment/fulfillment.service.ts`.
3. `packages/i18n/src/{de,en}.json`: `kinds.<kind>` and `kindText.<kind>`.
4. Product page block: `apps/web/src/components/product/kind-blocks.tsx` and `apps/mobile/app/product/[slug].tsx → KindDetails`; icons in `components/home/sections.tsx`, `product-art.tsx` and the app's `KIND_GLYPH`. If it is digital content, add it to `DIGITAL_KINDS` in `apps/mobile/src/lib/format.ts`.
5. Factory scaffold: `ATTRIBUTE_SKELETONS` in `tools/factory/src/commands.ts`.
6. Tests in `core` and an API flow test.

### 6.2 Tax engine (`core/src/tax.ts`)
`resolveTax(category, {destinationCountry, customerType, vatIdValid}, settings)` returns rate + treatment:
- domestic → origin rate (DE 19 / 7 %)
- EU B2C with OSS → **destination** rate (AT 20/10 %, …); without OSS → origin rate
- EU B2B with *validated* VAT ID → **reverse charge** 0 % + invoice note
- local services (consulting) B2C → origin rate
- non-EU with registration (`tax.registrations: ["CH"]`) → that country's MWST; otherwise **export** 0 %
- `smallBusiness` → no VAT + § 19 UStG note
Prices are stored **gross for the origin country**. `priceStrategy: gross-constant` keeps shelf prices across EU countries (only the VAT share changes); `net-constant` recomputes. Export/reverse-charge customers pay the net price.
Shipping VAT follows the goods (Nebenleistung) and is split proportionally across rates.
⚠️ Rate table (`VAT_RATES`) is maintained precisely for DACH; other EU reduced rates are best-effort and flagged `source: 'fallback'` when missing. Use `tax.rateOverrides` and get a Steuerberater sign-off.

### 6.3 Pricing (`core/src/pricing.ts`)
`priceCart()` is pure and deterministic: tax resolution → destination prices → coupon allocation (largest-remainder, no lost cents) → shipping quote → shipping VAT split → tax lines → totals + notices (`price_bound_excluded`, `coupon_problem`, `shipping_unavailable`, `tax_rate_fallback`). The API uses it for cart previews **and** re-prices inside the checkout transaction.

### 6.4 Buchpreisbindung (fixed book prices)
New books/e-books in DE/AT must sell at the publisher's fixed price. Products have `priceBound` (default from `catalog.priceBindingDefault`; imported foreign-language books can set `false`). Percent/fixed coupons skip price-bound lines; free shipping is allowed. The UI explains why ("§ Gebundener Ladenpreis").

### 6.5 Legal consents (`core/src/legal.ts`)
`consentRequirements(kinds)` → `terms` (required), `digital_waiver` (§ 356 Abs. 5 BGB, optional), `service_early_start` (§ 356 Abs. 4 BGB, optional).
Without the digital waiver the order is still accepted, but digital access starts **14 days after payment** (`digitalAccessStartsAt`) — this is the legally correct behaviour, not a bug.

### 6.6 Orders
State machine in `core/src/orders.ts`: `pending_payment → paid → processing → partially_fulfilled → fulfilled → completed` (+ `cancelled`, `refunded`). Item fulfillment: `unfulfilled | scheduled | fulfilled | cancelled | returned`. Order numbers are gap-free per year (`WW-2026-000042`, § 14 UStG) via an atomic counter row.

### 6.7 3D diagram spec (`core/src/diagram.ts`)
JSON scenes: `nodes` (shape, position, scale, colour, label, detail, chapter, group), `edges` (dashed, directed, animated `flow`, label), `steps` (guided tour: title, narration, camera, focus). Bilingual everywhere. Validated incl. referential integrity. Author with `pnpm factory diagram:new`, preview at `/diagrams/<id>`.

---

## 7. API (apps/api)

- Base: `http://localhost:4000`, OpenAPI UI at `/docs`, spec via `pnpm --filter @factory/api openapi`.
- Market per request: `?locale=de&country=AT&currency=EUR` or headers `X-Locale`, `X-Country`, `X-Currency`, `Accept-Language`.
- Auth: opaque session tokens (SHA-256 hashed in DB, revocable), `Authorization: Bearer …` or cookie `sf_session`. Passwords: scrypt.
- Errors: always `{ "error": { "code", "message", "details?" } }` with stable `code`s (the storefront translates them under `errors.*`).

| Area | Endpoints |
| --- | --- |
| Store | `GET /v1/store`, `GET /v1/content/:key` (`imprint|terms|withdrawal|privacy|shipping` or slug), `GET /v1/health` |
| Catalog | `GET /v1/catalog/products` (q, kind, category, featured, inStock, sort, page, slugs) · `GET /v1/catalog/products/:slug` · `/:slug/slots` · `/:slug/reviews` (GET/POST) · `GET /v1/catalog/categories` · `GET /v1/diagrams/:id` |
| Cart | `POST /v1/carts` · `GET/PATCH /v1/carts/:id` (country, currency, coupon, shipping rate) · `POST /v1/carts/:id/items` · `PATCH/DELETE /v1/carts/:id/items/:itemId` |
| Checkout | `GET /v1/checkout/consents?kinds=` · `POST /v1/checkout` |
| Orders | `GET /v1/orders/:id?token=` · `GET /v1/orders/:id/invoice` (HTML Rechnung) |
| Payments | `POST /v1/payments/mock/confirm` (dev) · `POST /v1/payments/stripe/webhook` |
| Auth | `POST /v1/auth/register` · `/login` (optional `claim` of a guest order) · `/logout` |
| Account | `GET/PATCH/DELETE /v1/me` · `/me/orders` · `/me/library` · `/me/library/:ent/lessons/:lesson/complete` · `/me/subscriptions` · `/me/subscriptions/:id/cancel` · `GET /v1/downloads/:token` |
| Admin | `/v1/admin/stats` · `/orders` · `/orders/:id` · `/orders/:id/mark-paid` · `/orders/:id/cancel` · `/orders/:id/items/:item/ship` · `/products` · `PATCH /products/:id` · `PATCH /variants/:id` · `/reviews` · `/reviews/:id/:decision` · `/marketplace/payouts` · `/reseed` |

**Key flows (all in `apps/api/test/api.test.ts`):**
- *Checkout* (`checkout.service.ts`): one transaction re-prices the cart for the real destination + customer type, validates consents, **atomically reserves stock and appointment slots** (`UPDATE … WHERE available >= qty`), allocates the order number, snapshots items, increments coupon usage, closes the cart and writes an outbox event. The payment provider is called after commit.
- *Payment confirmation* always goes through `markOrderPaid()` — idempotent (webhooks retry), checks the amount, converts reservations into deductions, runs fulfillment, emits `order.paid`.
- *Guest purchases* get an order access token (stored hashed). Registration/login with `claim: {orderId, token}` attaches the order and its entitlements to the account — never claim by e-mail alone (account-takeover risk).
- *Outbox* (`notifications/outbox.ts`): events are written in the business transaction and delivered by `processOutbox()` (scheduler every 2 s). Extend `handle()` for webhooks, search indexing, CRM.
- *Jobs* (`jobs/scheduler.ts`): outbox, expiry of unpaid redirect orders (48 h; Vorkasse orders wait), subscription renewal.

**Adding a payment provider:** implement `PaymentProvider` (`payments/registry.ts`), register it in `buildPaymentRegistry`, add the provider shape to `paymentProviderSchema` in `packages/config/src/schema.ts`, and route its webhook to `markOrderPaid` / `markPaymentFailed`. Candidates for DACH: PayPal direct, Klarna direct, Mollie, Unzer (Kauf auf Rechnung), Adyen.

---

## 8. Storefront (apps/web)

- **Next.js 16 App Router**, Turbopack, React 19, Tailwind v4, next-intl 4. `src/proxy.ts` is Next 16's renamed middleware.
- **German first:** `localePrefix: 'as-needed'`, `localeDetection: false` → German at `/`, English at `/en`. To add French: add `fr` to `src/i18n/routing.ts`, `packages/i18n/src/fr.json` (register it in `packages/i18n/src/index.ts`), `store.json → locales.supported`, and `content/fr/*.md`.
- **BFF pattern:** the browser never holds the API session token. `src/lib/api.ts` builds an SDK client from httpOnly cookies (`sf_session`, `sf_cart`, `sf_country`). All writes are **server actions** in `src/lib/actions.ts` returning `{ok, data} | {ok:false, code}`.
- **Theme:** `app/[locale]/layout.tsx` maps `store.theme` to CSS variables; `app/globals.css` maps Tailwind tokens (`bg-primary`, `rounded-[var(--radius-brand)]`, …) onto them. Custom utilities (`btn-primary`, `card`, `input`, `chip`, `container-page`) are `@utility` blocks (Tailwind v4 requires this for `@apply` reuse).
- **No Google Fonts CDN** (GDPR ruling LG München I, 3 O 17493/20). Self-host font files in `public/fonts` if you want Fraunces/Inter exactly.
- **Product art:** `components/product/product-art.tsx` generates typeset book covers / kind cards when a product has no image. Real images (`product.images[0]`) always win.
- **3D viewer:** `components/diagram/diagram-viewer.tsx` (UI, tour, details, fullscreen, keyboard, WebGL detection, accessible text outline) + `diagram-canvas.tsx` (react-three-fiber scene, loaded client-only). Labels are React-owned DOM elements positioned by projecting 3D anchors each frame — **do not switch back to drei `<Html>`**, it caused `removeChild` crashes on client navigation with React 19.
- **Pages:** `/`, `/products` (+ `?q,kind,category,sort,inStock,page`), `/products/[slug]`, `/cart`, `/checkout`, `/checkout/mock-pay`, `/checkout/success`, `/account`, `/account/orders/[id]`, `/diagrams/[id]`, `/legal/[page]` (accepts `impressum|agb|widerruf|datenschutz|versand-zahlung` and English slugs), `/admin`, `/api/invoice/[id]` (route handler proxying invoices with the session).
- **Structured data:** product pages emit schema.org `Product`/`Book`/`Course` JSON-LD.

### Using another frontend (Shopify Hydrogen-style, mobile app, agent)
The API is headless and the SDK is framework-agnostic:
```ts
import { createClient } from '@factory/sdk';
const api = createClient({ baseUrl: 'https://api.example.de', market: { locale: 'de', country: 'DE' } });
const { items } = await api.catalog.list({ kind: 'interactive_book' });
```
A Hydrogen/Remix storefront can consume this API exactly like `apps/web` does (keep tokens server-side). Conversely, a **Shopify backend adapter** (sync catalog to Shopify, use Shopify checkout) is not built — see roadmap.


## 8b. Every platform: PWA, iOS, Android

```
                 ┌──────────── stores/<id>/store.json (name, theme, icon, bundle ids, policies) ────────────┐
                 ▼                                   ▼                                                      ▼
   apps/web (Next.js) ── PWA install ──►   apps/mobile (Expo) ── EAS ──► App Store / Google Play      other frontends
   desktop & mobile browsers               iOS · Android · (web)                                       via @factory/sdk
                 └──────────────────────────────┬────────────────────────────────────────┘
                                   one API · one domain core · one i18n catalogue
```

### PWA (apps/web)
- `src/app/manifest.ts` → `/manifest.webmanifest`, generated from the store (name, colours, shortcuts to search/cart/library).
- `src/app/app-icon/[size]/route.tsx` → PNG icons in any size from the logo mark + brand colours (`?maskable=1` for full-bleed). Apple touch icon and theme colour are set in the layout metadata.
- `public/sw.js`: cache-first for hashed static assets, network-first navigations with `public/offline.html` fallback. **Never caches API calls, carts, accounts or prices.** Bump `VERSION` when changing caching.
- Registered only in production builds (`components/pwa/register-sw.tsx`).

### Native app (apps/mobile)
- **Stack:** Expo SDK 58, React Native 0.88, expo-router (file-based routes in `app/`), `use-intl` with the shared `@factory/i18n` catalogue, `@factory/sdk` for the API, `@factory/core` for formatting. No business logic is duplicated.
- **Store-driven build:** `app.config.ts` reads `stores/$STORE/store.json` → app name, slug, deep-link `scheme`, `ios.bundleIdentifier`, `android.package`, icon (`assets/app-icon.png`, create with `pnpm factory app:icon <store>`), splash and adaptive-icon colours. Different store → different app from the same code.
- **Config:** `EXPO_PUBLIC_API_URL` (default `http://localhost:4000`; Android emulator `http://10.0.2.2:4000`), `EXPO_PUBLIC_WEB_URL` (website; used for 3D diagrams and web checkout). Profiles in `eas.json`.
- **Screens:** tabs Start / Suche / Warenkorb / Konto; product detail (variants, slots, stock, VAT note, kind details, editions); checkout (same consents and § 312j button as the web); order status (Vorkasse details, dev mock payment, invoice); account (login/register incl. guest-order claim, library with downloads, licence keys (copy), course progress, 3D, subscriptions with § 312k cancel, orders); legal pages (native Markdown); settings (language, delivery country).
- **Security:** session token in Keychain/Keystore (`expo-secure-store`), localStorage on web. The app talks to the API directly with a Bearer token (native apps are not subject to the browser threat model the web BFF protects against).
- **3D diagrams:** one implementation for all platforms — the app shows the website's `/embed/diagram/<id>` (chrome-less three.js viewer) in a WebView and passes the session as an `Authorization` header (never in the URL), so purchased diagrams unlock.
- **App-store billing rules (important):** Apple App Review 3.1.1 and Google Play require their own billing for *digital content* bought inside an app. `store.json → apps.digitalGoodsInNativeApps`:
  - `web-checkout` (default): on iOS/Android, digital items (e-books, 3D books, courses, downloads, licences, subscriptions) show "Auf der Website kaufen" and open the website; afterwards they appear in the in-app library. Allowed for EU storefronts under the DMA and for US storefronts — **check each market and Apple's current entitlement requirements before release.**
  - `browse-only`: reader-app mode — no purchase path for digital items in the app.
  - Physical goods (books, electronics) and real-world services (consulting appointments) always use the shop's own checkout in the app.
  - Implementing StoreKit / Play Billing (e.g. via RevenueCat) is on the roadmap.
- **Run:** `pnpm dev` (API + website) then `pnpm dev:mobile` → `i` / `a` / `w` or Expo Go. **Ship:** `cd apps/mobile && npx eas build -p ios|android --profile production`, then `npx eas submit`. Needs an Expo account, Apple Developer Program and Google Play Console accounts.
- **Verify:** `pnpm mobile:export` (compiles iOS, Android and web bundles), `node apps/mobile/e2e/app-journey.cjs` against the web export.

---

## 9. Data model (packages/db/src/schema.ts)

`customers`, `sessions`, `addresses`, `sellers`, `categories` (+`category_translations`), `products` (+`product_translations`, `product_categories`), `variants` (stock on hand/reserved, weight, Grundpreis measure, subscription billing), `prices` (per currency), `service_slots`, `reviews`, `coupons`, `carts`, `cart_items`, `orders` (frozen totals, tax lines, consents with timestamp + IP, guest token hash), `order_items` (snapshots), `payments`, `entitlements`, `subscriptions`, `bookings`, `course_progress`, `counters`, `outbox_events`.
Workflow: edit schema → `pnpm db:generate` → commit the new SQL in `packages/db/drizzle/` → it runs automatically on API boot (`AUTO_MIGRATE=true`).

---

## 10. Canva integration

- Your Canva account has one brand kit: **`kAHVj-kOybo`** (recorded in `stores/wissenswerk/store.json → design.canva.brandKitId`).
- **Pipeline:** list Canva design IDs in `design.canva.assets` (`{ designId, output: "hero.png", format: "png" }`), set `CANVA_ACCESS_TOKEN` (Canva Connect OAuth, scope `design:content:read`), run `pnpm factory canva:pull <store>`. Files land in `stores/<id>/assets/`; reference them from `home.sections[].image`, `theme.logo.src` or `products[].images`. (Serve `assets/` via the web `public/` folder or a CDN.)
- **For agents with the Canva MCP connector:** generate on-brand designs (hero banners, category tiles, social posts, book covers) with the brand kit above, create the chosen candidate in the account, then add its design ID to `design.canva.assets` and run `canva:pull`. Ask the owner before creating designs in their account.
- The storefront never calls Canva at runtime — designs are exported, versioned and served as static assets.

---

## 11. Testing

| Suite | Command | What it proves |
| --- | --- | --- |
| core (32) | `pnpm --filter @factory/core test` | VAT rules DE/AT/CH/OSS/reverse charge/export/§19, rounding, allocation, Buchpreisbindung, shipping VAT split, consents, state machine |
| config (5) | `pnpm --filter @factory/config test` | blueprint loading, cross-validation, legal page fallback, templating, presets |
| db (4) | `pnpm --filter @factory/db test` | idempotent seed, price binding, German FTS, timezone-correct slot seeding |
| api (28) | `pnpm --filter @factory/api test` | full HTTP flows on embedded Postgres: catalog/search, carts, consents, stock & slot races, mock/Vorkasse payments, entitlements, downloads, invoices, subscriptions, B2B, OSS, admin, reviews |
| factory (10) | `pnpm --filter @factory/cli test` | every preset generates a valid store; clone; scaffolds |
| i18n (2) | `pnpm --filter @factory/i18n test` | every locale has exactly the German keys, no empty strings |
| browser (web) | `node apps/web/e2e/storefront-journey.cjs <dir>` | real Chromium journey incl. WebGL scene, checkout, account, English, legal, mobile |
| browser (app) | `node apps/mobile/e2e/app-journey.cjs <dir>` | Expo web build on emulated iPhone 13 + tablet: search, product, cart, checkout, mock payment, account, English, legal |
| native bundles | `pnpm mobile:export` | iOS + Android Hermes bundles compile |

Tests use `pglite://memory` and an injectable clock (`TestApp.clock.offsetMs`) — no external services.

---

## 12. Legal & compliance map (DACH) — what is built vs. what the owner must do

| Requirement | Built | Owner TODO |
| --- | --- | --- |
| Impressum (§ 5 DDG), § 18 MStV | template filled from `store.json → legal` | real company data (validator warns on placeholders) |
| AGB, Widerrufsbelehrung, Muster-Widerrufsformular, Datenschutz | templates in `content/de` (+ EN courtesy translations) | **legal review** |
| Order button "Zahlungspflichtig bestellen" (§ 312j BGB) | ✓ | – |
| Price display incl. VAT + shipping note (PAngV), Grundpreis (§ 4 PAngV), honest strike prices | ✓ (`compareAt`, `unitMeasure`) | ensure `compareAt` follows § 11 PAngV (lowest price of last 30 days) |
| Digital content withdrawal waiver (§ 356 Abs. 5 BGB) | ✓ consent + 14-day delayed access without it | – |
| Services early start (§ 356 Abs. 4 BGB) | ✓ consent recorded | – |
| Cancellation button for subscriptions (§ 312k BGB) | ✓ in account | also offer a no-login cancellation page if you sell subscriptions to guests |
| Buchpreisbindung (BuchPrG / AT BPrBG) | ✓ | maintain `priceBound` per product |
| VAT: OSS, reverse charge, export, § 19 UStG, invoices per § 14 UStG, gap-free numbers | ✓ | OSS registration, VIES (`VAT_VALIDATION=vies`), Steuerberater sign-off, archive invoices 10 years (GoBD) |
| GPSR (EU 2023/988) product safety info | ✓ fields + PDP block | fill manufacturer/EU responsible person for every physical product |
| ElektroG / WEEE, BattG, VerpackG (LUCID) | registration numbers in config/PDP/Impressum | actual registrations, take-back info page |
| Reviews transparency (§ 5b UWG) | ✓ verified-purchase badge + policy text | moderation process |
| GDPR: minimal storage, no tracking, account deletion with retention | ✓ (`DELETE /v1/me`), no third-party fonts/scripts | DPA with hosting/payment/email providers, cookie consent **if** you add analytics |
| Accessibility (BFSG since 28 Jun 2025) | semantic HTML, focus styles, skip link, ARIA, reduced motion, 3D text fallback | full WCAG 2.1 AA audit, accessibility statement page |
| Consumer dispute resolution statement (VSBG § 36) | ✓ field | – |

---

## 13. Production checklist

1. `NODE_ENV=production` (disables the mock payment provider automatically), strong `APP_SECRET`.
2. Real `DATABASE_URL` (managed Postgres 16+), backups, `DB_POOL_MAX`.
3. Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, enable `stripe` in `store.json`, register webhook `https://api…/v1/payments/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`. **Run a live test order.**
4. `VAT_VALIDATION=vies`.
5. Replace `ConsoleMailer` with an SMTP/Postmark/SES adapter (order confirmation must reach the customer on a durable medium with the Widerrufsbelehrung).
6. File storage: put e-books/downloads in `STORAGE_DIR` or implement an S3 adapter in `resolveDownload` (signed URLs, 1 h expiry already in place).
7. `WEB_URL`, `API_URL` (public, used in download links), `CORS_ORIGINS`.
8. Fill `legal`, review all `content/*`, remove "(Platzhalter)".
9. Subscriptions: connect renewal to Stripe Billing before selling recurring plans.
10. Monitoring: `/v1/health`, structured Fastify logs (auth headers redacted), alert on `outbox_events.attempts >= 5`.

---

## 14. Known gaps & roadmap (prioritised)

1. **Live-test Stripe** and add **Stripe Billing** for subscription renewals (currently renewal only extends the period).
2. **Email adapter** + templates (HTML, invoice PDF attachment).
3. **Refunds/returns** (RMA, partial refunds, `refunded` status transitions, Gutschrift/credit notes).
4. **Object storage** adapter (S3/R2) + e-book watermarking of actual EPUB/PDF files.
5. **Admin UI**: product editor, coupon management, seller portal (API partly exists).
6. Search adapter (Meilisearch/Typesense) behind the catalog service; keep Postgres FTS as default.
7. Bookings in the account (list/reschedule/cancel) and calendar (ICS) invites.
8. Wishlist UI (flag exists), product image upload, image CDN.
9. Gift cards (taxed as multi-purpose vouchers on redemption), bundles.
10. Price history for § 11 PAngV reference prices.
11. Shopify/Hydrogen interop: catalog sync adapter or Storefront-API-compatible facade.
12. Build & publish Docker images in CI; Helm chart.
13. **Native apps:** run on real devices/simulators, EAS builds & store listings, push notifications (order shipped, course updates), universal links / app links for `/products/*`, StoreKit + Play Billing (RevenueCat) for digital goods, native Stripe PaymentSheet, offline reading of purchased e-books.
14. Desktop app shell (Tauri/Electron) only if PWA install isn't enough.

---

## 15. Conventions for contributors / agents

- TypeScript strict everywhere; zod at every boundary (env, store files, HTTP bodies).
- Keep `packages/core` free of I/O and add a unit test for every rule change.
- API: one folder per bounded context in `apps/api/src/modules/`; routes stay thin; services take `AppContext`; return stable error codes via `AppError`.
- DB writes that must be consistent go in **one transaction**; side effects (email, webhooks) go through `emit()` (outbox), never directly.
- Storefront: server components by default; `'use client'` only for interaction; all UI text via `packages/i18n` (add DE **and** EN); never call the API from the browser with credentials — use server actions.
- Money: integers, gross, `formatMoney`/`money()` for display. Dates: UTC in DB, `Europe/Berlin` in UI.
- Commit messages: imperative, explain the *why*; run the quality gates first.
