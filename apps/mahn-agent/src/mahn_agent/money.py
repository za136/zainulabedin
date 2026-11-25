"""Money is stored as integer cents. Never floats."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal


def to_cents(value: Decimal | float | int | str) -> int:
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def fmt_eur(cents: int, currency: str = "EUR") -> str:
    """German formatting: 1.234,56 €"""
    sign = "-" if cents < 0 else ""
    cents = abs(cents)
    euros, rest = divmod(cents, 100)
    grouped = f"{euros:,}".replace(",", ".")
    symbol = {"EUR": "€", "CHF": "CHF"}.get(currency, currency)
    return f"{sign}{grouped},{rest:02d} {symbol}"


def fmt_date(d) -> str:
    return d.strftime("%d.%m.%Y")
