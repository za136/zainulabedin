from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve()
DEFAULT_CONTENT = HERE.parents[3] / "content" / "content.json"  # apps/zainlabs/content/content.json


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


@dataclass
class Settings:
    database_url: str = field(default_factory=lambda: _env("ZL_DATABASE_URL", "sqlite:///./data/zainlabs.db"))
    content_file: Path = field(default_factory=lambda: Path(_env("ZL_CONTENT_FILE", str(DEFAULT_CONTENT))))
    cors_origins: list[str] = field(default_factory=lambda: [
        o.strip() for o in _env("ZL_CORS_ORIGINS", "http://localhost:3000,http://localhost:8081").split(",") if o.strip()])
    site_url: str = field(default_factory=lambda: _env("ZL_SITE_URL", "http://localhost:3000").rstrip("/"))
    api_url: str = field(default_factory=lambda: _env("ZL_API_URL", "http://localhost:8100").rstrip("/"))
    admin_token: str = field(default_factory=lambda: _env("ZL_ADMIN_TOKEN"))
    mail_backend: str = field(default_factory=lambda: _env("ZL_MAIL_BACKEND", "outbox"))
    outbox_dir: Path = field(default_factory=lambda: Path(_env("ZL_OUTBOX_DIR", "./data/outbox")))
    mail_from: str = field(default_factory=lambda: _env("ZL_MAIL_FROM", "hello@zainlabs.example"))
    owner_email: str = field(default_factory=lambda: _env("ZL_OWNER_EMAIL"))
    smtp_host: str = field(default_factory=lambda: _env("ZL_SMTP_HOST", "localhost"))
    smtp_port: int = field(default_factory=lambda: int(_env("ZL_SMTP_PORT", "587")))
    smtp_user: str = field(default_factory=lambda: _env("ZL_SMTP_USER"))
    smtp_password: str = field(default_factory=lambda: _env("ZL_SMTP_PASSWORD"))
    smtp_starttls: bool = field(default_factory=lambda: _env("ZL_SMTP_STARTTLS", "1") == "1")
    lead_webhook_url: str = field(default_factory=lambda: _env("ZL_LEAD_WEBHOOK_URL"))
    retention_days: int = field(default_factory=lambda: int(_env("ZL_RETENTION_DAYS", "365")))
    rate_limit: str = field(default_factory=lambda: _env("ZL_RATE_LIMIT", "5/600"))
    trust_proxy: bool = field(default_factory=lambda: _env("ZL_TRUST_PROXY", "0") == "1")

    @property
    def rate_limit_pair(self) -> tuple[int, int]:
        n, window = self.rate_limit.split("/")
        return int(n), int(window)
