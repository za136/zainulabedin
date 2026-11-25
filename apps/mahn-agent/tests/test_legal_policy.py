from datetime import date, timedelta

from mahn_agent.legal import compute_claim
from mahn_agent.money import fmt_eur, to_cents
from mahn_agent.policy import Policy, decide

DUE = date(2026, 1, 1)
TODAY = DUE + timedelta(days=60)  # interest runs from due + 30 days -> 30 days of interest


def test_money_formatting():
    assert fmt_eur(123456) == "1.234,56 €"
    assert fmt_eur(5) == "0,05 €"
    assert to_cents("10.005") == 1001


def test_level1_is_free_of_interest_and_fees():
    c = compute_claim(outstanding_cents=100000, due_date=DUE, today=TODAY, country="DE", is_business=True, level=1)
    assert (c.interest_cents, c.fees_cents, c.total_cents) == (0, 0, 100000)


def test_de_business_interest_and_flat_fee():
    c = compute_claim(outstanding_cents=100000, due_date=DUE, today=TODAY, country="DE", is_business=True, level=2)
    # 1000 EUR * (1.27 + 9) % * 30/365 = 8.44 EUR; + 40 EUR Verzugspauschale (§ 288 Abs. 5 BGB)
    assert c.interest_cents == 844
    assert c.fees_cents == 4000
    assert c.total_cents == 100000 + 844 + 4000


def test_de_consumer_no_flat_fee():
    c = compute_claim(outstanding_cents=100000, due_date=DUE, today=TODAY, country="DE", is_business=False, level=2)
    assert c.interest_cents == 515  # 6.27 % p.a.
    assert c.fees_cents == 0


def test_at_and_ch_rates():
    at_b2c = compute_claim(outstanding_cents=100000, due_date=DUE, today=TODAY, country="AT", is_business=False, level=3)
    ch_b2b = compute_claim(outstanding_cents=100000, due_date=DUE, today=TODAY, country="CH", is_business=True, level=3)
    assert at_b2c.interest_cents == 329 and at_b2c.fees_cents == 0   # 4 % ABGB
    assert ch_b2b.interest_cents == 411 and ch_b2b.fees_cents == 0   # 5 % OR, no flat fee


def _decide(**kw):
    base = dict(policy=Policy(), today=TODAY, due_date=TODAY - timedelta(days=10), outstanding_cents=50000,
                invoice_status="open", customer_paused=False, promise_to_pay_until=None, case_level=0,
                case_status="active", last_sent_on=None, has_open_draft=False)
    base.update(kw)
    return decide(**base)


def test_policy_levels_and_stops():
    assert _decide().action == "draft" and _decide().level == 1
    assert _decide(due_date=TODAY - timedelta(days=3)).action == "skip"
    assert _decide(outstanding_cents=0).action == "close"
    assert _decide(invoice_status="disputed").action == "skip"
    assert _decide(customer_paused=True).action == "skip"
    assert _decide(promise_to_pay_until=TODAY + timedelta(days=2)).action == "skip"
    assert _decide(has_open_draft=True).action == "skip"
    assert _decide(outstanding_cents=100).action == "skip"


def test_policy_steps_one_level_at_a_time_with_gap():
    long_overdue = TODAY - timedelta(days=90)
    assert _decide(due_date=long_overdue).level == 1  # never skips straight to a Mahnung
    assert _decide(due_date=long_overdue, case_level=1, last_sent_on=TODAY - timedelta(days=3)).action == "skip"
    d = _decide(due_date=long_overdue, case_level=1, last_sent_on=TODAY - timedelta(days=10))
    assert (d.action, d.level) == ("draft", 2)
    assert _decide(due_date=long_overdue, case_level=3, last_sent_on=TODAY - timedelta(days=14)).action == "escalate"
