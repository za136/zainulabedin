# AGENTS.md — instructions for coding agents

This repository is the **E-Commerce Store Factory** (German-first, multi-vertical commerce platform + store generator).
**Read [`HANDOFF.md`](./HANDOFF.md) before making changes** — it documents architecture, every module, legal constraints and open work.

## Setup & commands
- Node ≥ 22, pnpm 10. `pnpm install`, then `pnpm dev` (API :4000 with embedded Postgres, web :3000).
- Quality gates (run all before committing):
  `pnpm typecheck && pnpm test && pnpm factory validate --all && pnpm --filter @factory/web build`
- After editing `packages/db/src/schema.ts`: `pnpm db:generate` and commit the SQL migration.
- After editing `packages/config/src/schema.ts`: `pnpm --filter @factory/config schema`.

## Hard rules
1. Business rules (tax, prices, discounts, consents, order states) live in `packages/core` — pure, no I/O, unit-tested. Never re-implement them in routes or React.
2. Money = integer minor units, gross (VAT included). No floats.
3. Shop-specific content belongs in `stores/<id>/` (JSON/Markdown), not in code.
4. German is the default locale (`/`); every UI string must exist in both `apps/web/messages/de.json` and `en.json`.
5. Respect the legal features (see HANDOFF §12): "Zahlungspflichtig bestellen" button, consent checkboxes, Buchpreisbindung, § 312k cancel button, VAT display. Do not remove or weaken them.
6. The browser never receives API session tokens; storefront writes go through server actions (`apps/web/src/lib/actions.ts`).
7. Multi-step DB writes run in one transaction; side effects go through the outbox (`emit()`).
8. In the 3D viewer, keep labels as projected React DOM (no drei `<Html>`).
9. Do not commit secrets (`.env`, keys). Use `.env.example` for documentation.
