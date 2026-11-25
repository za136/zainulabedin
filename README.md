# 🏭 E-Commerce Store Factory

**A German-first, multi-vertical commerce platform — and a factory that stamps out new stores from one JSON blueprint.**

Sell printed books, e-books, **interactive 3D books**, electronics, software licences, digital downloads, subscriptions, online courses and consulting appointments — with the legal and tax rules of the DACH market (Germany, Austria, Switzerland) built in, not bolted on.

The flagship demo store **Wissenswerk** ("Bücher, die man begreifen kann") ships in `stores/wissenswerk`.

**Runs everywhere from one codebase and one store blueprint:**

| Platform | How |
| --- | --- |
| 🌐 Website (desktop, tablet, phone browsers) | `apps/web` — Next.js, German at `/`, English at `/en` |
| 📲 Installable app on iPhone/iPad, Android, Windows, macOS, Linux, ChromeOS | the website is a **PWA** (manifest, store-themed icons, service worker, offline page) |
| 🍏 Native iOS app · 🤖 Native Android app | `apps/mobile` — Expo / React Native, built with EAS for the App Store & Google Play |
| 🧩 Any other frontend (partners, agents, kiosks) | headless API + typed `@factory/sdk` |

> 👉 **Agents and new developers: read [`HANDOFF.md`](./HANDOFF.md) first.** It explains the architecture, every module, how to extend it, and what is still open.

---

## Quick start (zero setup — no Docker, no database server)

```bash
pnpm install
pnpm dev            # API on :4000 (embedded Postgres via PGlite), storefront on :3000
```

- Storefront: http://localhost:3000 (German) · http://localhost:3000/en (English)
- API docs (OpenAPI/Swagger): http://localhost:4000/docs
- Demo coupons: `WILLKOMMEN10` (10 %, not on price-bound books), `VERSANDFREI`, `TECH20`
- Payments: a **mock provider** (dev only) and **Vorkasse** (bank transfer) work out of the box; Stripe activates with `STRIPE_SECRET_KEY`.
- Back office: set `ADMIN_EMAIL` + `ADMIN_PASSWORD` before starting the API, sign in, open `/admin`.

### Native app (iOS / Android)

```bash
pnpm dev                 # API + website must be running
pnpm dev:mobile          # Expo dev server → press i (iOS simulator), a (Android emulator), w (web) or scan the QR code with Expo Go
# Android emulator reaches your machine at 10.0.2.2:  EXPO_PUBLIC_API_URL=http://10.0.2.2:4000 pnpm dev:mobile
cd apps/mobile && npx eas build -p ios     # / -p android — store builds via Expo Application Services
```
The app's name, bundle IDs, icon, splash and colours come from `stores/<id>/store.json` (`STORE=<id>`).

## The factory

```bash
pnpm factory presets                                   # general, bookstore, electronics, digital, academy, consulting, marketplace
pnpm factory create mein-shop --preset bookstore --name "Mein Shop" --company "Mein Shop GmbH"
pnpm factory validate mein-shop
STORE=mein-shop pnpm dev                               # run it
pnpm factory product:new mein-shop ebook mein-ebook   # scaffold a product
pnpm factory diagram:new mein-shop kapitel-1          # scaffold a 3D diagram
pnpm factory canva:pull mein-shop                      # export Canva designs into the store's assets
pnpm factory app:icon mein-shop                        # save the iOS/Android app icon rendered from the theme
```

A store is a folder: `store.json` (identity, Impressum data, markets, tax, shipping, payments, theme, home layout) + `catalog/*.json` + `diagrams/*.json` + `content/<locale>/*.md`. Point `STORE` at another folder and you get another shop — API, storefront, theme, legal pages and catalog all follow.

## What's inside

| Package | What it does |
| --- | --- |
| `packages/core` | Pure domain logic: money, DACH/EU/OSS VAT engine, product-kind registry, Buchpreisbindung-aware discounts, shipping, consent rules (§ 356 BGB), order state machine, Grundpreis, 3D-diagram spec |
| `packages/config` | `store.json` schema (+ generated JSON Schemas for editor autocompletion), loader, cross-validation, presets |
| `packages/db` | Drizzle ORM schema & migrations; runs on PostgreSQL (prod) or embedded PGlite (dev/tests); idempotent seeding from a store folder |
| `apps/api` | Fastify headless commerce API: catalog + German full-text search, carts, checkout, payments, fulfillment, entitlements, subscriptions, bookings, invoices, reviews, admin |
| `packages/sdk` | Typed, dependency-free API client for any frontend |
| `apps/web` | Next.js 16 storefront + PWA: German at `/`, English at `/en`, themed from `store.json`, three.js 3D-diagram viewer |
| `apps/mobile` | Expo / React Native app for iOS, Android (and web): catalog, search, cart, checkout, account library, 3D diagrams |
| `packages/i18n` | German/English UI texts shared by website and app |
| `tools/factory` | The factory CLI |

## Quality gates

```bash
pnpm typecheck && pnpm test && pnpm factory validate --all && pnpm --filter @factory/web build
```

81 automated tests (domain rules, seeding, 28 end-to-end API flows on embedded Postgres, factory presets, translation completeness) plus two real-browser journeys: `apps/web/e2e/storefront-journey.cjs` (website) and `apps/mobile/e2e/app-journey.cjs` (app on an emulated iPhone + tablet). iOS and Android bundles compile with `pnpm mobile:export`.

## Production

`docker compose up --build` runs Postgres + API + storefront. See [`HANDOFF.md` → Production checklist](./HANDOFF.md#13-production-checklist) — legal data, secrets, Stripe webhooks, VIES, file storage and email must be configured before going live.

> ⚖️ The legal texts and tax tables are carefully researched templates, **not legal or tax advice**. Have them reviewed (Rechtsanwalt / Steuerberater) before launch.
