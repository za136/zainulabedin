# ADR-003: Stack for the MVP

- Status: accepted · 2026-11-25

## Decision
Python 3.11+, FastAPI, SQLAlchemy 2.0, Jinja2 server-rendered UI (no JS build step), SQLite by default,
Postgres via Docker Compose, Mailpit for safe SMTP testing, Anthropic SDK (Claude Opus 5.5) for drafting.
Connectors read-only; Odoo via XML-RPC external API, ERPNext via REST token auth.

## Why
Matches the F1 stack (Python/FastAPI, Postgres, Docker Compose) at zero cost; one `make demo` to run.
Server-rendered UI keeps the MVP small; a TypeScript front end can consume the same `/api/v1` later.

## Consequences
− No migrations yet (tables created on start). Add Alembic before the first pilot (see open questions).
