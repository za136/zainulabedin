# HANDOFF: za136/zainulabedin

> Status: index / archive · Last updated: 2026-11-26 by Claude Code

## Summary
This repo is no longer where project work happens. It is the owner's first learning repo and an index that
points to the project repos (see `README.md`). **Agents: go to `za136/factory-hq` and read its `AGENTS.md` and
`HANDOFF.md`;** then the `HANDOFF.md` of the product you work on.

## What happened here
- 2026-11-25: three Claude Code cloud sessions worked from this repo. Two could not push (GitHub App 403), so their
  work stayed in their containers:
  - "Multi-project repo structure setup" → monorepo on branch `claude/multi-project-repo-setup-7ofpx7`
    (zfactory engines, Mahn-Agent, ZAIN LABS, ventures, handoff system).
  - "E-commerce store factory" → branch `claude/ecommerce-store-factory-rj88wa`.
  - "Browser extension concepts for DACH" → research in chat only.
- 2026-11-26: access fixed; both branches were pushed here, then split into their own private repos with history:
  - monorepo `apps/mahn-agent` → `za136/mahn-agent`; `apps/zainlabs` → `za136/zainlabs`; the rest → `za136/factory-hq`
  - store factory branch → `za136/ecommerce-store-factory`
  - research → `za136/dach-local-first-products`
  Each was re-verified from a fresh clone (factory-hq 13 tests + handoff check, Mahn-Agent 27 tests + eval 9/9,
  ZAIN LABS `scripts/verify.sh` 7/7, store factory 81/81).

## Branches kept as archive
- `claude/multi-project-repo-setup-7ofpx7` (monorepo as built on 2026-11-25)
- `claude/ecommerce-store-factory-rj88wa` (store factory as built on 2026-11-25)
- `claude/kind-davinci-myzopa` (this index; merge into `main` if you want the index on the default branch)

## Next actions
1. Owner: merge `claude/kind-davinci-myzopa` into `main` if you want this index on the front page.
2. Owner: decide whether the new repos stay private (the ZAIN LABS website links to some of them as "Source").
3. Continue work in `za136/factory-hq` → `HANDOFF.md` → "Global next actions".
