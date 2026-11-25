"""Dunning policy: which invoices get which reminder level today. Pure functions, fully deterministic."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


LEVEL_NAMES = {1: "Zahlungserinnerung", 2: "1. Mahnung", 3: "Letzte Mahnung"}


@dataclass(frozen=True)
class Policy:
    # minimum days overdue before each level may be sent
    thresholds: dict[int, int] = field(default_factory=lambda: {
        1: _int("MAHN_L1_DAYS", 7), 2: _int("MAHN_L2_DAYS", 21), 3: _int("MAHN_L3_DAYS", 35)})
    min_gap_days: int = field(default_factory=lambda: _int("MAHN_MIN_GAP_DAYS", 10))
    pay_within_days: dict[int, int] = field(default_factory=lambda: {1: 10, 2: 10, 3: 7})
    min_amount_cents: int = field(default_factory=lambda: _int("MAHN_MIN_AMOUNT_CENTS", 500))
    charge_from_level: int = field(default_factory=lambda: _int("MAHN_CHARGE_FROM_LEVEL", 2))
    reminder_fee_cents: int = field(default_factory=lambda: _int("MAHN_REMINDER_FEE_CENTS", 0))


@dataclass(frozen=True)
class Decision:
    action: str          # draft | skip | close | escalate
    level: int | None
    reason: str


def decide(*, policy: Policy, today: date, due_date: date, outstanding_cents: int, invoice_status: str,
           customer_paused: bool, promise_to_pay_until: date | None, case_level: int,
           case_status: str, last_sent_on: date | None, has_open_draft: bool) -> Decision:
    if outstanding_cents <= 0 or invoice_status in ("paid", "cancelled"):
        return Decision("close", None, "Rechnung beglichen oder storniert")
    if case_status in ("closed", "escalated"):
        return Decision("skip", None, f"Fall {case_status}")
    if invoice_status == "disputed":
        return Decision("skip", None, "Rechnung bestritten: Klärung vor weiteren Mahnungen")
    if customer_paused:
        return Decision("skip", None, "Mahnsperre für Kunde aktiv")
    if promise_to_pay_until and promise_to_pay_until >= today:
        return Decision("skip", None, f"Zahlungszusage bis {promise_to_pay_until:%d.%m.%Y}")
    if has_open_draft:
        return Decision("skip", None, "Entwurf wartet auf Freigabe")
    if outstanding_cents < policy.min_amount_cents:
        return Decision("skip", None, "Betrag unter Mindestbetrag")

    days_overdue = (today - due_date).days
    if last_sent_on and (today - last_sent_on).days < policy.min_gap_days:
        return Decision("skip", None, f"Mindestabstand {policy.min_gap_days} Tage noch nicht erreicht")
    if case_level >= 3:
        return Decision("escalate", None, "Letzte Mahnung ohne Zahlung: Inkasso/Mahnbescheid prüfen (menschliche Entscheidung)")
    nxt = case_level + 1
    if days_overdue >= policy.thresholds[nxt]:
        return Decision("draft", nxt, f"{days_overdue} Tage überfällig, Stufe {nxt} fällig")
    return Decision("skip", None, f"{days_overdue} Tage überfällig, Stufe {nxt} ab {policy.thresholds[nxt]} Tagen")
