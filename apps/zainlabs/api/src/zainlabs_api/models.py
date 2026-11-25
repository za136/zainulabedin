"""Data model. Data minimisation (GDPR): no IP addresses, no user agents, no tracking IDs are stored."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class Lead(Base):
    """A contact request from the website or the app."""
    __tablename__ = "leads"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200), index=True)
    company: Mapped[str | None] = mapped_column(String(160))
    stream: Mapped[str] = mapped_column(String(40))
    project: Mapped[str | None] = mapped_column(String(80))
    message: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(10))  # web | app
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(16), default="new")  # new | contacted | won | lost | spam
    note: Mapped[str | None] = mapped_column(Text)


class Subscriber(Base):
    """Newsletter subscriber with double opt-in. Tokens are stored as SHA-256 hashes only."""
    __tablename__ = "subscribers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | confirmed | unsubscribed
    source: Mapped[str] = mapped_column(String(10), default="web")
    token_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unsubscribed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmation_sent: Mapped[bool] = mapped_column(Boolean, default=False)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actor: Mapped[str] = mapped_column(String(40))  # public | admin | system
    action: Mapped[str] = mapped_column(String(60))
    entity: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(36))
    detail: Mapped[str] = mapped_column(Text, default="")
