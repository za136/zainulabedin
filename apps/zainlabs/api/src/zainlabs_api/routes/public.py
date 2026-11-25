from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse

from .. import services
from ..errors import APIError
from ..models import Lead
from ..schemas import (ContactIn, ContactOut, ContentBundle, ErrorResponse, Health, NewsletterIn, NewsletterOut,
                       Project, StreamSlug, StreamWithCount)
from .deps import Ctx, ctx, rate_limited

router = APIRouter(prefix="/api", tags=["public"])
E = {422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}}


@router.get("/health", response_model=Health, summary="Liveness and content check")
def health(c: Ctx = Depends(ctx)):
    from .. import __version__
    return {"status": "ok", "version": __version__, "projects": len(c.content.data()["projects"])}


@router.get("/content", response_model=ContentBundle, response_model_exclude_unset=True, summary="Everything: site copy, streams, projects",
            responses={304: {"description": "Not modified (ETag)"}})
def content(request: Request, response: Response, c: Ctx = Depends(ctx)):
    data = c.content.data()
    if request.headers.get("if-none-match") == c.content.etag:
        return Response(status_code=304, headers={"ETag": c.content.etag})
    response.headers["ETag"] = c.content.etag
    response.headers["Cache-Control"] = "public, max-age=300"
    return data


@router.get("/streams", response_model=list[StreamWithCount], response_model_exclude_unset=True, summary="Streams with project counts")
def streams(c: Ctx = Depends(ctx)):
    data = c.content.data()
    return [{**s, "projectCount": sum(p["stream"] == s["slug"] for p in data["projects"])} for s in data["streams"]]


@router.get("/projects", response_model=list[Project], response_model_exclude_unset=True, summary="Projects, optionally filtered by stream")
def projects(stream: StreamSlug | None = Query(default=None), c: Ctx = Depends(ctx)):
    items = c.content.data()["projects"]
    return [p for p in items if stream is None or p["stream"] == stream]


@router.get("/projects/{slug}", response_model=Project, response_model_exclude_unset=True, responses={404: {"model": ErrorResponse}})
def project(slug: str, c: Ctx = Depends(ctx)):
    for p in c.content.data()["projects"]:
        if p["slug"] == slug:
            return p
    raise APIError(404, "not_found", f"No project '{slug}'.")


@router.post("/contact", response_model=ContactOut, status_code=201, responses=E,
             summary="Store a contact request (website or app)")
def contact(payload: ContactIn, background: BackgroundTasks, c: Ctx = Depends(ctx), _=Depends(rate_limited)):
    if not payload.consent:
        raise APIError(422, "validation_error", "Please agree to the privacy notice.", {"consent": "Must be true."})
    if payload.project and payload.project not in c.content.project_slugs():
        raise APIError(422, "validation_error", "Unknown project.", {"project": "Unknown project slug."})
    if payload.website:  # honeypot: pretend success, store nothing
        return {"ok": True, "id": "00000000-0000-0000-0000-000000000000"}
    with c.session() as s:
        lead = Lead(name=payload.name, email=payload.email.lower(), company=payload.company or None,
                    stream=payload.stream, project=payload.project, message=payload.message, source=payload.source)
        s.add(lead)
        s.flush()
        services.audit(s, "public", "lead_created", "lead", lead.id, payload.source)
        s.commit()
        data = {"id": lead.id, "name": lead.name, "email": lead.email, "company": lead.company,
                "stream": lead.stream, "project": lead.project, "message": lead.message, "source": lead.source}
    background.add_task(services.notify_lead, c.settings, c.mailer, data)
    return {"ok": True, "id": data["id"]}


@router.post("/newsletter", response_model=NewsletterOut, status_code=202, responses=E,
             summary="Request a newsletter subscription (double opt-in email)")
def newsletter(payload: NewsletterIn, c: Ctx = Depends(ctx), _=Depends(rate_limited)):
    if not payload.consent:
        raise APIError(422, "validation_error", "Please agree to receive the newsletter.", {"consent": "Must be true."})
    if not payload.website:
        with c.session() as s:
            services.subscribe(s, c.settings, c.mailer, payload.email, payload.source)
    return {"ok": True, "status": "pending"}


@router.get("/newsletter/confirm", status_code=303, response_class=RedirectResponse,
            summary="Link from the confirmation email; redirects to {SITE_URL}/newsletter?status=confirmed|invalid")
def newsletter_confirm(token: str = Query(min_length=10, max_length=200), c: Ctx = Depends(ctx)):
    with c.session() as s:
        ok = services.confirm(s, token)
    return RedirectResponse(f"{c.settings.site_url}/newsletter?status={'confirmed' if ok else 'invalid'}", 303)


@router.get("/newsletter/unsubscribe", status_code=303, response_class=RedirectResponse,
            summary="Unsubscribe link; redirects to {SITE_URL}/newsletter?status=unsubscribed|invalid")
def newsletter_unsubscribe(token: str = Query(min_length=10, max_length=200), c: Ctx = Depends(ctx)):
    with c.session() as s:
        ok = services.unsubscribe(s, token)
    return RedirectResponse(f"{c.settings.site_url}/newsletter?status={'unsubscribed' if ok else 'invalid'}", 303)
