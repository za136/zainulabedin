"""Deterministic demo data: a German wholesaler's receivables, relative to today."""
from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

CUSTOMERS = [
    ("Müller Metallbau GmbH", "Frau Petra Müller", "DE", True),
    ("Schneider Elektrotechnik KG", "Herr Jonas Schneider", "DE", True),
    ("Bäckerei Fischer", "Herr Lukas Fischer", "DE", True),
    ("Weber & Söhne Holzhandel GmbH", None, "DE", True),
    ("Alpenblick Hotel GmbH", "Frau Anna Gruber", "AT", True),
    ("Café Hofer OG", "Herr Martin Hofer", "AT", True),
    ("Zürcher Feinmechanik AG", "Herr Reto Keller", "CH", True),
    ("Becker Logistik GmbH", "Frau Sabine Becker", "DE", True),
    ("Praxis Dr. Wagner", "Frau Dr. Julia Wagner", "DE", True),
    ("Hoffmann Gartenbau", "Herr Tim Hoffmann", "DE", True),
    ("Klaus Schulz", None, "DE", False),
    ("Maria Koch", None, "DE", False),
    ("Lehmann IT-Service UG", "Herr Felix Lehmann", "DE", True),
    ("Innsbrucker Sportshop GmbH", None, "AT", True),
    ("Basler Druckerei AG", "Frau Nina Meier", "CH", True),
]


def build(today: date | None = None, seed: int = 42) -> dict:
    today = today or date.today()
    rnd = random.Random(seed)
    customers, invoices, payments = [], [], []
    n = 1000
    for idx, (name, contact, country, business) in enumerate(CUSTOMERS, 1):
        cid = f"demo:C{idx:03d}"
        import unicodedata
        first = name.lower().split()[0].replace("ü", "ue").replace("ä", "ae").replace("ö", "oe")
        slug = "".join(ch for ch in unicodedata.normalize("NFKD", first) if ch.isalnum() and ch.isascii())
        customers.append({"erp_id": cid, "name": name, "email": f"buchhaltung@{slug}.example",
                          "country": country, "is_business": business, "contact_person": contact,
                          "late_payment_count": rnd.randint(0, 4)})
        for _ in range(rnd.randint(2, 6)):
            n += 1
            days_overdue = rnd.choice([-20, -5, 3, 9, 15, 24, 30, 38, 45, 62, 95])
            due = today - timedelta(days=days_overdue)
            total = rnd.choice([18900, 45000, 89950, 124000, 250000, 312075, 780000, 1549000])
            inv_no = f"RE-{today.year}-{n:05d}"
            paid = 0
            if rnd.random() < 0.12:
                paid = total // 2  # partial payment already booked in the ERP
            invoices.append({"erp_id": f"demo:{inv_no}", "number": inv_no, "customer_erp_id": cid,
                             "issue_date": (due - timedelta(days=14)).isoformat(), "due_date": due.isoformat(),
                             "amount_total_cents": total, "paid_cents": paid, "currency": "EUR",
                             "disputed": rnd.random() < 0.05})
    # bank feed: some payments with clean references, one without reference, one partial
    overdue = [i for i in invoices if date.fromisoformat(i["due_date"]) < today and not i["paid_cents"]]
    for k, inv in enumerate(rnd.sample(overdue, 4)):
        payments.append({"external_id": f"BANK-{k + 1:04d}", "booking_date": (today - timedelta(days=1)).isoformat(),
                         "amount_cents": inv["amount_total_cents"], "payer_name": None,
                         "reference": f"Rechnung {inv['number']} vielen Dank", "customer_erp_id": None})
    payments.append({"external_id": "BANK-0099", "booking_date": today.isoformat(), "amount_cents": 33333,
                     "payer_name": "Unbekannter Zahler", "reference": "Zahlung", "customer_erp_id": None})
    return {"generated_for": today.isoformat(), "customers": customers, "invoices": invoices, "payments": payments}


def write(path: Path, today: date | None = None) -> dict:
    data = build(today)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return data
