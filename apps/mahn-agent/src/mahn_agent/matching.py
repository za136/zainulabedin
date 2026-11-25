"""Match incoming payments to open invoices. Conservative: ambiguous payments go to a human."""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Invoice, Payment


def _norm(s: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def match_payment(session: Session, payment: Payment) -> str | None:
    """Returns the match method, or None if the payment needs manual review."""
    open_invoices = [i for i in session.scalars(select(Invoice).where(Invoice.status.in_(["open", "disputed"])))
                     if i.outstanding_cents > 0]
    ref = _norm(payment.reference or "")
    # 1) invoice number in the remittance reference (partial payments allowed)
    by_ref = [i for i in open_invoices if _norm(i.number) and _norm(i.number) in ref]
    if len(by_ref) == 1:
        payment.invoice_id, payment.customer_id = by_ref[0].id, by_ref[0].customer_id
        payment.match_method = "reference"
        return "reference"
    # 2) known customer with exactly one open invoice of exactly this amount
    if payment.customer_id:
        exact = [i for i in open_invoices
                 if i.customer_id == payment.customer_id and i.outstanding_cents == payment.amount_cents]
        if len(exact) == 1:
            payment.invoice_id, payment.match_method = exact[0].id, "customer_amount"
            return "customer_amount"
    return None
