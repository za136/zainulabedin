"""Business logic shared by routes and CLI."""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .mailer import message
from .models import AuditEvent, Lead, Subscriber

log = logging.getLogger(__name__)
CONFIRM_TTL = timedelta(days=7)


def audit(s: Session, actor: str, action: str, entity: str, entity_id: str | None, detail: str = "") -> None:
    s.add(AuditEvent(actor=actor, action=action, entity=entity, entity_id=entity_id, detail=detail[:500]))


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def notify_lead(settings, mailer, lead: dict) -> None:
    """Side effects after a lead is stored. Never raises: a failing webhook must not lose the lead."""
    if settings.owner_email:
        try:
            body = "\n".join(f"{k}: {v}" for k, v in lead.items() if v)
            mailer.send(message(settings.mail_from, settings.owner_email, f"New lead: {lead['name']} ({lead['stream']})", body))
        except Exception:  # noqa: BLE001
            log.exception("lead notification mail failed")
    if settings.lead_webhook_url:
        try:
            httpx.post(settings.lead_webhook_url, json=lead, timeout=5).raise_for_status()
        except Exception:  # noqa: BLE001
            log.exception("lead webhook failed")


def subscribe(s: Session, settings, mailer, email: str, source: str) -> None:
    """Double opt-in. Same response whatever the current state, so emails cannot be enumerated."""
    email = email.lower()
    sub = s.scalar(select(Subscriber).where(Subscriber.email == email))
    now = datetime.now(timezone.utc)
    if sub and sub.status == "confirmed":
        audit(s, "public", "newsletter_repeat", "subscriber", sub.id)
        s.commit()
        return
    token = secrets.token_urlsafe(32)
    if sub is None:
        sub = Subscriber(email=email, source=source, token_hash=hash_token(token), consent_at=now)
        s.add(sub)
    else:
        sub.status, sub.token_hash, sub.consent_at, sub.unsubscribed_at = "pending", hash_token(token), now, None
    s.flush()
    confirm = f"{settings.api_url}/api/newsletter/confirm?token={token}"
    unsubscribe = f"{settings.api_url}/api/newsletter/unsubscribe?token={token}"
    body = ("Hello,\n\nplease confirm that you want to receive the ZAIN LABS newsletter:\n\n"
            f"{confirm}\n\nIf you did not request this, ignore this email; you will not be subscribed.\n"
            f"The link is valid for 7 days. You can unsubscribe at any time:\n{unsubscribe}\n\nZAIN LABS\n")
    mailer.send(message(settings.mail_from, email, "Please confirm your ZAIN LABS newsletter subscription", body))
    sub.confirmation_sent = True
    audit(s, "public", "newsletter_pending", "subscriber", sub.id, source)
    s.commit()


def confirm(s: Session, token: str) -> bool:
    sub = s.scalar(select(Subscriber).where(Subscriber.token_hash == hash_token(token)))
    if sub is None or sub.status == "unsubscribed":
        return False
    if sub.status == "pending" and datetime.now(timezone.utc) - as_utc(sub.consent_at) > CONFIRM_TTL:
        return False
    if sub.status == "pending":
        sub.status, sub.confirmed_at = "confirmed", datetime.now(timezone.utc)
        audit(s, "public", "newsletter_confirmed", "subscriber", sub.id)
        s.commit()
    return True


def unsubscribe(s: Session, token: str) -> bool:
    sub = s.scalar(select(Subscriber).where(Subscriber.token_hash == hash_token(token)))
    if sub is None:
        return False
    if sub.status != "unsubscribed":
        sub.status, sub.unsubscribed_at = "unsubscribed", datetime.now(timezone.utc)
        audit(s, "public", "newsletter_unsubscribed", "subscriber", sub.id)
        s.commit()
    return True


def purge(s: Session, retention_days: int) -> tuple[int, int]:
    """GDPR storage limitation: delete old leads and stale unconfirmed subscribers."""
    now = datetime.now(timezone.utc)
    leads = s.execute(delete(Lead).where(Lead.created_at < now - timedelta(days=retention_days))).rowcount or 0
    pending = s.execute(delete(Subscriber).where(Subscriber.status == "pending",
                                                 Subscriber.consent_at < now - CONFIRM_TTL)).rowcount or 0
    audit(s, "system", "purge", "all", None, f"leads={leads} pending_subscribers={pending}")
    s.commit()
    return leads, pending
