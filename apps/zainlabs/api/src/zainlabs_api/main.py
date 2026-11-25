"""FastAPI app factory. Run: `zainlabs-api serve` (default port 8100). OpenAPI: /docs, /openapi.json."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__, errors
from .config import Settings
from .content import ContentStore
from .db import make_sessionmaker
from .mailer import get_mailer
from .ratelimit import RateLimiter
from .routes import admin, public
from .routes.deps import Ctx

DESCRIPTION = """Backend for the ZAIN LABS website and iOS/Android app.

* **Content** is read-only and generated from `apps/zainlabs/content` (`npm run export`).
* **Errors** always have the shape `{"error": str, "code": str, "fields"?: {field: message}}`.
* **Request bodies reject unknown fields** (422 `validation_error`).
* **Admin** endpoints need `Authorization: Bearer <ZL_ADMIN_TOKEN>`.
"""


def create_app(settings: Settings | None = None, *, session_factory=None, mailer=None, limiter=None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="ZAIN LABS API", version=__version__, description=DESCRIPTION)
    n, window = settings.rate_limit_pair
    app.state.ctx = Ctx(
        settings=settings,
        session=session_factory or make_sessionmaker(settings.database_url),
        content=ContentStore(settings.content_file),
        mailer=mailer or get_mailer(settings),
        limiter=limiter or RateLimiter(n, window),
    )
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET", "POST", "OPTIONS"],
                       allow_headers=["Content-Type", "If-None-Match"], expose_headers=["ETag", "Retry-After"])
    errors.install(app)
    app.include_router(public.router)
    app.include_router(admin.router)
    return app
