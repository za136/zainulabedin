"""API contract. These models generate openapi.json, which is the contract for the website and app.
Request models forbid unknown fields so a client that sends invented fields fails loudly (422)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"

StreamSlug = Literal["software", "web", "apps", "studio", "deeptech"]
ProjectStatus = Literal["Concept", "PRD", "In development", "MVP", "Live", "Released"]
LeadStatus = Literal["new", "contacted", "won", "lost", "spam"]
SubscriberStatus = Literal["pending", "confirmed", "unsubscribed"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ---------- content (mirrors apps/zainlabs/content/src/types.ts) ----------
class ProcessStep(BaseModel):
    title: str
    text: str


class Site(BaseModel):
    name: str
    claim: str
    intro: str
    location: str
    email: str
    process: list[ProcessStep]


class Stream(BaseModel):
    slug: StreamSlug
    code: str
    name: str
    tagline: str
    description: str
    capabilities: list[str]


class StreamWithCount(Stream):
    projectCount: int


class ProjectLink(BaseModel):
    label: str
    url: str


class Project(BaseModel):
    slug: str
    code: str | None = None
    title: str
    stream: StreamSlug
    status: ProjectStatus
    year: int
    summary: str
    description: list[str]
    highlights: list[str]
    stack: list[str]
    links: list[ProjectLink]
    featured: bool | None = None


class ContentBundle(BaseModel):
    version: Literal[1]
    site: Site
    streams: list[Stream]
    projects: list[Project]


class Health(BaseModel):
    status: Literal["ok"]
    version: str
    projects: int


# ---------- errors ----------
class ErrorResponse(BaseModel):
    error: str = Field(description="Human-readable message, safe to show to the user.")
    code: str = Field(description="Stable machine code: validation_error, not_found, rate_limited, unauthorized, admin_disabled.")
    fields: dict[str, str] | None = Field(default=None, description="Per-field messages for validation_error.")


# ---------- contact ----------
class ContactIn(Strict):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=200, pattern=EMAIL_PATTERN)
    company: str | None = Field(default=None, max_length=160)
    stream: StreamSlug
    project: str | None = Field(default=None, max_length=80, description="Project slug the request is about (optional).")
    message: str = Field(min_length=10, max_length=4000)
    consent: bool = Field(description="Must be true: user agreed to the privacy notice.")
    source: Literal["web", "app"] = "web"
    website: str = Field(default="", max_length=200, description="Honeypot. Must stay empty; render it hidden.")


class ContactOut(BaseModel):
    ok: Literal[True]
    id: str


# ---------- newsletter ----------
class NewsletterIn(Strict):
    email: str = Field(max_length=200, pattern=EMAIL_PATTERN)
    consent: bool = Field(description="Must be true.")
    source: Literal["web", "app"] = "web"
    website: str = Field(default="", max_length=200, description="Honeypot. Must stay empty.")


class NewsletterOut(BaseModel):
    ok: Literal[True]
    status: Literal["pending"] = Field(description="Always 'pending': the user must click the link in the email (double opt-in).")


# ---------- admin ----------
class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    name: str
    email: str
    company: str | None
    stream: str
    project: str | None
    message: str
    source: str
    status: LeadStatus
    note: str | None


class LeadPatch(Strict):
    status: LeadStatus | None = None
    note: str | None = Field(default=None, max_length=2000)


class SubscriberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    status: SubscriberStatus
    source: str
    created_at: datetime
    confirmed_at: datetime | None
    unsubscribed_at: datetime | None


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    at: datetime
    actor: str
    action: str
    entity: str
    entity_id: str | None
    detail: str


class PurgeOut(BaseModel):
    deleted_leads: int
    deleted_pending_subscribers: int
