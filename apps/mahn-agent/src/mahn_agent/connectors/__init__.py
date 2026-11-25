"""ERP connectors. Every connector is read-only and returns plain records."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol


@dataclass
class ErpCustomer:
    erp_id: str
    name: str
    email: str | None
    country: str
    is_business: bool
    contact_person: str | None = None
    late_payment_count: int = 0


@dataclass
class ErpInvoice:
    erp_id: str
    number: str
    customer_erp_id: str
    issue_date: date
    due_date: date
    amount_total_cents: int
    paid_cents: int
    currency: str = "EUR"
    disputed: bool = False


@dataclass
class ErpPayment:
    external_id: str
    booking_date: date
    amount_cents: int
    payer_name: str | None
    reference: str | None
    customer_erp_id: str | None = None


class Connector(Protocol):
    name: str

    def customers(self) -> list[ErpCustomer]: ...
    def open_invoices(self) -> list[ErpInvoice]: ...
    def unreconciled_payments(self) -> list[ErpPayment]: ...


def get_connector(settings) -> Connector:
    if settings.erp == "demo":
        from .demo import DemoConnector
        return DemoConnector(settings.demo_erp_file)
    if settings.erp == "odoo":
        from .odoo import OdooConnector
        return OdooConnector(settings.odoo_url, settings.odoo_db, settings.odoo_user, settings.odoo_api_key)
    if settings.erp == "erpnext":
        from .erpnext import ERPNextConnector
        return ERPNextConnector(settings.erpnext_url, settings.erpnext_api_key, settings.erpnext_api_secret)
    raise ValueError(f"Unknown MAHN_ERP={settings.erp!r} (demo|odoo|erpnext)")
