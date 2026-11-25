from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Any

from fastapi import Request

from ..content import ContentStore
from ..errors import APIError
from ..ratelimit import RateLimiter


@dataclass
class Ctx:
    settings: Any
    session: Any  # sessionmaker
    content: ContentStore
    mailer: Any
    limiter: RateLimiter


def ctx(request: Request) -> Ctx:
    return request.app.state.ctx


def client_key(request: Request) -> str:
    if request.app.state.ctx.settings.trust_proxy:
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limited(request: Request) -> None:
    wait = request.app.state.ctx.limiter.check(client_key(request))
    if wait is not None:
        raise APIError(429, "rate_limited", "Too many requests. Please try again later.",
                       headers={"Retry-After": str(wait)})


def require_admin(request: Request) -> None:
    token = request.app.state.ctx.settings.admin_token
    if not token:
        raise APIError(503, "admin_disabled", "Admin API is disabled: set ZL_ADMIN_TOKEN.")
    given = request.headers.get("authorization", "")
    if not secrets.compare_digest(given, f"Bearer {token}"):
        raise APIError(401, "unauthorized", "Missing or wrong admin token.")
