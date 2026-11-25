# HANDOFF: state of everything

> Status: active · Last updated: 2026-11-25 by Claude Code · Read `AGENTS.md` first.

This is the entry point for the next agent or developer. Each row links to a detailed handoff with
status, how to run and test, decisions, blockers, next actions and a session log.
`zf handoff status` prints the same list with each item's first next action; `zf handoff check`
verifies every handoff is complete.

## Factories

| Code | Factory | Engine in this repo | Handoff |
|---|---|---|---|
| F1 | Software Factory (Agentic AI) | `src/zfactory/software_factory` | [F1](docs/factories/F1-software-factory.md) |
| F2 | Website Factory | `src/zfactory/web_factory`, `apps/zainlabs/web` | [F2](docs/factories/F2-website-factory.md) |
| F3 | App Factory (iOS & Android) | `src/zfactory/app_factory`, `apps/zainlabs/mobile` | [F3](docs/factories/F3-app-factory.md) |
| F4 | Content & Media Factory (Hollywood Studio) | `src/zfactory/content_studio` | [F4](docs/factories/F4-content-media-factory.md) |
| F5 | Deep-Tech & Engineering Intelligence | `src/zfactory/research` | [F5](docs/factories/F5-deeptech-factory.md) |

## Projects

| Code | Project | Factory | Status | Where the work is | Handoff |
|---|---|---|---|---|---|
| P01 | Mahn-Agent | F1 | **MVP**, 27 tests, Docker verified | `apps/mahn-agent` | [P01](apps/mahn-agent/HANDOFF.md) |
| P02 | Atlas ERP | F1 | PRD written | repo `za136/Atlas-ERP` | [P02](docs/projects/P02-atlas-erp.md) |
| P03 | Aegis / Meridian | F1 | In development | repo `za136/Aegis` | [P03](docs/projects/P03-aegis-meridian.md) |
| P04 | Engineering Intelligence System | F5 | Blueprint | Drive | [P04](docs/projects/P04-engineering-intelligence.md) |
| P05 | KlangWerk Studio OS | F4 | Blueprint | Drive | [P05](docs/projects/P05-klangwerk-studio-os.md) |
| P06 | VideoForge AI | F4 | PRD | Drive | [P06](docs/projects/P06-videoforge-ai.md) |
| P07 | Micro-drama & channel network | F4 | Planning | Drive + studio engine | [P07](docs/projects/P07-micro-drama-channels.md) |
| P08 | Showroom & e-commerce sites | F2 | Planning (foundations built) | `apps/zainlabs/web` | [P08](docs/projects/P08-showroom-ecommerce-sites.md) |
| P09 | Companion mobile apps | F3 | Planning (foundations built) | `apps/zainlabs/mobile` | [P09](docs/projects/P09-companion-apps.md) |
| P10 | Portfolio & showcase presence | Brand | In development | `apps/zainlabs` | [P10](docs/projects/P10-portfolio.md) |
| P11 | Lenovo Linux studio workstation | Infra | To do | owner's hardware | [P11](docs/projects/P11-lenovo-linux-workstation.md) |
| ZL | ZAIN LABS website + iOS/Android app | F2+F3 | In development, build + emulated run verified | `apps/zainlabs` | [ZL](apps/zainlabs/HANDOFF.md) |
| V01 | Plastic surgery clinic (venture) | – | Concept | `ventures/plastic-surgery` | [V01](ventures/plastic-surgery/HANDOFF.md) |
| V02 | Facials / skin spa (venture) | – | Concept | `ventures/facials` | [V02](ventures/facials/HANDOFF.md) |

Codes F#/P## match the Google Drive "Factory HQ" (START HERE doc and Master Tracker sheet). ZL and V##
exist only in this repo.

## Global next actions (in priority order)
1. Owner: give the Claude GitHub App access to `za136/zainulabedin` (or push from a laptop) so this
   branch reaches GitHub. Until then the work exists in the session container and in the git bundle
   sent to the owner.
2. Owner: test the ZAIN LABS app on a phone with Expo Go (`docs/testing/mobile-and-web.md`).
3. P01: run the Claude eval with an API key; set up an ERPNext/Odoo test instance.
4. P11: install Linux on the Lenovo and run `scripts/verify.sh` there.
5. F1 Phase 2: extract shared modules (LLM client, approval queue, audit log) into `packages/`.
6. Fill Impressum/Datenschutz and deploy the ZAIN LABS website.

## Environment notes for agents
- **Verify everything:** `scripts/verify.sh` (Python factories, Mahn-Agent, content check, website
  build, app typecheck + web export). Last full run: see Session log.
- **Git:** work branch `claude/multi-project-repo-setup-7ofpx7`. Pushing from Claude Code cloud
  sessions currently fails with HTTP 403 (GitHub App not installed on the repo). Owner said pushing
  is not required for now; commit locally.
- **Sandboxed sessions:** the Expo CLI needs `EXPO_OFFLINE=1` when api.expo.dev is blocked. Docker
  builds behind a TLS-intercepting proxy need the proxy CA copied into the image (only in the sandbox;
  the committed Dockerfile is clean).
- **No Mac:** iOS is tested via Expo Go on an iPhone or EAS cloud builds.
- **Secrets:** none are committed. Variables are documented in each `.env.example`.

## Session log
- 2026-11-25 · Claude Code · monorepo + factory engines (`zf`), P01 Mahn-Agent MVP, ZAIN LABS website +
  app from Canva designs, handoff system for all factories/projects/ventures · `scripts/verify.sh`: 5/5 PASS (zfactory tests + handoff check, Mahn-Agent 27 tests, content check, website build, app typecheck + export).
