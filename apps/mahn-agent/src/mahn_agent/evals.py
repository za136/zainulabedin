"""Agent eval: run the drafter over a fixed set of cases and measure guardrail pass rate, attempts, cost.

    mahn-agent eval              # template mode (no key) - checks templates across all cases
    ANTHROPIC_API_KEY=... mahn-agent eval --limit 6   # real agent; costs money
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import date, timedelta

from . import legal
from .agent import drafter
from .agent.facts import LetterFacts
from .agent.validator import validate
from .config import Settings


@dataclass
class Case:
    name: str
    level: int
    outstanding: int
    total: int
    country: str
    business: bool
    contact: str | None


CASES = [
    Case("DE B2B L1", 1, 124000, 124000, "DE", True, "Frau Petra Müller"),
    Case("DE B2B L2 partial", 2, 45000, 90000, "DE", True, None),
    Case("DE B2B L3", 3, 1549000, 1549000, "DE", True, "Herr Jonas Schneider"),
    Case("DE B2C L2", 2, 18900, 18900, "DE", False, None),
    Case("DE B2C L3", 3, 89950, 89950, "DE", False, None),
    Case("AT B2B L2", 2, 312075, 312075, "AT", True, "Frau Anna Gruber"),
    Case("AT B2C L3", 3, 250000, 250000, "AT", False, None),
    Case("CH B2B L2", 2, 780000, 780000, "CH", True, "Herr Reto Keller"),
    Case("CH B2B L3", 3, 45000, 45000, "CH", True, None),
]


def facts_for(c: Case, settings: Settings, today: date) -> LetterFacts:
    due = today - timedelta(days={1: 10, 2: 45, 3: 70}[c.level])
    claim = legal.compute_claim(outstanding_cents=c.outstanding, due_date=due, today=today, country=c.country,
                                is_business=c.business, level=c.level)
    return LetterFacts(
        level=c.level, customer_name="Eval Kunde GmbH" if c.business else "Max Mustermann",
        contact_person=c.contact, is_business=c.business, invoice_number=f"RE-EVAL-{c.level}{c.outstanding}",
        issue_date=(due - timedelta(days=14)).strftime("%d.%m.%Y"), due_date=due.strftime("%d.%m.%Y"),
        days_overdue=(today - due).days, currency="EUR", amount_total_cents=c.total, outstanding_cents=c.outstanding,
        interest_cents=claim.interest_cents, fees_cents=claim.fees_cents, total_cents=claim.total_cents,
        claim_note=claim.note, pay_by=(today + timedelta(days=10)).strftime("%d.%m.%Y"), prior_reminders=[],
        late_payment_count=2, company_name=settings.company_name, company_address=settings.company_address,
        company_email=settings.company_email, company_iban=settings.company_iban, company_bic=settings.company_bic,
        extra_allowed_amounts=[4000])


def run(settings: Settings, limit: int | None = None, client=None) -> dict:
    today = date.today()
    client = client if client is not None else drafter.make_client(settings.llm)
    rows, passed = [], 0
    for c in CASES[:limit]:
        f = facts_for(c, settings, today)
        t0 = time.perf_counter()
        r = drafter.draft(client, f, {"late_payments_last_24_months": 2}, settings.model)
        dt = time.perf_counter() - t0
        errors = validate(f, r.subject, r.body)
        ok = not errors and (client is None or r.generated_by.startswith("claude"))
        passed += ok
        rows.append({"case": c.name, "ok": ok, "by": r.generated_by, "attempts": r.attempts,
                     "seconds": round(dt, 2), **r.usage, "errors": errors})
    return {"mode": "agent" if client else "template", "cases": len(rows), "passed": passed,
            "pass_rate": round(passed / len(rows), 3) if rows else 0, "rows": rows}
