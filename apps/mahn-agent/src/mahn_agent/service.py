"""Application service: sync from ERP, dunning run, approval, sending, dashboard figures."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import legal, matching
from .agent import drafter
from .agent.facts import build_facts
from .agent.validator import validate
from .config import Settings
from .mailer import build_message
from .models import AuditEvent, Customer, DunningCase, Invoice, Payment, ReminderDraft
from .policy import Policy, decide


def audit(s: Session, actor: str, action: str, entity: str, entity_id: int | None, detail: str = "") -> None:
    s.add(AuditEvent(actor=actor, action=action, entity=entity, entity_id=entity_id, detail=detail))


@dataclass
class RunReport:
    synced_invoices: int = 0
    matched_payments: int = 0
    unmatched_payments: int = 0
    closed_cases: int = 0
    drafts_created: int = 0
    escalated: int = 0
    skipped: dict[str, int] = field(default_factory=lambda: defaultdict(int))

    def as_dict(self) -> dict:
        d = self.__dict__.copy()
        d["skipped"] = dict(self.skipped)
        return d


class DunningService:
    def __init__(self, session: Session, settings: Settings, connector=None, mailer=None, llm_client: Any = None,
                 policy: Policy | None = None):
        self.s, self.settings, self.connector, self.mailer = session, settings, connector, mailer
        self.client = llm_client
        self.policy = policy or Policy()

    # ---------- sync ----------
    def sync(self, report: RunReport) -> None:
        c = self.connector
        customers = {cu.erp_id: cu for cu in self.s.scalars(select(Customer))}
        for ec in c.customers():
            cu = customers.get(ec.erp_id) or Customer(erp_id=ec.erp_id, name=ec.name)
            cu.name, cu.email, cu.country, cu.is_business = ec.name, ec.email, ec.country, ec.is_business
            cu.contact_person = ec.contact_person
            cu.late_payment_count = ec.late_payment_count
            if cu.id is None:
                self.s.add(cu)
            customers[ec.erp_id] = cu
        self.s.flush()

        invoices = {i.erp_id: i for i in self.s.scalars(select(Invoice))}
        seen = set()
        for ei in c.open_invoices():
            seen.add(ei.erp_id)
            cu = customers.get(ei.customer_erp_id)
            if cu is None:
                continue
            inv = invoices.get(ei.erp_id)
            if inv is None:
                inv = Invoice(erp_id=ei.erp_id, customer_id=cu.id, number=ei.number, issue_date=ei.issue_date,
                              due_date=ei.due_date, amount_total_cents=ei.amount_total_cents, currency=ei.currency)
                self.s.add(inv)
            inv.erp_paid_cents, inv.due_date, inv.amount_total_cents = ei.paid_cents, ei.due_date, ei.amount_total_cents
            if ei.disputed:
                inv.status = "disputed"
            elif inv.status == "disputed":
                inv.status = "open"
            report.synced_invoices += 1
        # open locally but no longer open in the ERP -> paid there
        for inv in invoices.values():
            if inv.status in ("open", "disputed") and inv.erp_id not in seen:
                inv.erp_paid_cents = inv.amount_total_cents
                inv.status = "paid"
                audit(self.s, "system", "invoice_paid_in_erp", "invoice", inv.id, inv.number)
        self.s.flush()

        known = {p.external_id for p in self.s.scalars(select(Payment))}
        for ep in c.unreconciled_payments():
            if ep.external_id in known:
                continue
            cu = customers.get(ep.customer_erp_id) if ep.customer_erp_id else None
            p = Payment(external_id=ep.external_id, booking_date=ep.booking_date, amount_cents=ep.amount_cents,
                        payer_name=ep.payer_name, reference=ep.reference, customer_id=cu.id if cu else None)
            self.s.add(p)
            self.s.flush()
            method = matching.match_payment(self.s, p)
            self.s.flush()
            self.s.expire_all()  # invoice.payments changed; reload before the next match
            if method:
                report.matched_payments += 1
                audit(self.s, "system", "payment_matched", "payment", p.id, f"{method} -> invoice {p.invoice_id}")
            else:
                report.unmatched_payments += 1
                audit(self.s, "system", "payment_unmatched", "payment", p.id, p.reference or "")
        self.s.flush()

    # ---------- stop logic ----------
    def apply_stop_logic(self, report: RunReport | None = None) -> None:
        for inv in self.s.scalars(select(Invoice).where(Invoice.status.in_(["open", "disputed"]))):
            self.s.refresh(inv)
            if inv.outstanding_cents > 0:
                continue
            inv.status = "paid"
            if inv.case and inv.case.status != "closed":
                inv.case.status = "closed"
                for d in inv.case.drafts:
                    if d.status == "pending":
                        d.status = "cancelled"
                        d.decision_note = "Zahlung eingegangen"
                        audit(self.s, "system", "draft_cancelled", "draft", d.id, "Zahlung eingegangen")
                audit(self.s, "system", "case_closed", "case", inv.case.id, f"{inv.number} bezahlt")
                if report:
                    report.closed_cases += 1

    # ---------- dunning run ----------
    def run(self, today: date | None = None, actor: str = "system", sync: bool = True) -> RunReport:
        today = today or date.today()
        report = RunReport()
        if sync and self.connector is not None:
            self.sync(report)
        self.apply_stop_logic(report)

        for inv in self.s.scalars(select(Invoice).where(Invoice.status.in_(["open", "disputed"])).order_by(Invoice.due_date)):
            case = inv.case
            if inv.due_date >= today:
                continue
            if case is None:
                case = DunningCase(invoice=inv)
                self.s.add(case)
                self.s.flush()
            cu = inv.customer
            dec = decide(policy=self.policy, today=today, due_date=inv.due_date, outstanding_cents=inv.outstanding_cents,
                         invoice_status=inv.status, customer_paused=cu.dunning_paused,
                         promise_to_pay_until=inv.promise_to_pay_until, case_level=case.level,
                         case_status=case.status, last_sent_on=case.last_sent_on,
                         has_open_draft=any(d.status == "pending" for d in case.drafts))
            if dec.action == "escalate":
                case.status = "escalated"
                report.escalated += 1
                audit(self.s, actor, "case_escalated", "case", case.id, dec.reason)
            elif dec.action == "draft":
                self._create_draft(inv, case, dec.level, today)
                report.drafts_created += 1
            else:
                report.skipped[dec.reason.split(":")[0]] += 1
        audit(self.s, actor, "dunning_run", "run", None, str(report.as_dict()))
        self.s.commit()
        return report

    def _customer_context(self, cu: Customer, inv: Invoice) -> dict:
        others = [i for i in cu.invoices if i.id != inv.id and i.status == "open"]
        return {"customer": cu.name, "business_customer": cu.is_business,
                "late_payments_last_24_months": cu.late_payment_count,
                "other_open_invoices": len(others),
                "relationship_hint": "long-standing customer, usually reliable" if cu.late_payment_count <= 1
                else "repeatedly paid late"}

    def _create_draft(self, inv: Invoice, case: DunningCase, level: int, today: date) -> ReminderDraft:
        cu = inv.customer
        claim = legal.compute_claim(outstanding_cents=inv.outstanding_cents, due_date=inv.due_date, today=today,
                                    country=cu.country, is_business=cu.is_business, level=level,
                                    charge_from_level=self.policy.charge_from_level,
                                    reminder_fee_cents=self.policy.reminder_fee_cents)
        pay_by = today + timedelta(days=self.policy.pay_within_days[level])
        facts = build_facts(invoice=inv, customer=cu, case=case, claim=claim, level=level, pay_by=pay_by,
                            today=today, settings=self.settings)
        result = drafter.draft(self.client, facts, self._customer_context(cu, inv), self.settings.model)
        d = ReminderDraft(case=case, level=level, subject=result.subject, body=result.body,
                          outstanding_cents=claim.outstanding_cents, interest_cents=claim.interest_cents,
                          fees_cents=claim.fees_cents, total_cents=claim.total_cents, claim_note=claim.note,
                          pay_by=pay_by, generated_by=result.generated_by, agent_notes=result.notes)
        self.s.add(d)
        self.s.flush()
        audit(self.s, "agent", "draft_created", "draft", d.id,
              f"Stufe {level} {inv.number} via {result.generated_by} ({result.attempts} Versuche)")
        return d

    # ---------- human decisions ----------
    def _facts_for(self, d: ReminderDraft, today: date):
        inv = d.case.invoice
        claim = legal.Claim(d.outstanding_cents, d.interest_cents, d.fees_cents, None, 0, 0, d.claim_note)
        return build_facts(invoice=inv, customer=inv.customer, case=d.case, claim=claim, level=d.level,
                           pay_by=d.pay_by, today=today, settings=self.settings)

    def approve_and_send(self, draft_id: int, approver: str, subject: str | None = None, body: str | None = None,
                         today: date | None = None) -> ReminderDraft:
        today = today or date.today()
        d = self.s.get(ReminderDraft, draft_id)
        if d is None:
            raise LookupError("Entwurf nicht gefunden")
        if d.status != "pending":
            raise ValueError(f"Entwurf ist nicht offen (Status: {d.status})")
        if not approver.strip():
            raise ValueError("Name der freigebenden Person erforderlich")
        edited = (subject is not None and subject != d.subject) or (body is not None and body != d.body)
        subject, body = subject if subject is not None else d.subject, body if body is not None else d.body
        errors = validate(self._facts_for(d, today), subject, body)
        if errors:
            raise ValueError("Validierung fehlgeschlagen: " + " ".join(errors))
        inv = d.case.invoice
        self.s.refresh(inv)
        # re-check right before sending: a payment may have arrived since drafting
        self.apply_stop_logic()
        if inv.outstanding_cents <= 0 or d.status != "pending":
            d.status = "cancelled"
            self.s.commit()
            raise ValueError("Rechnung inzwischen bezahlt: Versand gestoppt")
        if inv.outstanding_cents != d.outstanding_cents:
            raise ValueError("Offener Betrag hat sich geändert: bitte Entwurf ablehnen und neu erzeugen")
        cu = inv.customer
        if not cu.email:
            raise ValueError(f"Keine E-Mail-Adresse für {cu.name} hinterlegt")
        d.subject, d.body = subject, body
        msg = build_message(sender=self.settings.company_email, to=cu.email, subject=subject, body=body)
        where = self.mailer.send(msg, f"{inv.number}-L{d.level}")
        now = datetime.now(timezone.utc)
        d.status, d.decided_by, d.decided_at, d.sent_at = "sent", approver, now, now
        d.decision_note = "bearbeitet und freigegeben" if edited else "freigegeben"
        d.case.level, d.case.last_sent_on = d.level, today
        audit(self.s, approver, "draft_approved_sent", "draft", d.id, f"{inv.number} Stufe {d.level} -> {where}")
        self.s.commit()
        return d

    def reject(self, draft_id: int, approver: str, reason: str) -> ReminderDraft:
        d = self.s.get(ReminderDraft, draft_id)
        if d is None or d.status != "pending":
            raise ValueError("Entwurf nicht offen")
        d.status, d.decided_by, d.decided_at = "rejected", approver, datetime.now(timezone.utc)
        d.decision_note = reason
        audit(self.s, approver, "draft_rejected", "draft", d.id, reason)
        self.s.commit()
        return d

    def assign_payment(self, payment_id: int, invoice_id: int, actor: str) -> None:
        p, inv = self.s.get(Payment, payment_id), self.s.get(Invoice, invoice_id)
        if p is None or inv is None:
            raise LookupError("Zahlung oder Rechnung nicht gefunden")
        p.invoice_id, p.customer_id, p.match_method = inv.id, inv.customer_id, "manual"
        audit(self.s, actor, "payment_assigned", "payment", p.id, f"-> {inv.number}")
        self.s.flush()
        self.s.refresh(inv)
        self.apply_stop_logic()
        self.s.commit()

    def set_promise(self, invoice_id: int, until: date, actor: str) -> None:
        inv = self.s.get(Invoice, invoice_id)
        inv.promise_to_pay_until = until
        audit(self.s, actor, "promise_to_pay", "invoice", inv.id, f"bis {until:%d.%m.%Y}")
        self.s.commit()

    # ---------- dashboard ----------
    def summary(self, today: date | None = None) -> dict:
        today = today or date.today()
        buckets = {"nicht fällig": 0, "1-30": 0, "31-60": 0, "61-90": 0, "> 90": 0}
        by_customer: dict[int, dict] = {}
        total = overdue = 0
        for inv in self.s.scalars(select(Invoice).where(Invoice.status.in_(["open", "disputed"]))):
            out = inv.outstanding_cents
            if out <= 0:
                continue
            total += out
            days = (today - inv.due_date).days
            key = ("nicht fällig" if days <= 0 else "1-30" if days <= 30 else "31-60" if days <= 60
                   else "61-90" if days <= 90 else "> 90")
            buckets[key] += out
            if days > 0:
                overdue += out
                c = by_customer.setdefault(inv.customer_id, {"customer": inv.customer.name, "customer_id": inv.customer_id,
                                                             "overdue_cents": 0, "max_days": 0, "level": 0,
                                                             "late_count": inv.customer.late_payment_count})
                c["overdue_cents"] += out
                c["max_days"] = max(c["max_days"], days)
                c["level"] = max(c["level"], inv.case.level if inv.case else 0)
        for c in by_customer.values():
            c["risk"] = risk_score(c["overdue_cents"], overdue, c["max_days"], c["level"], c["late_count"])
        drafts_pending = len(self.s.scalars(select(ReminderDraft).where(ReminderDraft.status == "pending")).all())
        escalated = len(self.s.scalars(select(DunningCase).where(DunningCase.status == "escalated")).all())
        unmatched = len(self.s.scalars(select(Payment).where(Payment.invoice_id.is_(None))).all())
        return {"total_open_cents": total, "overdue_cents": overdue, "aging": buckets,
                "pending_approvals": drafts_pending, "escalated_cases": escalated, "unmatched_payments": unmatched,
                "top_risk": sorted(by_customer.values(), key=lambda c: -c["risk"])[:10]}


def risk_score(overdue_cents: int, total_overdue_cents: int, max_days: int, level: int, late_count: int) -> int:
    """0-100. Transparent weighted score: age, exposure share, dunning level, payment history."""
    age = min(max_days, 120) / 120 * 40
    share = (overdue_cents / total_overdue_cents if total_overdue_cents else 0) * 25
    lvl = level / 3 * 20
    hist = min(late_count, 5) / 5 * 15
    return round(age + share + lvl + hist)
