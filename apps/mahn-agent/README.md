# Mahn-Agent (P01)

**Agentic dunning (Mahnwesen) for DACH receivables.** Finds overdue invoices in Odoo or ERPNext,
matches incoming payments, drafts staged German reminders (Zahlungserinnerung → 1. Mahnung →
Letzte Mahnung) with a Claude agent, and sends **nothing without human approval**.

Part of the Factory HQ: F1 Software Factory, project P01.

## What it does

| Step | How | Deterministic? |
|---|---|---|
| Sync | Read-only connectors: Demo (JSON), Odoo (XML-RPC), ERPNext (REST) | yes |
| Payment match | Invoice number in the bank reference, or a unique exact amount for a known customer; anything ambiguous goes to a human | yes |
| Stop logic | Paid, disputed, paused customer, promise to pay, draft already waiting → no reminder; a payment arriving after drafting cancels the draft, and sending re-checks it | yes |
| Policy | Level 1 at ≥7 days overdue, level 2 at ≥21, level 3 at ≥35, at least 10 days between letters, one level at a time; after level 3: escalate to a human (collection agency / Mahnbescheid) | yes |
| Claim | Statutory default interest + flat fees for DE (§ 288 BGB), AT (§ 456 UGB / § 1000 ABGB), CH (Art. 104 OR), in integer cents | yes |
| Letter | **Claude agent** reads the facts through tools, writes the letter, submits it to a validator, fixes any errors. Falls back to templates | LLM + guardrails |
| Guardrails | Every amount must come from the facts; no other IBAN; no threats of debt collection or court before level 3, and never Schufa or criminal-complaint threats; invoice number, deadline and salutation required | yes |
| Approval | Web queue: read, edit (re-validated), approve & send or reject with a reason. Full audit log | human |
| Dashboard | Open and overdue receivables, aging buckets, top-risk customers (transparent 0–100 score), unmatched payments, escalations | yes |

## Quick start (2 minutes, no API key, no Docker)

```bash
cd apps/mahn-agent
make install          # venv + dependencies
make demo             # seed demo ERP, one dunning run, start the UI
# open http://localhost:8000   (API docs: http://localhost:8000/docs)
```

Or step by step:

```bash
.venv/bin/mahn-agent seed --reset          # 15 customers, ~50 invoices, bank payments
.venv/bin/mahn-agent run                   # sync + match + stop logic + drafts
.venv/bin/mahn-agent drafts --show         # read the drafts
.venv/bin/mahn-agent approve 1 --approver "Anna"   # send (to data/outbox/*.eml by default)
.venv/bin/mahn-agent pay RE-2026-01003     # demo: simulate a bank payment
.venv/bin/mahn-agent run                   # payment matched -> case closed, drafts cancelled
.venv/bin/mahn-agent run --today 2026-12-20   # time travel: see 1. Mahnung with interest
.venv/bin/mahn-agent serve
```

### With the Claude agent

```bash
export ANTHROPIC_API_KEY=sk-ant-...        # model: claude-opus-5-5 (override with MAHN_MODEL)
.venv/bin/mahn-agent eval --limit 3        # check pass rate first (costs a few cents)
.venv/bin/mahn-agent run
```

The agent uses server-side refusal fallbacks. Any API error falls back to the template, so a
dunning run never blocks.

### Full stack with Docker (Postgres + Mailpit)

```bash
docker compose up --build
# app: http://localhost:8000 · sent mails land in Mailpit: http://localhost:8025
```

### Real ERP

Set `MAHN_ERP=odoo` (plus `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_API_KEY`) or `MAHN_ERP=erpnext`
(`ERPNEXT_URL`, `ERPNEXT_API_KEY`, `ERPNEXT_API_SECRET`). Connectors are read-only. Start with
`MAHN_MAIL_BACKEND=outbox` so nothing reaches customers while you check the drafts.

## Tests

```bash
make test     # 27 tests: legal maths, policy, validator, agent self-correction (fake client),
              # payment/stop logic, approval re-checks, API + UI, ERPNext + Odoo mapping
make eval     # drafting eval: template mode offline, agent mode with ANTHROPIC_API_KEY
```

## Architecture

```
ERP (Odoo / ERPNext / Demo) ──read-only──► sync ──► payment matcher ──► stop logic
                                                                          │
                     policy (levels, gaps) ◄──────────────────────────────┘
                              │
                     legal claim (interest, fees, cents)
                              │
                     LetterFacts ──tools──► Claude agent ──submit_draft──► validator ─┐
                              │                    ▲                                  │
                              │                    └────────── errors ◄───────────────┘
                              └──(no key / failure)──► German templates
                                                         │
                     approval queue (web/API) ──human──► re-check payment ──► mailer (outbox / SMTP)
                                                         │
                                                    audit log
```

Code: `src/mahn_agent/`: `policy.py`, `legal.py`, `matching.py`, `service.py`, `agent/`
(facts, drafter, validator, templates), `connectors/`, `api.py` + `web/`, `cli.py`, `evals.py`.
Decisions: `docs/decisions/`. Registers: `docs/assumptions.md`, `docs/open-questions.md`.

> Not legal advice. Interest rules and base rates are configurable; verify them for your case.
