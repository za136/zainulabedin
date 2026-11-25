from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select

from .. import services
from ..errors import APIError
from ..models import AuditEvent, Lead, Subscriber
from ..schemas import AuditOut, ErrorResponse, LeadOut, LeadPatch, LeadStatus, PurgeOut, SubscriberOut, SubscriberStatus
from .deps import Ctx, ctx, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)],
                   responses={401: {"model": ErrorResponse}, 503: {"model": ErrorResponse}})


@router.get("/leads", response_model=list[LeadOut])
def leads(status: LeadStatus | None = None, limit: int = Query(100, ge=1, le=1000), c: Ctx = Depends(ctx)):
    with c.session() as s:
        q = select(Lead).order_by(Lead.created_at.desc()).limit(limit)
        if status:
            q = q.where(Lead.status == status)
        return list(s.scalars(q))


@router.patch("/leads/{lead_id}", response_model=LeadOut, responses={404: {"model": ErrorResponse}})
def update_lead(lead_id: str, patch: LeadPatch, c: Ctx = Depends(ctx)):
    with c.session() as s:
        lead = s.get(Lead, lead_id)
        if lead is None:
            raise APIError(404, "not_found", "Lead not found.")
        if patch.status:
            lead.status = patch.status
        if patch.note is not None:
            lead.note = patch.note
        services.audit(s, "admin", "lead_updated", "lead", lead.id, f"status={lead.status}")
        s.commit()
        return lead


@router.delete("/leads/{lead_id}", status_code=204, responses={404: {"model": ErrorResponse}},
               summary="Erase a lead (GDPR Art. 17)")
def delete_lead(lead_id: str, c: Ctx = Depends(ctx)):
    with c.session() as s:
        lead = s.get(Lead, lead_id)
        if lead is None:
            raise APIError(404, "not_found", "Lead not found.")
        s.delete(lead)
        services.audit(s, "admin", "lead_deleted", "lead", lead_id)
        s.commit()
    return Response(status_code=204)


@router.get("/subscribers", response_model=list[SubscriberOut])
def subscribers(status: SubscriberStatus | None = None, c: Ctx = Depends(ctx)):
    with c.session() as s:
        q = select(Subscriber).order_by(Subscriber.created_at.desc())
        if status:
            q = q.where(Subscriber.status == status)
        return list(s.scalars(q))


@router.delete("/subscribers/{sub_id}", status_code=204, responses={404: {"model": ErrorResponse}},
               summary="Erase a subscriber (GDPR Art. 17)")
def delete_subscriber(sub_id: str, c: Ctx = Depends(ctx)):
    with c.session() as s:
        sub = s.get(Subscriber, sub_id)
        if sub is None:
            raise APIError(404, "not_found", "Subscriber not found.")
        s.delete(sub)
        services.audit(s, "admin", "subscriber_deleted", "subscriber", sub_id)
        s.commit()
    return Response(status_code=204)


@router.post("/purge", response_model=PurgeOut, summary="Apply the retention policy now")
def purge(c: Ctx = Depends(ctx)):
    with c.session() as s:
        leads, pending = services.purge(s, c.settings.retention_days)
    return {"deleted_leads": leads, "deleted_pending_subscribers": pending}


@router.get("/audit", response_model=list[AuditOut])
def audit_log(limit: int = Query(200, ge=1, le=2000), c: Ctx = Depends(ctx)):
    with c.session() as s:
        return list(s.scalars(select(AuditEvent).order_by(AuditEvent.at.desc()).limit(limit)))
