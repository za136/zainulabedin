from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(primary_key=True)
    erp_id: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    contact_person: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(200))
    country: Mapped[str] = mapped_column(String(2), default="DE")
    is_business: Mapped[bool] = mapped_column(Boolean, default=True)
    late_payment_count: Mapped[int] = mapped_column(Integer, default=0)
    dunning_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    invoices: Mapped[list[Invoice]] = relationship(back_populates="customer")


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(primary_key=True)
    erp_id: Mapped[str] = mapped_column(String(64), unique=True)
    number: Mapped[str] = mapped_column(String(64), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    issue_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    amount_total_cents: Mapped[int] = mapped_column(Integer)
    erp_paid_cents: Mapped[int] = mapped_column(Integer, default=0)  # paid according to the ERP
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    status: Mapped[str] = mapped_column(String(16), default="open")  # open|paid|disputed|cancelled
    promise_to_pay_until: Mapped[date | None] = mapped_column(Date)
    customer: Mapped[Customer] = relationship(back_populates="invoices")
    payments: Mapped[list[Payment]] = relationship(back_populates="invoice")
    case: Mapped[DunningCase | None] = relationship(back_populates="invoice")

    @property
    def matched_cents(self) -> int:
        return sum(p.amount_cents for p in self.payments)

    @property
    def outstanding_cents(self) -> int:
        return max(self.amount_total_cents - self.erp_paid_cents - self.matched_cents, 0)


class Payment(Base):
    """Incoming bank payment (bank feed) not yet reconciled in the ERP."""
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(64), unique=True)
    booking_date: Mapped[date] = mapped_column(Date)
    amount_cents: Mapped[int] = mapped_column(Integer)
    payer_name: Mapped[str | None] = mapped_column(String(200))
    reference: Mapped[str | None] = mapped_column(String(300))
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"))
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"))
    match_method: Mapped[str | None] = mapped_column(String(32))  # reference|customer_amount|manual
    invoice: Mapped[Invoice | None] = relationship(back_populates="payments")


class DunningCase(Base):
    __tablename__ = "dunning_cases"
    __table_args__ = (UniqueConstraint("invoice_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    level: Mapped[int] = mapped_column(Integer, default=0)  # highest level SENT
    last_sent_on: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active|closed|escalated
    invoice: Mapped[Invoice] = relationship(back_populates="case")
    drafts: Mapped[list[ReminderDraft]] = relationship(back_populates="case", order_by="ReminderDraft.id")


class ReminderDraft(Base):
    __tablename__ = "reminder_drafts"
    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("dunning_cases.id"))
    level: Mapped[int] = mapped_column(Integer)
    subject: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    outstanding_cents: Mapped[int] = mapped_column(Integer)
    interest_cents: Mapped[int] = mapped_column(Integer, default=0)
    fees_cents: Mapped[int] = mapped_column(Integer, default=0)
    total_cents: Mapped[int] = mapped_column(Integer)
    claim_note: Mapped[str] = mapped_column(Text, default="")
    pay_by: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|sent|rejected|cancelled
    generated_by: Mapped[str] = mapped_column(String(64))  # template | claude:<model>
    agent_notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_by: Mapped[str | None] = mapped_column(String(100))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_note: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    case: Mapped[DunningCase] = relationship(back_populates="drafts")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actor: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(64))
    entity: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    detail: Mapped[str] = mapped_column(Text, default="")
