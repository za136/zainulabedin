"""Everything a letter may state, computed deterministically before any LLM is involved."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

from ..money import fmt_date, fmt_eur
from ..policy import LEVEL_NAMES


@dataclass
class LetterFacts:
    level: int
    customer_name: str
    contact_person: str | None
    is_business: bool
    invoice_number: str
    issue_date: str
    due_date: str
    days_overdue: int
    currency: str
    amount_total_cents: int
    outstanding_cents: int
    interest_cents: int
    fees_cents: int
    total_cents: int
    claim_note: str
    pay_by: str
    prior_reminders: list[str]
    late_payment_count: int
    company_name: str
    company_address: str
    company_email: str
    company_iban: str
    company_bic: str
    extra_allowed_amounts: list[int] = field(default_factory=list)

    @property
    def level_name(self) -> str:
        return LEVEL_NAMES[self.level]

    def eur(self, cents: int) -> str:
        return fmt_eur(cents, self.currency)

    def allowed_amounts(self) -> set[int]:
        vals = {self.amount_total_cents, self.outstanding_cents, self.interest_cents, self.fees_cents,
                self.total_cents, self.amount_total_cents - self.outstanding_cents, *self.extra_allowed_amounts}
        return {v for v in vals if v > 0}

    def for_model(self) -> dict:
        """Facts as the model sees them: amounts pre-formatted so it copies, never computes."""
        d = asdict(self)
        for k in list(d):
            if k.endswith("_cents") and isinstance(d[k], int):
                d[k.removesuffix("_cents")] = self.eur(d.pop(k))
        d.pop("extra_allowed_amounts")
        d["level_name"] = self.level_name
        d["already_paid"] = self.eur(self.amount_total_cents - self.outstanding_cents)
        return d


def build_facts(*, invoice, customer, case, claim, level: int, pay_by, today, settings) -> LetterFacts:
    prior = [f"{LEVEL_NAMES[d.level]} vom {fmt_date(d.sent_at)}" for d in case.drafts if d.status == "sent" and d.sent_at]
    return LetterFacts(
        level=level, customer_name=customer.name, contact_person=customer.contact_person,
        is_business=customer.is_business, invoice_number=invoice.number, issue_date=fmt_date(invoice.issue_date),
        due_date=fmt_date(invoice.due_date), days_overdue=(today - invoice.due_date).days, currency=invoice.currency,
        amount_total_cents=invoice.amount_total_cents, outstanding_cents=claim.outstanding_cents,
        interest_cents=claim.interest_cents, fees_cents=claim.fees_cents, total_cents=claim.total_cents,
        claim_note=claim.note, pay_by=fmt_date(pay_by), prior_reminders=prior,
        late_payment_count=customer.late_payment_count, company_name=settings.company_name,
        company_address=settings.company_address, company_email=settings.company_email,
        company_iban=settings.company_iban, company_bic=settings.company_bic,
        extra_allowed_amounts=[4000],
    )
