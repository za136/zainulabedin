# ADR-002: Human approval before every send

- Status: accepted · 2026-11-25

## Context
The Agent Brief requires human approval for any action that sends messages. A reminder sent after the
customer already paid damages the relationship.

## Decision
Every draft is `pending` until a named person approves it (web or API). On approval: the (possibly edited) text
is validated again, the invoice is re-checked for payments, and the amount must still match the draft;
otherwise the send is refused. Default mail backend is `outbox` (.eml files); SMTP must be enabled
explicitly. All actions are written to the audit log.

## Consequences
+ No surprise emails; full traceability (who approved what, when, edited or not).
− Throughput is limited by the reviewer. Batch approval (`mahn-agent approve --all`) exists for the CLI.
