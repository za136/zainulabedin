# ADR-001: Deterministic core, agentic edge

- Status: accepted · 2026-11-25

## Context
Dunning letters state legally relevant amounts (interest, fees) and deadlines. LLM output is non-deterministic.

## Options
1. LLM decides levels and computes amounts.
2. LLM writes text only; policy, money and stop logic are plain code.
3. Templates only.

## Decision
Option 2. The policy, claim calculation (integer cents), payment matching and stop logic are deterministic and
unit-tested. The agent gets pre-formatted facts through tools and may only copy them; a validator rejects any
letter with amounts not in the facts, foreign IBANs, premature escalation or threats, and sends the errors back
so the agent can correct itself. Templates remain as fallback (option 3) so a run never blocks.

## Consequences
+ Wrong money is impossible by construction; the eval measures text quality only.
+ Works with no API key (CI, demos, cost-free).
− The agent cannot invent new claim types; adding one means code + tests.
