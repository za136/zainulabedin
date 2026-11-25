"""Statutory default interest and flat fees for DE / AT / CH. Deterministic: the LLM never computes money.

NOT LEGAL ADVICE. Rates are configurable because base rates change twice a year.
Sources the rules are modelled on:
  DE  § 288 Abs. 1/2 BGB: base rate + 5 pp (consumer) / + 9 pp (business);
      § 288 Abs. 5 BGB: EUR 40 flat fee for business debtors;
      § 286 Abs. 3 BGB: default at the latest 30 days after due date and receipt of invoice.
  AT  § 456 UGB: base rate + 9.2 pp between businesses; § 1000 ABGB: 4 % p.a. otherwise;
      § 458 UGB: EUR 40 flat fee between businesses.
  CH  Art. 104 OR: 5 % p.a. default interest; no statutory flat fee.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal


def _rate(name: str, default: str) -> Decimal:
    return Decimal(os.environ.get(name, default))


@dataclass(frozen=True)
class Jurisdiction:
    code: str
    base_rate: Decimal          # % p.a., 0 if the rate is fixed
    spread_business: Decimal    # percentage points
    spread_consumer: Decimal
    flat_fee_business_cents: int
    legal_basis: str


def jurisdictions() -> dict[str, Jurisdiction]:
    # Defaults: DE Basiszinssatz 1.27 % (01.07.2025). Verify current values before production use.
    de_base = _rate("MAHN_BASE_RATE_DE", "1.27")
    at_base = _rate("MAHN_BASE_RATE_AT", "1.53")
    return {
        "DE": Jurisdiction("DE", de_base, Decimal(9), Decimal(5), 4000, "§§ 286, 288 BGB"),
        "AT": Jurisdiction("AT", at_base, Decimal("9.2"), Decimal(0), 4000, "§§ 456, 458 UGB / § 1000 ABGB"),
        "CH": Jurisdiction("CH", Decimal(0), Decimal(5), Decimal(5), 0, "Art. 104 OR"),
    }


def annual_rate(j: Jurisdiction, is_business: bool) -> Decimal:
    if j.code == "AT" and not is_business:
        return Decimal(4)
    if j.code == "CH":
        return Decimal(5)
    return j.base_rate + (j.spread_business if is_business else j.spread_consumer)


@dataclass(frozen=True)
class Claim:
    outstanding_cents: int
    interest_cents: int
    fees_cents: int
    interest_from: date | None
    interest_days: int
    annual_rate: Decimal
    note: str

    @property
    def total_cents(self) -> int:
        return self.outstanding_cents + self.interest_cents + self.fees_cents


def compute_claim(*, outstanding_cents: int, due_date: date, today: date, country: str, is_business: bool,
                  level: int, charge_from_level: int = 2, default_after_days: int = 30,
                  reminder_fee_cents: int = 0) -> Claim:
    j = jurisdictions().get(country, jurisdictions()["DE"])
    rate = annual_rate(j, is_business)
    if level < charge_from_level:
        return Claim(outstanding_cents, 0, 0, None, 0, rate, "Freundliche Zahlungserinnerung ohne Zinsen und Gebühren.")
    start = due_date + timedelta(days=default_after_days)
    days = max((today - start).days, 0)
    interest = (Decimal(outstanding_cents) * rate / 100 * days / 365).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    fees = reminder_fee_cents
    parts = [f"Verzugszinsen {str(rate).replace('.', ',')} % p.a. für {days} Tage ab {start.strftime('%d.%m.%Y')} ({j.legal_basis})"]
    if is_business and j.flat_fee_business_cents:
        fees += j.flat_fee_business_cents
        parts.append(f"Verzugspauschale {j.flat_fee_business_cents // 100} € (Geschäftskunde)")
    if reminder_fee_cents:
        parts.append(f"Mahngebühr {reminder_fee_cents / 100:.2f} €".replace(".", ","))
    return Claim(outstanding_cents, int(interest), fees, start, days, rate, "; ".join(parts) + ".")
