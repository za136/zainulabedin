"""Settings from environment variables (see .env.example). No secrets have defaults."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


@dataclass
class Settings:
    database_url: str = field(default_factory=lambda: _env("MAHN_DATABASE_URL", "sqlite:///./data/mahn_agent.db"))
    # ERP connector: demo | odoo | erpnext
    erp: str = field(default_factory=lambda: _env("MAHN_ERP", "demo"))
    demo_erp_file: Path = field(default_factory=lambda: Path(_env("MAHN_DEMO_ERP_FILE", "./data/demo_erp.json")))
    odoo_url: str = field(default_factory=lambda: _env("ODOO_URL"))
    odoo_db: str = field(default_factory=lambda: _env("ODOO_DB"))
    odoo_user: str = field(default_factory=lambda: _env("ODOO_USER"))
    odoo_api_key: str = field(default_factory=lambda: _env("ODOO_API_KEY"))
    erpnext_url: str = field(default_factory=lambda: _env("ERPNEXT_URL"))
    erpnext_api_key: str = field(default_factory=lambda: _env("ERPNEXT_API_KEY"))
    erpnext_api_secret: str = field(default_factory=lambda: _env("ERPNEXT_API_SECRET"))

    # Mail: outbox (writes .eml files, sends nothing) | smtp
    mail_backend: str = field(default_factory=lambda: _env("MAHN_MAIL_BACKEND", "outbox"))
    outbox_dir: Path = field(default_factory=lambda: Path(_env("MAHN_OUTBOX_DIR", "./data/outbox")))
    smtp_host: str = field(default_factory=lambda: _env("SMTP_HOST", "localhost"))
    smtp_port: int = field(default_factory=lambda: int(_env("SMTP_PORT", "1025")))
    smtp_user: str = field(default_factory=lambda: _env("SMTP_USER"))
    smtp_password: str = field(default_factory=lambda: _env("SMTP_PASSWORD"))
    smtp_starttls: bool = field(default_factory=lambda: _env("SMTP_STARTTLS", "0") == "1")

    # LLM: auto (Claude if credentials exist) | off
    llm: str = field(default_factory=lambda: _env("MAHN_LLM", "auto"))
    model: str = field(default_factory=lambda: _env("MAHN_MODEL", "claude-opus-5-5"))

    # Optional HTTP basic auth for UI + API, "user:password"
    basic_auth: str = field(default_factory=lambda: _env("MAHN_BASIC_AUTH"))

    # Creditor (your company) details used in letters
    company_name: str = field(default_factory=lambda: _env("MAHN_COMPANY_NAME", "Demo Handels GmbH"))
    company_address: str = field(default_factory=lambda: _env("MAHN_COMPANY_ADDRESS", "Musterstraße 1, 10115 Berlin"))
    company_email: str = field(default_factory=lambda: _env("MAHN_COMPANY_EMAIL", "buchhaltung@demo-handels.example"))
    company_iban: str = field(default_factory=lambda: _env("MAHN_COMPANY_IBAN", "DE89 3704 0044 0532 0130 00"))
    company_bic: str = field(default_factory=lambda: _env("MAHN_COMPANY_BIC", "COBADEFFXXX"))
    company_country: str = field(default_factory=lambda: _env("MAHN_COMPANY_COUNTRY", "DE"))


def get_settings() -> Settings:
    return Settings()
