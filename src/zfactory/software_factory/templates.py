"""Deterministic (offline) planning and scaffolding for the software factory."""
from __future__ import annotations

import re

from ..core.files import slugify


def _ident(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return s if s and not s[0].isdigit() else f"f_{s}"


def offline_plan(spec: dict) -> dict:
    pkg = _ident(spec["project"]["name"])
    features = spec.get("feature", [])
    return {
        "package": pkg,
        "modules": [{"path": f"{pkg}/{_ident(f['name'])}.py", "purpose": f.get("description", "")}
                    for f in features],
        "tests": [{"path": f"tests/test_{_ident(f['name'])}.py", "covers": f["name"]} for f in features],
        "notes": "Offline scaffold: modules contain TODO stubs; acceptance tests are marked xfail "
                 "until implemented.",
    }


def offline_files(spec: dict, plan: dict) -> dict[str, str]:
    proj = spec["project"]
    pkg = plan["package"]
    files: dict[str, str] = {
        "pyproject.toml": f'[project]\nname = "{slugify(proj["name"])}"\nversion = "0.1.0"\n'
                          f'requires-python = ">=3.11"\n\n[tool.pytest.ini_options]\npythonpath = ["."]\n',
        f"{pkg}/__init__.py": f'"""{proj.get("description", proj["name"])}"""\n',
        "README.md": f"# {proj['name']}\n\n{proj.get('description', '')}\n\n## Features\n\n"
                     + "\n".join(f"- **{f['name']}**: {f.get('description', '')}" for f in spec.get("feature", []))
                     + "\n\n## Run tests\n\n```\npython -m pytest\n```\n",
    }
    for feat, mod in zip(spec.get("feature", []), plan["modules"]):
        fn = _ident(feat["name"])
        files[mod["path"]] = (
            f'"""{feat["name"]}: {feat.get("description", "")}"""\n\n\n'
            f"def {fn}(*args, **kwargs):\n"
            f'    """TODO: implement. Acceptance criteria:\n'
            + "".join(f"    - {a}\n" for a in feat.get("acceptance", []))
            + '    """\n    raise NotImplementedError\n'
        )
        tests = [
            f"import pytest\n\nfrom {pkg} import {fn} as mod\n\n\n"
            f"def test_module_exposes_entrypoint():\n    assert callable(mod.{fn})\n"
        ]
        for i, a in enumerate(feat.get("acceptance", []), 1):
            tests.append(f'\n\n@pytest.mark.xfail(reason="not implemented", strict=False)\n'
                         f"def test_acceptance_{i}():\n    # {a}\n    mod.{fn}()\n")
        files[f"tests/test_{fn}.py"] = "".join(tests)
    return files


def report(spec: dict, plan: dict, passed: bool | None, log: list[str]) -> str:
    status = {True: "PASS", False: "FAIL", None: "NOT RUN"}[passed]
    mods = "\n".join(f"- `{m['path']}`: {m['purpose']}" for m in plan.get("modules", []))
    return (f"# Build report: {spec['project']['name']}\n\nStatus: **{status}**\n\n"
            f"## Plan\n\n{mods}\n\n{plan.get('notes', '')}\n\n## Log\n\n```\n" + "\n".join(log) + "\n```\n")
