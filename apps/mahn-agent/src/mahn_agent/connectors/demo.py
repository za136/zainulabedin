"""Demo ERP backed by a JSON file (created by `mahn-agent seed`). Simulates an ERP + bank feed."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from . import ErpCustomer, ErpInvoice, ErpPayment


class DemoConnector:
    name = "demo"

    def __init__(self, path: Path):
        self.path = Path(path)
        if not self.path.exists():
            raise FileNotFoundError(f"{self.path} missing: run `mahn-agent seed` first")

    def _data(self) -> dict:
        if not self.path.exists():
            raise FileNotFoundError(f"{self.path} missing: run `mahn-agent seed` first")
        return json.loads(self.path.read_text())

    def customers(self) -> list[ErpCustomer]:
        return [ErpCustomer(**c) for c in self._data()["customers"]]

    def open_invoices(self) -> list[ErpInvoice]:
        out = []
        for i in self._data()["invoices"]:
            if i["amount_total_cents"] - i["paid_cents"] > 0:
                out.append(ErpInvoice(**{**i, "issue_date": date.fromisoformat(i["issue_date"]),
                                         "due_date": date.fromisoformat(i["due_date"])}))
        return out

    def unreconciled_payments(self) -> list[ErpPayment]:
        return [ErpPayment(**{**p, "booking_date": date.fromisoformat(p["booking_date"])})
                for p in self._data()["payments"]]

    # demo-only helpers
    def add_payment(self, payment: dict) -> None:
        data = self._data()
        data["payments"].append(payment)
        self.path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
