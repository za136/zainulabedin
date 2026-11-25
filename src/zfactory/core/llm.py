"""Thin wrapper around the Claude API.

Every factory accepts an optional ``LLM``. When none is available (no SDK or no
credentials) the factories fall back to deterministic templates, so the whole
repo works offline and in CI.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Protocol

DEFAULT_MODEL = os.environ.get("ZF_MODEL", "claude-opus-5-5")


class LLM(Protocol):
    def complete(self, system: str, prompt: str, effort: str = "high") -> str: ...


class RefusalError(RuntimeError):
    pass


@dataclass
class ClaudeLLM:
    model: str = DEFAULT_MODEL
    max_tokens: int = 64000

    def __post_init__(self) -> None:
        import anthropic  # imported lazily: optional dependency

        self._client = anthropic.Anthropic()

    def complete(self, system: str, prompt: str, effort: str = "high") -> str:
        # Streaming avoids HTTP timeouts on long generations (whole files, scripts).
        # Server-side fallbacks re-run a refused request on another model.
        with self._client.beta.messages.stream(
            model=self.model,
            max_tokens=self.max_tokens,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            thinking={"type": "adaptive"},
            output_config={"effort": effort},
            system=system,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            message = stream.get_final_message()
        if message.stop_reason == "refusal":
            raise RefusalError(f"Model declined the request: {message.stop_details}")
        return "".join(b.text for b in message.content if b.type == "text")


def get_llm(offline: bool = False) -> LLM | None:
    """Return a Claude client if usable, else None (template mode)."""
    if offline or os.environ.get("ZF_OFFLINE") == "1":
        return None
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return None
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")
            or os.environ.get("ZF_USE_CLAUDE") == "1"):
        return None
    return ClaudeLLM()
