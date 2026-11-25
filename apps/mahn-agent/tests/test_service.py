from datetime import timedelta

import pytest
from sqlalchemy import select

from mahn_agent.models import DunningCase, Invoice, Payment, ReminderDraft

from .conftest import TODAY


def pending(s):
    return s.s.scalars(select(ReminderDraft).where(ReminderDraft.status == "pending")).all()


def test_first_run_creates_level1_drafts_and_matches_payments(env):
    svc = env["service"]()
    r = svc.run(today=TODAY)
    assert r.synced_invoices > 0 and r.drafts_created > 0
    assert r.matched_payments == 4 and r.unmatched_payments == 1
    assert all(d.level == 1 and d.interest_cents == 0 for d in pending(svc))
    # invoices paid via reference got closed and produced no drafts
    paid = svc.s.scalars(select(Invoice).where(Invoice.status == "paid")).all()
    assert len(paid) >= 4
    assert not any(d.case.invoice.status == "paid" for d in pending(svc))


def test_approve_sends_and_escalates_over_time(env):
    svc = env["service"]()
    svc.run(today=TODAY)
    for d in pending(svc):
        svc.approve_and_send(d.id, "Anna Buchhaltung", today=TODAY)
    outbox = list(env["settings"].outbox_dir.glob("*.eml"))
    assert outbox and "Zahlungserinnerung" in outbox[0].read_text()

    t2 = TODAY + timedelta(days=12)
    r2 = svc.run(today=t2)
    l2 = [d for d in pending(svc) if d.level == 2]
    assert len(l2) > 0 and r2.drafts_created == len(pending(svc))  # L2 for reminded + new L1 for newly overdue
    assert all(d.total_cents >= d.outstanding_cents for d in l2)
    assert any(d.interest_cents > 0 for d in l2)  # invoices past due + 30 days carry interest
    assert any(d.fees_cents == 4000 for d in l2)  # B2B flat fee


def test_payment_after_drafting_cancels_draft_and_closes_case(env):
    svc = env["service"]()
    svc.run(today=TODAY)
    d = pending(svc)[0]
    inv = d.case.invoice
    env["connector"].add_payment({"external_id": "X1", "booking_date": TODAY.isoformat(),
                                  "amount_cents": inv.outstanding_cents, "payer_name": None,
                                  "reference": f"Zahlung {inv.number}", "customer_erp_id": None})
    r = svc.run(today=TODAY + timedelta(days=1))
    svc.s.refresh(d)
    assert d.status == "cancelled" and d.case.status == "closed"
    assert r.closed_cases >= 1


def test_send_is_blocked_if_payment_arrives_between_draft_and_approval(env):
    svc = env["service"]()
    svc.run(today=TODAY)
    d = pending(svc)[0]
    inv = d.case.invoice
    svc.s.add(Payment(external_id="LATE", booking_date=TODAY, amount_cents=inv.outstanding_cents,
                      invoice_id=inv.id, match_method="manual"))
    svc.s.commit()
    with pytest.raises(ValueError, match="bezahlt"):
        svc.approve_and_send(d.id, "Anna", today=TODAY)
    assert not list(env["settings"].outbox_dir.glob("*.eml"))


def test_edited_draft_is_revalidated(env):
    svc = env["service"]()
    svc.run(today=TODAY)
    d = pending(svc)[0]
    with pytest.raises(ValueError, match="Validierung"):
        svc.approve_and_send(d.id, "Anna", body=d.body + "\nSonst geht es zum Inkasso.", today=TODAY)
    ok = svc.approve_and_send(d.id, "Anna", body=d.body.replace("Wir bitten Sie", "Bitte"), today=TODAY)
    assert ok.status == "sent" and ok.decision_note == "bearbeitet und freigegeben"


def test_partial_payment_reduces_claim_and_unmatched_payment_can_be_assigned(env):
    svc = env["service"]()
    svc.run(today=TODAY)
    unmatched = svc.s.scalars(select(Payment).where(Payment.invoice_id.is_(None))).one()
    d = pending(svc)[0]
    before = d.case.invoice.outstanding_cents
    svc.assign_payment(unmatched.id, d.case.invoice_id, "Anna")
    inv = svc.s.get(Invoice, d.case.invoice_id)
    assert inv.outstanding_cents == max(before - unmatched.amount_cents, 0)


def test_promise_to_pay_pauses_dunning(env):
    svc = env["service"]()
    svc.run(today=TODAY)
    d = pending(svc)[0]
    svc.reject(d.id, "Anna", "Kunde hat angerufen")
    svc.set_promise(d.case.invoice_id, TODAY + timedelta(days=7), "Anna")
    svc.run(today=TODAY + timedelta(days=1))
    case = svc.s.get(DunningCase, d.case_id)
    assert not [x for x in case.drafts if x.status == "pending"]


def test_summary(env):
    svc = env["service"]()
    svc.run(today=TODAY)
    s = svc.summary(today=TODAY)
    assert s["total_open_cents"] == sum(s["aging"].values())
    assert s["pending_approvals"] > 0 and s["unmatched_payments"] == 1
    assert 0 <= s["top_risk"][0]["risk"] <= 100
