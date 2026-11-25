"""Software factory pipeline: spec -> plan -> build -> test -> fix (loop) -> report."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

from ..core.files import parse_file_blocks, read_tree, slugify, write_files
from ..core.llm import LLM
from . import prompts, templates


@dataclass
class BuildResult:
    out_dir: Path
    plan: dict
    passed: bool
    iterations: int
    log: list[str] = field(default_factory=list)


def _extract_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start : end + 1])


def make_plan(spec: dict, llm: LLM | None) -> dict:
    if llm is None:
        return templates.offline_plan(spec)
    raw = llm.complete(prompts.PLANNER_SYSTEM, f"Spec (TOML as JSON):\n{json.dumps(spec, indent=2)}")
    return _extract_json(raw)


def run_tests(out_dir: Path, timeout: int = 300) -> tuple[bool, str]:
    # Stale bytecode can mask a fix (same size + same mtime second), so never reuse it.
    for cache in out_dir.rglob("__pycache__"):
        shutil.rmtree(cache, ignore_errors=True)
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider"],
        cwd=out_dir, capture_output=True, text=True, timeout=timeout, env=env,
    )
    output = (proc.stdout + proc.stderr)[-8000:]
    return proc.returncode == 0, output


def build(spec: dict, out_dir: Path, llm: LLM | None = None, max_fix_iters: int = 3,
          run: bool = True) -> BuildResult:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    log: list[str] = []

    plan = make_plan(spec, llm)
    log.append(f"plan: {len(plan.get('modules', []))} modules, {len(plan.get('tests', []))} test files")

    if llm is None:
        files = templates.offline_files(spec, plan)
    else:
        raw = llm.complete(prompts.BUILDER_SYSTEM,
                           f"Spec:\n{json.dumps(spec, indent=2)}\n\nPlan:\n{json.dumps(plan, indent=2)}")
        files = parse_file_blocks(raw)
        if not files:
            raise RuntimeError("Builder returned no <file> blocks")
    write_files(out_dir, files)
    log.append(f"build: wrote {len(files)} files")

    passed, iterations = False, 0
    if run:
        passed, output = run_tests(out_dir)
        log.append(f"test[0]: {'PASS' if passed else 'FAIL'}")
        while not passed and llm is not None and iterations < max_fix_iters:
            iterations += 1
            current = read_tree(out_dir)
            prompt = (f"Spec:\n{json.dumps(spec, indent=2)}\n\nCurrent files:\n"
                      + "\n".join(f'<file path="{p}">\n{c}</file>' for p, c in current.items())
                      + f"\n\nTest output:\n{output}")
            fixes = parse_file_blocks(llm.complete(prompts.FIXER_SYSTEM, prompt))
            write_files(out_dir, fixes)
            passed, output = run_tests(out_dir)
            log.append(f"test[{iterations}]: {'PASS' if passed else 'FAIL'} after fixing {len(fixes)} files")
        if not passed:
            log.append("last test output:\n" + output)

    report = templates.report(spec, plan, passed if run else None, log)
    write_files(out_dir, {"BUILD_REPORT.md": report})
    return BuildResult(out_dir, plan, passed, iterations, log)


def default_out_dir(spec: dict) -> Path:
    return Path("out") / "software" / slugify(spec["project"]["name"])
