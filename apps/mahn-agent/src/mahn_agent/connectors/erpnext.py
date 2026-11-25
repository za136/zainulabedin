"""ERPNext / Frappe via the REST API (token auth), read-only.

Sales Invoices with docstatus=1 and outstanding_amount > 0. ERPNext reconciles payments
(Payment Entry) itself, so outstanding_amount is authoritative.
"""
from __future__ import annotations

import json
from datetime import date

import httpx

from ..money import to_cents
from . import ErpCustomer, ErpInvoice, ErpPayment


class ERPNextConnector:
    name = "erpnext"

    def __init__(self, url: str, api_key: str, api_secret: str, client: httpx.Client | None = None):
        if not all([url, api_key, api_secret]):
            raise ValueError("ERPNEXT_URL, ERPNEXT_API_KEY and ERPNEXT_API_SECRET are required")
        self.client = client or httpx.Client(base_url=url.rstrip("/"), timeout=30,
                                             headers={"Authorization": f"token {api_key}:{api_secret}"})

    def _list(self, doctype: str, fields: list[str], filters: list) -> list[dict]:
        r = self.client.get(f"/api/resource/{doctype}", params={
            "fields": json.dumps(fields), "filters": json.dumps(filters), "limit_page_length": 0})
        r.raise_for_status()
        return r.json()["data"]

    def open_invoices(self) -> list[ErpInvoice]:
        rows = self._list("Sales Invoice",
                          ["name", "customer", "posting_date", "due_date", "grand_total", "outstanding_amount",
                           "currency"],
                          [["docstatus", "=", 1], ["outstanding_amount", ">", 0]])
        return [ErpInvoice(
            erp_id=f"erpnext:{r['name']}", number=r["name"], customer_erp_id=f"erpnext:{r['customer']}",
            issue_date=date.fromisoformat(r["posting_date"]), due_date=date.fromisoformat(r["due_date"]),
            amount_total_cents=to_cents(r["grand_total"]),
            paid_cents=to_cents(r["grand_total"]) - to_cents(r["outstanding_amount"]),
            currency=r.get("currency") or "EUR") for r in rows]

    def customers(self) -> list[ErpCustomer]:
        rows = self._list("Customer", ["name", "customer_name", "customer_type", "email_id", "territory"], [])
        return [ErpCustomer(erp_id=f"erpnext:{r['name']}", name=r.get("customer_name") or r["name"],
                            email=r.get("email_id") or None,
                            country={"Germany": "DE", "Austria": "AT", "Switzerland": "CH"}.get(r.get("territory"), "DE"),
                            is_business=r.get("customer_type") == "Company") for r in rows]

    def unreconciled_payments(self) -> list[ErpPayment]:
        return []
