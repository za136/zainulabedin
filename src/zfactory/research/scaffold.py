"""Research projects: a consistent folder layout plus an optional AI-drafted research plan."""
from __future__ import annotations

from datetime import date
from pathlib import Path

from ..core.files import slugify, write_files
from ..core.llm import LLM

PLAN_SYSTEM = """You are a research methodologist. Given a research question and context, write a \
research plan in Markdown with: background, sub-questions, hypotheses, method, data sources (name \
real, checkable source types; do not invent citations), risks/ethics, milestones, and how findings \
will be validated."""


def new_project(question: str, root: Path, title: str | None = None, domain: str = "general",
                spec: dict | None = None) -> Path:
    title = title or question.rstrip("?")
    d = Path(root) / slugify(title)
    today = date.today().isoformat()
    spec = spec or {}
    hyps = "\n".join(f"- H{i}: {h}" for i, h in enumerate(spec.get("hypotheses", []), 1)) or "- H1: TBD"
    write_files(d, {
        "README.md": f"# {title}\n\n- **Question:** {question}\n- **Domain:** {domain}\n- **Started:** {today}\n"
                     f"- **Status:** scoping\n\n## Hypotheses\n\n{hyps}\n\n## Layout\n\n"
                     "- `plan.md`: research plan\n- `notes/`: dated working notes\n"
                     "- `sources.bib`: references (BibTeX)\n- `data/`: raw and processed data\n"
                     "- `findings.md`: conclusions, with evidence links\n",
        "plan.md": "# Research plan\n\nRun `zf research plan <dir>` to draft one with Claude, or write it here.\n",
        f"notes/{today}.md": f"# Notes {today}\n\n",
        "sources.bib": "% BibTeX entries\n",
        "data/.gitkeep": "",
        "findings.md": "# Findings\n\n| Claim | Evidence | Confidence |\n|---|---|---|\n",
    })
    return d


def plan(project_dir: Path, llm: LLM | None) -> Path:
    project_dir = Path(project_dir)
    readme = (project_dir / "README.md").read_text()
    if llm is None:
        body = ("# Research plan\n\n## Background\n\n## Sub-questions\n\n1.\n\n## Method\n\n"
                "## Data sources\n\n## Risks & ethics\n\n## Milestones\n\n## Validation\n")
    else:
        body = llm.complete(PLAN_SYSTEM, readme)
    out = project_dir / "plan.md"
    out.write_text(body)
    return out
