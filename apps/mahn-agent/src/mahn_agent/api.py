"""FastAPI app: JSON API (/api/v1, OpenAPI at /docs) and German web UI for the accounting team."""
from __future__ import annotations

import base64
import secrets
from datetime import date
from pathlib import Path
from urllib.parse import quote

from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy import select

from .agent import drafter
from .config import Settings, get_settings
from .connectors import get_connector
from .db import make_engine, make_sessionmaker
from .mailer import get_mailer
from .models import AuditEvent, DunningCase, Invoice, Payment, ReminderDraft
from .money import fmt_date, fmt_eur
from .policy import LEVEL_NAMES
from .service import DunningService

WEB = Path(__file__).parent / "web"


class ApproveIn(BaseModel):
    approver: str
    subject: str | None = None
    body: str | None = None


class RejectIn(BaseModel):
    approver: str
    reason: str


class AssignIn(BaseModel):
    invoice_id: int
    actor: str = "api"


def create_app(settings: Settings | None = None, *, session_factory=None, connector=None, mailer=None,
               llm_client=None, use_llm_auto: bool = True) -> FastAPI:
    settings = settings or get_settings()
    session_factory = session_factory or make_sessionmaker(make_engine(settings.database_url))
    client = llm_client if llm_client is not None else (drafter.make_client(settings.llm) if use_llm_auto else None)
    state = {"connector": connector, "mailer": mailer or get_mailer(settings)}

    app = FastAPI(title="Mahn-Agent", version="0.1.0",
                  description="Agentic dunning for DACH receivables with human approval.")
    app.mount("/static", StaticFiles(directory=WEB / "static"), name="static")
    tpl = Jinja2Templates(directory=WEB / "templates")
    tpl.env.filters["eur"] = fmt_eur
    tpl.env.filters["d"] = lambda v: fmt_date(v) if v else "–"
    tpl.env.globals.update(LEVEL_NAMES=LEVEL_NAMES, company=settings.company_name,
                           llm_mode=("Claude-Agent aktiv" if client else "Vorlagen-Modus (kein LLM)"),
                           erp=settings.erp)

    if settings.basic_auth:
        expected = "Basic " + base64.b64encode(settings.basic_auth.encode()).decode()

        @app.middleware("http")
        async def basic_auth(request: Request, call_next):
            if request.url.path != "/api/v1/health" and not secrets.compare_digest(
                    request.headers.get("authorization", ""), expected):
                return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="Mahn-Agent"'})
            return await call_next(request)

    def service():
        s = session_factory()
        try:
            conn = state["connector"]
            if conn is None:
                try:
                    conn = get_connector(settings)
                except (ValueError, FileNotFoundError, PermissionError, OSError):
                    conn = None
            yield DunningService(s, settings, connector=conn, mailer=state["mailer"], llm_client=client)
        finally:
            s.close()

    # ---------------- JSON API ----------------
    @app.get("/api/v1/health")
    def health():
        return {"status": "ok", "erp": settings.erp, "llm": bool(client)}

    @app.get("/api/v1/receivables/summary")
    def api_summary(svc: DunningService = Depends(service)):
        return svc.summary()

    @app.post("/api/v1/runs")
    def api_run(svc: DunningService = Depends(service)):
        if svc.connector is None:
            raise HTTPException(503, "ERP connector not configured (run `mahn-agent seed` for demo data)")
        return svc.run(actor="api").as_dict()

    @app.get("/api/v1/drafts")
    def api_drafts(status: str = "pending", svc: DunningService = Depends(service)):
        rows = svc.s.scalars(select(ReminderDraft).where(ReminderDraft.status == status).order_by(ReminderDraft.id))
        return [_draft_json(d) for d in rows]

    @app.post("/api/v1/drafts/{draft_id}/approve")
    def api_approve(draft_id: int, payload: ApproveIn, svc: DunningService = Depends(service)):
        try:
            return _draft_json(svc.approve_and_send(draft_id, payload.approver, payload.subject, payload.body))
        except LookupError as e:
            raise HTTPException(404, str(e))
        except ValueError as e:
            raise HTTPException(409, str(e))

    @app.post("/api/v1/drafts/{draft_id}/reject")
    def api_reject(draft_id: int, payload: RejectIn, svc: DunningService = Depends(service)):
        try:
            return _draft_json(svc.reject(draft_id, payload.approver, payload.reason))
        except ValueError as e:
            raise HTTPException(409, str(e))

    @app.get("/api/v1/cases")
    def api_cases(svc: DunningService = Depends(service)):
        return [{"id": c.id, "invoice": c.invoice.number, "customer": c.invoice.customer.name, "level": c.level,
                 "status": c.status, "outstanding_cents": c.invoice.outstanding_cents,
                 "last_sent_on": c.last_sent_on} for c in svc.s.scalars(select(DunningCase))]

    @app.post("/api/v1/payments/{payment_id}/assign")
    def api_assign(payment_id: int, payload: AssignIn, svc: DunningService = Depends(service)):
        try:
            svc.assign_payment(payment_id, payload.invoice_id, payload.actor)
        except LookupError as e:
            raise HTTPException(404, str(e))
        return {"ok": True}

    # ---------------- Web UI ----------------
    def page(request: Request, name: str, **ctx):
        return tpl.TemplateResponse(request, name, {"msg": request.query_params.get("msg"),
                                                    "err": request.query_params.get("err"), **ctx})

    def back(url: str, msg: str = "", err: str = "") -> RedirectResponse:
        q = f"?msg={quote(msg)}" if msg else f"?err={quote(err)}" if err else ""
        return RedirectResponse(url + q, status_code=303)

    @app.get("/", response_class=HTMLResponse)
    def dashboard(request: Request, svc: DunningService = Depends(service)):
        summary = svc.summary()
        max_bucket = max(summary["aging"].values()) or 1
        return page(request, "dashboard.html", s=summary, max_bucket=max_bucket)

    @app.post("/mahnlauf")
    def web_run(svc: DunningService = Depends(service)):
        if svc.connector is None:
            return back("/", err="Kein ERP verbunden. Für Demodaten: mahn-agent seed")
        r = svc.run(actor="web")
        return back("/freigaben", msg=f"Mahnlauf: {r.drafts_created} neue Entwürfe, {r.closed_cases} Fälle "
                                      f"geschlossen, {r.matched_payments} Zahlungen zugeordnet, "
                                      f"{r.escalated} eskaliert.")

    @app.get("/freigaben", response_class=HTMLResponse)
    def approvals(request: Request, svc: DunningService = Depends(service)):
        drafts = svc.s.scalars(select(ReminderDraft).where(ReminderDraft.status == "pending")
                               .order_by(ReminderDraft.level.desc(), ReminderDraft.id)).all()
        return page(request, "approvals.html", drafts=drafts)

    @app.post("/freigaben/{draft_id}/freigeben")
    def web_approve(draft_id: int, approver: str = Form(...), subject: str = Form(...), body: str = Form(...),
                    svc: DunningService = Depends(service)):
        try:
            d = svc.approve_and_send(draft_id, approver, subject, body.replace("\r\n", "\n"))
        except (LookupError, ValueError) as e:
            return back("/freigaben", err=str(e))
        return back("/freigaben", msg=f"{d.subject} versendet.")

    @app.post("/freigaben/{draft_id}/ablehnen")
    def web_reject(draft_id: int, approver: str = Form(...), reason: str = Form(...),
                   svc: DunningService = Depends(service)):
        try:
            svc.reject(draft_id, approver, reason)
        except ValueError as e:
            return back("/freigaben", err=str(e))
        return back("/freigaben", msg="Entwurf abgelehnt.")

    @app.get("/faelle", response_class=HTMLResponse)
    def cases(request: Request, svc: DunningService = Depends(service)):
        invoices = svc.s.scalars(select(Invoice).order_by(Invoice.due_date)).all()
        return page(request, "cases.html", invoices=invoices, today=date.today())

    @app.post("/faelle/{invoice_id}/zusage")
    def web_promise(invoice_id: int, until: date = Form(...), actor: str = Form("web"),
                    svc: DunningService = Depends(service)):
        svc.set_promise(invoice_id, until, actor)
        return back("/faelle", msg="Zahlungszusage gespeichert.")

    @app.get("/zahlungen", response_class=HTMLResponse)
    def payments(request: Request, svc: DunningService = Depends(service)):
        rows = svc.s.scalars(select(Payment).order_by(Payment.invoice_id.is_not(None), Payment.id.desc())).all()
        open_inv = [i for i in svc.s.scalars(select(Invoice).where(Invoice.status == "open")) if i.outstanding_cents > 0]
        return page(request, "payments.html", payments=rows, open_invoices=open_inv)

    @app.post("/zahlungen/{payment_id}/zuordnen")
    def web_assign(payment_id: int, invoice_id: int = Form(...), svc: DunningService = Depends(service)):
        try:
            svc.assign_payment(payment_id, invoice_id, "web")
        except LookupError as e:
            return back("/zahlungen", err=str(e))
        return back("/zahlungen", msg="Zahlung zugeordnet.")

    @app.get("/audit", response_class=HTMLResponse)
    def audit_log(request: Request, svc: DunningService = Depends(service)):
        events = svc.s.scalars(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(300)).all()
        return page(request, "audit.html", events=events)

    @app.exception_handler(404)
    async def not_found(request: Request, exc):
        if request.url.path.startswith("/api/"):
            return JSONResponse({"detail": getattr(exc, "detail", "Not found")}, status_code=404)
        return HTMLResponse("<h1>Nicht gefunden</h1><a href='/'>Zurück</a>", status_code=404)

    return app


def _draft_json(d: ReminderDraft) -> dict:
    inv = d.case.invoice
    return {"id": d.id, "status": d.status, "level": d.level, "level_name": LEVEL_NAMES[d.level],
            "invoice": inv.number, "customer": inv.customer.name, "to": inv.customer.email,
            "subject": d.subject, "body": d.body, "outstanding_cents": d.outstanding_cents,
            "interest_cents": d.interest_cents, "fees_cents": d.fees_cents, "total_cents": d.total_cents,
            "claim_note": d.claim_note, "pay_by": d.pay_by.isoformat(), "generated_by": d.generated_by,
            "agent_notes": d.agent_notes, "decided_by": d.decided_by, "decision_note": d.decision_note}
