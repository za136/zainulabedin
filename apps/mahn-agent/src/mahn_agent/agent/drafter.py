"""The drafting agent.

Claude gets the case through tools, writes the German letter, and submits it through
`submit_draft`. Every submission is checked by the deterministic validator; failures go back
to the model as tool errors so it can correct itself. Money is never computed by the model:
it only copies pre-formatted amounts. If no LLM is configured, or the agent does not produce a
valid letter within the turn budget, the deterministic template is used instead.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any

from . import templates
from .facts import LetterFacts
from .validator import validate

log = logging.getLogger(__name__)

SYSTEM = """Du bist der Mahn-Agent der Buchhaltung eines Unternehmens in der DACH-Region. Du schreibst \
Zahlungserinnerungen und Mahnungen auf Deutsch, die ein Mensch vor dem Versand freigibt.

Arbeitsweise:
1. Rufe get_case_facts auf. Optional get_customer_context für den Ton.
2. Schreibe Betreff und Brief und reiche ihn mit submit_draft ein. Wenn submit_draft Fehler meldet, \
korrigiere genau diese Punkte und reiche erneut ein.

Regeln:
- Verwende ausschließlich Beträge, Daten und Bankdaten aus get_case_facts, wörtlich übernommen. \
Rechne nichts selbst aus und nenne keine anderen Beträge.
- Nenne Rechnungsnummer, offenen Betrag, bei Stufe 2 und 3 die Gesamtforderung samt Aufschlüsselung, \
und die Zahlungsfrist (pay_by).
- Ton nach Stufe: 1 = freundlich und kurz, ohne Zinsen oder Gebühren; 2 = sachlich und bestimmt; \
3 = ernst und klar, erst hier darf ein gerichtliches Mahnverfahren oder Inkasso als mögliche Folge \
genannt werden. Niemals Schufa, Strafanzeige, Pfändung oder andere Drohungen.
- Wenn bereits ein Teil bezahlt wurde, bedanke dich dafür.
- Anrede: "Guten Tag <contact_person>," falls vorhanden, sonst "Sehr geehrte Damen und Herren,".
- Klartext ohne Markdown, ohne Platzhalter. Schluss mit "Mit freundlichen Grüßen" und den Firmendaten.
"""

TOOLS = [
    {"name": "get_case_facts", "strict": True,
     "description": "Returns the verified facts for this reminder: level, customer, invoice, pre-formatted "
                    "amounts (outstanding, interest, fees, total), claim explanation, payment deadline, "
                    "prior reminders and the creditor's bank details.",
     "input_schema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "get_customer_context", "strict": True,
     "description": "Returns the customer's payment behaviour (late payments, other open invoices) to "
                    "choose the right tone. Contains no amounts that may be quoted.",
     "input_schema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "submit_draft", "strict": True,
     "description": "Submit the finished letter for validation and human approval. Returns validation "
                    "errors to fix, or 'accepted'.",
     "input_schema": {"type": "object", "additionalProperties": False, "required": ["subject", "body", "notes"],
                      "properties": {
                          "subject": {"type": "string", "description": "Betreffzeile"},
                          "body": {"type": "string", "description": "Brieftext inkl. Anrede und Grußformel"},
                          "notes": {"type": "string",
                                    "description": "Short note for the human approver (English or German): "
                                                   "tone chosen and anything to double-check."}}}},
]


@dataclass
class DraftResult:
    subject: str
    body: str
    generated_by: str
    notes: str = ""
    attempts: int = 0
    usage: dict[str, int] = field(default_factory=dict)


def make_client(mode: str = "auto") -> Any | None:
    """An Anthropic client if usable, else None (template mode)."""
    if mode == "off":
        return None
    try:
        import anthropic
    except ImportError:
        return None
    if mode == "auto" and not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        return None
    return anthropic.Anthropic()


def template_draft(facts: LetterFacts, note: str = "") -> DraftResult:
    subject, body = templates.render(facts)
    errors = validate(facts, subject, body)
    if errors:  # a template failing validation is a bug, never send it silently
        raise AssertionError(f"Template failed validation: {errors}")
    return DraftResult(subject, body, "template", note)


def draft_with_agent(client: Any, facts: LetterFacts, customer_context: dict, model: str,
                     max_turns: int = 6) -> DraftResult:
    messages: list[dict] = [{"role": "user", "content":
                             f"Erstelle den Entwurf für Stufe {facts.level} ({facts.level_name}) zur Rechnung "
                             f"{facts.invoice_number}."}]
    usage = {"input_tokens": 0, "output_tokens": 0}
    attempts = 0
    for _ in range(max_turns):
        response = client.beta.messages.create(
            model=model,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium"},
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )
        usage["input_tokens"] += getattr(response.usage, "input_tokens", 0) or 0
        usage["output_tokens"] += getattr(response.usage, "output_tokens", 0) or 0
        if response.stop_reason == "refusal":
            return template_draft(facts, "Agent declined; template used.")
        messages.append({"role": "assistant", "content": response.content})
        tool_uses = [b for b in response.content if b.type == "tool_use"]
        if not tool_uses:
            if response.stop_reason == "pause_turn":
                continue
            break
        results = []
        accepted: DraftResult | None = None
        for tu in tool_uses:
            if tu.name == "get_case_facts":
                results.append({"type": "tool_result", "tool_use_id": tu.id,
                                "content": json.dumps(facts.for_model(), ensure_ascii=False)})
            elif tu.name == "get_customer_context":
                results.append({"type": "tool_result", "tool_use_id": tu.id,
                                "content": json.dumps(customer_context, ensure_ascii=False)})
            elif tu.name == "submit_draft":
                attempts += 1
                inp = tu.input if isinstance(tu.input, dict) else {}
                subject, body = str(inp.get("subject", "")).strip(), str(inp.get("body", "")).strip()
                errors = validate(facts, subject, body)
                if errors:
                    results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                    "content": "Validierung fehlgeschlagen:\n- " + "\n- ".join(errors)})
                else:
                    results.append({"type": "tool_result", "tool_use_id": tu.id, "content": "accepted"})
                    accepted = DraftResult(subject, body, f"claude:{response.model}",
                                           str(inp.get("notes", "")), attempts, usage)
            else:
                results.append({"type": "tool_result", "tool_use_id": tu.id, "is_error": True,
                                "content": f"Unknown tool {tu.name}"})
        if accepted:
            return accepted
        messages.append({"role": "user", "content": results})
    result = template_draft(facts, f"Agent produced no valid draft after {attempts} submission(s); template used.")
    result.attempts, result.usage = attempts, usage
    return result


def draft(client: Any | None, facts: LetterFacts, customer_context: dict, model: str) -> DraftResult:
    if client is None:
        return template_draft(facts)
    try:
        return draft_with_agent(client, facts, customer_context, model)
    except Exception as exc:  # network/API errors must not block the dunning run
        log.exception("Agent drafting failed")
        return template_draft(facts, f"Agent error ({type(exc).__name__}); template used.")
