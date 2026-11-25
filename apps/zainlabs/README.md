# ZAIN LABS: website + iOS/Android app

The main platform where every stream and project lives: one content source feeds the website, its
public API and the mobile app. Design taken from Canva templates (see "Design source" below).

```
content/   @zainlabs/content: streams, projects, site copy (single source of truth)
web/       Next.js 16 website + JSON API + real-time 3D hero (three.js)
mobile/    Expo SDK 58 app for iOS and Android (expo-router), syncs from the API, works offline
```

```
                 content/src/projects.ts  ← add a project here
                        │
         ┌──────────────┴──────────────┐
   web (Next.js)                  mobile (Expo)
   pages + /api/content  ──sync──►  bundled copy → cache → live
   /api/contact  ◄──────────────── contact form (source: "app")
```

## Run it

```bash
# 1. website + API  →  http://localhost:3000
cd apps/zainlabs/web && npm install && npm run dev

# 2. app  →  press i (iOS simulator), a (Android emulator), or scan the QR code with Expo Go
cd apps/zainlabs/mobile && npm install && cp .env.example .env && npx expo start
#    on a real phone set EXPO_PUBLIC_API_URL in .env to your computer's LAN IP, e.g. http://192.168.1.20:3000
#    in the browser: npx expo start --web

# content check (duplicate slugs, unknown streams, https links)
cd apps/zainlabs/content && npm install && npm run check
```

Production builds: `cd web && npm run build && npm start` (any Node host or Vercel). Store builds for the
app: `npx eas build --platform ios|android` and `npx eas submit` (needs an Expo account plus Apple
Developer / Google Play accounts).

## Add a project or stream

Edit `content/src/projects.ts` (or `streams.ts`), run `npm run check` in `content/`, done. The website
shows it at once; the app picks it up on its next sync (pull to refresh), and new app builds ship it
in the bundled offline copy.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/content` | everything (site, streams, projects); the app syncs from here |
| GET | `/api/streams` | streams with project counts |
| GET | `/api/projects?stream=software` | projects, optionally by stream |
| GET | `/api/projects/{slug}` | one project |
| POST | `/api/contact` | contact request `{name, email, company?, stream, message, consent: true}`; stored in `data/contact-requests.jsonl`, optionally forwarded to `CONTACT_WEBHOOK_URL` |

Env (web): `NEXT_PUBLIC_SITE_URL`, `CONTACT_STORE_DIR`, `CONTACT_WEBHOOK_URL`, `CORS_ORIGIN`.

## Design source (Canva)

Generated from Canva templates in the ZAIN LABS Canva account, then coded:
- Website: "DACH Tech Impact": black / warm off-white, one signal-red accent, red asterisk mark,
  glossy black 3D spheres and cubes, red stat circles, mono quote band; plus the numbered 01–05
  process rows from "Infographic - Step One".
- App: "Mobile App UI with Geometric Form": centred wordmark + "Guten Tag", stream chips, bezel
  featured card with MVP badge, icon grid, black tab bar (accent changed from blue to the web red).

The 3D hero is rendered live with three.js (studio reflections generated locally, no downloads);
the still in `web/public/brand/hero-3d.jpg` and `mobile/assets/brand/hero-3d.jpg` is a render of the same scene.

## Before going live

- Fill in the **Impressum** (`web/app/impressum/page.tsx`; required in Germany, § 5 DDG) and review
  the privacy notice (`web/app/datenschutz/page.tsx`). Placeholders are highlighted in yellow.
- Replace `hello@zainlabs.example` in `content/src/site.ts` and set `NEXT_PUBLIC_SITE_URL`.
- Point the contact form at your inbox or CRM with `CONTACT_WEBHOOK_URL`.
