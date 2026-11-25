"""Handoff checks: every factory/project in projects.toml has a complete handoff file,
and AGENTS.md / CLAUDE.md / GEMINI.md are identical wherever they exist."""
from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass
from pathlib import Path

REQUIRED_SECTIONS = [
    "## Summary", "## Current status", "## Where things are", "## How to run", "## How to test",
    "## Decisions", "## Open questions and blockers", "## Next actions", "## Session log",
]
AGENT_FILES = ("AGENTS.md", "CLAUDE.md", "GEMINI.md")


@dataclass
class Entry:
    code: str
    name: str
    status: str
    handoff: str


def load_registry(root: Path) -> dict:
    with open(root / "projects.toml", "rb") as f:
        return tomllib.load(f)


def entries(root: Path) -> list[Entry]:
    reg = load_registry(root)
    out = [Entry(f["code"], f["name"], "factory", f["handoff"]) for f in reg.get("factory", [])]
    out += [Entry(p["code"], p["name"], p["status"], p["handoff"]) for p in reg.get("project", [])]
    return out


def check_handoff(path: Path) -> list[str]:
    if not path.exists():
        return [f"missing file {path}"]
    text = path.read_text()
    errors = [f"missing section '{s}'" for s in REQUIRED_SECTIONS if s not in text]
    header = text.split("\n## ", 1)[0]
    for key in ("Status:", "Last updated:"):
        if key not in header:
            errors.append(f"header line needs '{key}'")
    m = re.search(r"## Next actions\n(.*?)(\n## |\Z)", text, re.S)
    if m and not re.search(r"^\d+\. \S", m.group(1), re.M):
        errors.append("'Next actions' needs at least one numbered item")
    m = re.search(r"## Session log\n(.*?)(\n## |\Z)", text, re.S)
    if m and not re.search(r"^- \d{4}-\d{2}-\d{2}", m.group(1), re.M):
        errors.append("'Session log' needs at least one dated entry '- YYYY-MM-DD · …'")
    return errors


def check_agent_files(root: Path) -> list[str]:
    errors = []
    for agents in root.rglob("AGENTS.md"):
        if "node_modules" in agents.parts:
            continue
        base = agents.read_text()
        for other in ("CLAUDE.md", "GEMINI.md"):
            p = agents.parent / other
            if not p.exists():
                errors.append(f"{p.relative_to(root)} missing (run scripts/sync-agent-files.sh)")
            elif p.read_text() != base:
                errors.append(f"{p.relative_to(root)} differs from AGENTS.md (run scripts/sync-agent-files.sh)")
    return errors


def check(root: Path) -> dict[str, list[str]]:
    problems: dict[str, list[str]] = {}
    for e in entries(root):
        errs = check_handoff(root / e.handoff)
        if errs:
            problems[f"{e.code} {e.name} ({e.handoff})"] = errs
    for must in ("AGENTS.md", "HANDOFF.md"):
        if not (root / must).exists():
            problems[must] = ["missing"]
    agent_errs = check_agent_files(root)
    if agent_errs:
        problems["agent files"] = agent_errs
    return problems


def next_action(path: Path) -> str:
    if not path.exists():
        return "(no handoff)"
    m = re.search(r"## Next actions\n(.*?)(\n## |\Z)", path.read_text(), re.S)
    first = re.search(r"^1\. (.+)$", m.group(1), re.M) if m else None
    return first.group(1) if first else "(none)"
