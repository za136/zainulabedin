"""Odoo (Community/Enterprise) via the external XML-RPC API, read-only.

Reads posted customer invoices (account.move, move_type=out_invoice) that are not fully paid.
Odoo reconciles bank payments itself, so `amount_residual` is authoritative and no separate
bank feed is read. Tested against the documented API shape only; see docs/open-questions.md.
"""
from __future__ import annotations

import xmlrpc.client
from datetime import date

from ..money import to_cents
from . import ErpCustomer, ErpInvoice, ErpPayment


class OdooConnector:
    name = "odoo"

    def __init__(self, url: str, db: str, user: str, api_key: str):
        if not all([url, db, user, api_key]):
            raise ValueError("ODOO_URL, ODOO_DB, ODOO_USER and ODOO_API_KEY are required")
        self.url, self.db, self.key = url.rstrip("/"), db, api_key
        common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")
        self.uid = common.authenticate(db, user, api_key, {})
        if not self.uid:
            raise PermissionError("Odoo authentication failed")
        self.models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")

    def _search_read(self, model: str, domain: list, fields: list[str]) -> list[dict]:
        return self.models.execute_kw(self.db, self.uid, self.key, model, "search_read", [domain],
                                      {"fields": fields, "limit": 5000})

    def open_invoices(self) -> list[ErpInvoice]:
        rows = self._search_read(
            "account.move",
            [("move_type", "=", "out_invoice"), ("state", "=", "posted"),
             ("payment_state", "in", ["not_paid", "partial"])],
            ["name", "partner_id", "invoice_date", "invoice_date_due", "amount_total", "amount_residual",
             "currency_id"])
        return [ErpInvoice(
            erp_id=f"odoo:{r['id']}", number=r["name"], customer_erp_id=f"odoo:{r['partner_id'][0]}",
            issue_date=date.fromisoformat(r["invoice_date"]), due_date=date.fromisoformat(r["invoice_date_due"]),
            amount_total_cents=to_cents(r["amount_total"]),
            paid_cents=to_cents(r["amount_total"]) - to_cents(r["amount_residual"]),
            currency=r["currency_id"][1] if r.get("currency_id") else "EUR") for r in rows]

    def customers(self) -> list[ErpCustomer]:
        partner_ids = sorted({int(i.customer_erp_id.split(":")[1]) for i in self.open_invoices()})
        rows = self._search_read("res.partner", [("id", "in", partner_ids)],
                                 ["name", "email", "country_id", "is_company"])
        return [ErpCustomer(erp_id=f"odoo:{r['id']}", name=r["name"], email=r.get("email") or None,
                            country=_country_code(r.get("country_id")), is_business=bool(r.get("is_company")))
                for r in rows]

    def unreconciled_payments(self) -> list[ErpPayment]:
        return []


def _country_code(country) -> str:
    # country_id is [id, "Germany"]; map common DACH names, default DE
    name = country[1] if country else ""
    return {"Germany": "DE", "Deutschland": "DE", "Austria": "AT", "Österreich": "AT",
            "Switzerland": "CH", "Schweiz": "CH"}.get(name, "DE")
