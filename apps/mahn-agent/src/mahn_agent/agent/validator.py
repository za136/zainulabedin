"""Guardrails every draft must pass before a human even sees it (LLM output or template)."""
from __future__ import annotations

import re

from ..money import to_cents
from .facts import LetterFacts

AMOUNT_RE = re.compile(r"(?<![\d.,])\d{1,3}(?:\.\d{3})*,\d{2}(?![\d,])(?!\s*%)")
IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b")
ESCALATION_WORDS = ("inkasso", "mahnbescheid", "gerichtlich", "klage", "anwalt", "rechtsanwalt", "schufa")
THREAT_WORDS = ("polizei", "strafanzeige", "haft", "pfändung", "schufa")


def validate(f: LetterFacts, subject: str, body: str) -> list[str]:
    errors: list[str] = []
    text = f"{subject}\n{body}"
    low = text.lower()
    if f.invoice_number not in text:
        errors.append(f"Rechnungsnummer {f.invoice_number} fehlt.")
    if f.eur(f.outstanding_cents).split(" ")[0] not in body:
        errors.append(f"Offener Betrag {f.eur(f.outstanding_cents)} fehlt.")
    if f.level >= 2 and f.total_cents != f.outstanding_cents and f.eur(f.total_cents).split(" ")[0] not in body:
        errors.append(f"Gesamtforderung {f.eur(f.total_cents)} fehlt.")
    if f.pay_by not in body:
        errors.append(f"Zahlungsfrist {f.pay_by} fehlt.")
    allowed = f.allowed_amounts()
    for amount in AMOUNT_RE.findall(body):
        if to_cents(amount.replace(".", "").replace(",", ".")) not in allowed:
            errors.append(f"Betrag {amount} ist nicht durch die Fakten gedeckt (keine eigenen Berechnungen).")
    own_iban = f.company_iban.replace(" ", "")
    for iban in IBAN_RE.findall(body):
        if iban.replace(" ", "") != own_iban:
            errors.append(f"Fremde IBAN {iban} im Text.")
    if f.level < 3 and any(w in low for w in ESCALATION_WORDS):
        errors.append("Eskalationsandrohung (Inkasso/Gericht) ist erst in der letzten Mahnung erlaubt.")
    if any(w in low for w in THREAT_WORDS):
        errors.append("Unzulässige Drohung (z. B. Schufa, Strafanzeige, Pfändung).")
    if not re.search(r"^(sehr geehrte|guten tag|hallo)", body.strip().lower()):
        errors.append("Anrede fehlt (z. B. 'Sehr geehrte Damen und Herren,').")
    if re.search(r"\[[^\]]*\]|\{\{|\}\}|<[^>]+>|\bTODO\b|\bXXX\b", text):
        errors.append("Platzhalter oder Markup im Text.")
    if f.level == 1 and (f.interest_cents or f.fees_cents):
        errors.append("Stufe 1 darf keine Zinsen oder Gebühren enthalten.")
    if not 200 <= len(body) <= 4000:
        errors.append("Brieflänge außerhalb 200 bis 4000 Zeichen.")
    if len(subject) > 150:
        errors.append("Betreff zu lang.")
    return errors
