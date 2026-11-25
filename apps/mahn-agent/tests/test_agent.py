from types import SimpleNamespace as NS

from mahn_agent.agent import drafter, templates
from mahn_agent.agent.validator import validate
from mahn_agent.config import Settings
from mahn_agent.evals import CASES, facts_for

from .conftest import TODAY


def facts(level=2):
    case = next(c for c in CASES if c.level == level)
    return facts_for(case, Settings(), TODAY)


def test_templates_valid_for_all_eval_cases():
    for c in CASES:
        f = facts_for(c, Settings(), TODAY)
        assert validate(f, *templates.render(f)) == [], c.name


def test_validator_catches_invented_amount_foreign_iban_and_threats():
    f = facts(2)
    subject, body = templates.render(f)
    assert any("nicht durch die Fakten" in e for e in validate(f, subject, body + "\nZzgl. 99,99 € Bearbeitung."))
    assert any("Fremde IBAN" in e for e in validate(f, subject, body + "\nIBAN: DE02 1203 0000 0000 2020 51"))
    assert any("letzten Mahnung" in e for e in validate(f, subject, body + "\nSonst folgt Inkasso."))
    assert any("Unzulässige" in e for e in validate(f, subject, body + "\nWir melden Sie der Schufa."))
    assert any("Rechnungsnummer" in e for e in validate(f, "Mahnung", body.replace(f.invoice_number, "")))


class FakeClient:
    """Mimics client.beta.messages.create: reads facts, submits a bad draft, then fixes it."""

    def __init__(self, good_subject, good_body):
        self.calls = 0
        self.good = (good_subject, good_body)
        self.beta = NS(messages=NS(create=self.create))
        self.last_messages = None

    def _resp(self, blocks, stop="tool_use"):
        return NS(content=blocks, stop_reason=stop, model="claude-opus-5-5",
                  usage=NS(input_tokens=100, output_tokens=50))

    def create(self, **kw):
        self.calls += 1
        self.last_messages = kw["messages"]
        assert kw["model"] == "claude-opus-5-5" and kw["fallbacks"] == "default"
        if self.calls == 1:
            return self._resp([NS(type="tool_use", id="t1", name="get_case_facts", input={})])
        if self.calls == 2:
            bad = self.good[1] + "\nBearbeitungsgebühr 12,50 €"
            return self._resp([NS(type="tool_use", id="t2", name="submit_draft",
                                  input={"subject": self.good[0], "body": bad, "notes": "first try"})])
        return self._resp([NS(type="tool_use", id="t3", name="submit_draft",
                              input={"subject": self.good[0], "body": self.good[1], "notes": "fixed fee"})])


def test_agent_self_corrects_after_validation_error():
    f = facts(2)
    client = FakeClient(*templates.render(f))
    r = drafter.draft(client, f, {}, "claude-opus-5-5")
    assert r.generated_by == "claude:claude-opus-5-5"
    assert r.attempts == 2 and r.notes == "fixed fee"
    tool_error = client.last_messages[-2]["content"][0]  # [-1] is the accepted assistant turn
    assert tool_error["is_error"] and "12,50" in tool_error["content"]
    assert r.usage["input_tokens"] == 300


def test_agent_failure_falls_back_to_template():
    class Broken:
        beta = NS(messages=NS(create=lambda **kw: (_ for _ in ()).throw(ConnectionError("down"))))
    r = drafter.draft(Broken(), facts(1), {}, "claude-opus-5-5")
    assert r.generated_by == "template" and "ConnectionError" in r.notes


def test_refusal_falls_back_to_template():
    client = NS(beta=NS(messages=NS(create=lambda **kw: NS(content=[], stop_reason="refusal", model="m",
                                                              usage=NS(input_tokens=1, output_tokens=0)))))
    assert drafter.draft(client, facts(3), {}, "claude-opus-5-5").generated_by == "template"


def test_percentages_are_not_treated_as_amounts():
    f = facts(2)
    subject, body = templates.render(f)
    assert validate(f, subject, body + "\nZinssatz 10,27 % p.a.") == []
