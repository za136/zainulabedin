"""Deterministic German letter templates: used when no LLM is configured and as the agent's fallback."""
from __future__ import annotations

from .facts import LetterFacts


def salutation(f: LetterFacts) -> str:
    return f"Guten Tag {f.contact_person}," if f.contact_person else "Sehr geehrte Damen und Herren,"


def _bank(f: LetterFacts) -> str:
    return (f"Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer {f.invoice_number} auf folgendes Konto:\n"
            f"IBAN: {f.company_iban}\nBIC: {f.company_bic}")


def _claim_table(f: LetterFacts) -> str:
    lines = [f"Offener Rechnungsbetrag: {f.eur(f.outstanding_cents)}"]
    if f.interest_cents:
        lines.append(f"Verzugszinsen: {f.eur(f.interest_cents)}")
    if f.fees_cents:
        lines.append(f"Pauschalen/Gebühren: {f.eur(f.fees_cents)}")
    lines.append(f"Gesamtforderung: {f.eur(f.total_cents)}")
    return "\n".join(lines)


def render(f: LetterFacts) -> tuple[str, str]:
    paid_note = ""
    if f.outstanding_cents < f.amount_total_cents:
        paid_note = (f" Vielen Dank für Ihre bisherige Zahlung von {f.eur(f.amount_total_cents - f.outstanding_cents)};"
                     f" es verbleibt ein offener Betrag von {f.eur(f.outstanding_cents)}.")
    sign = f"Mit freundlichen Grüßen\n\n{f.company_name}\nBuchhaltung\n{f.company_address}\n{f.company_email}"
    if f.level == 1:
        subject = f"Zahlungserinnerung zur Rechnung {f.invoice_number}"
        body = (f"{salutation(f)}\n\nsicher ist es Ihrer Aufmerksamkeit entgangen: Unsere Rechnung {f.invoice_number} "
                f"vom {f.issue_date} über {f.eur(f.amount_total_cents)} war am {f.due_date} fällig.{paid_note}\n\n"
                f"Wir bitten Sie, den offenen Betrag von {f.eur(f.outstanding_cents)} bis zum {f.pay_by} zu begleichen.\n\n"
                f"{_bank(f)}\n\nSollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte "
                f"als gegenstandslos.\n\n{sign}")
    elif f.level == 2:
        subject = f"1. Mahnung zur Rechnung {f.invoice_number}"
        body = (f"{salutation(f)}\n\nleider konnten wir trotz unserer Zahlungserinnerung bisher keinen vollständigen "
                f"Zahlungseingang zu unserer Rechnung {f.invoice_number} vom {f.issue_date} (fällig am {f.due_date}) "
                f"feststellen.{paid_note}\n\n{_claim_table(f)}\n\n{f.claim_note}\n\n"
                f"Bitte begleichen Sie die Gesamtforderung von {f.eur(f.total_cents)} bis zum {f.pay_by}.\n\n{_bank(f)}\n\n"
                f"Falls es Unklarheiten zur Rechnung gibt, melden Sie sich bitte kurz bei uns.\n\n{sign}")
    else:
        subject = f"Letzte Mahnung zur Rechnung {f.invoice_number}"
        body = (f"{salutation(f)}\n\ntrotz unserer bisherigen Schreiben ist unsere Rechnung {f.invoice_number} vom "
                f"{f.issue_date} (fällig am {f.due_date}) weiterhin nicht vollständig beglichen.{paid_note}\n\n"
                f"{_claim_table(f)}\n\n{f.claim_note}\n\n"
                f"Wir fordern Sie hiermit letztmalig auf, die Gesamtforderung von {f.eur(f.total_cents)} bis zum "
                f"{f.pay_by} zu zahlen. Sollte bis dahin kein Zahlungseingang erfolgen, behalten wir uns vor, ohne "
                f"weitere Ankündigung ein gerichtliches Mahnverfahren einzuleiten oder ein Inkassounternehmen zu "
                f"beauftragen.\n\n{_bank(f)}\n\n{sign}")
    return subject, body
