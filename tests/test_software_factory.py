import json

from zfactory.core.spec import load_spec
from zfactory.software_factory import build


def test_offline_build_scaffolds_and_tests_pass(specs, tmp_path):
    spec = load_spec(specs / "software/task-tracker.toml")
    res = build(spec, tmp_path, llm=None)
    assert res.passed, res.log
    assert (tmp_path / "task_tracker/add_task.py").exists()
    assert (tmp_path / "tests/test_list_tasks.py").exists()
    assert "PASS" in (tmp_path / "BUILD_REPORT.md").read_text()


class FakeLLM:
    """Plans, writes a buggy build, then fixes it: exercises the repair loop."""

    def __init__(self):
        self.calls = []

    def complete(self, system, prompt, effort="high"):
        self.calls.append(system)
        if "planning stage" in system:
            return json.dumps({"package": "calc", "modules": [{"path": "calc/__init__.py", "purpose": "add"}],
                               "tests": [{"path": "tests/test_calc.py", "covers": "add"}], "notes": ""})
        if "build stage" in system:
            return ('<file path="calc/__init__.py">\ndef add(a, b):\n    return a - b\n</file>\n'
                    '<file path="tests/test_calc.py">\nfrom calc import add\n\n'
                    'def test_add():\n    assert add(2, 3) == 5\n</file>\n'
                    '<file path="pyproject.toml">\n[tool.pytest.ini_options]\npythonpath = ["."]\n</file>')
        return '<file path="calc/__init__.py">\ndef add(a, b):\n    return a + b\n</file>'


def test_fix_loop_repairs_failing_build(tmp_path):
    llm = FakeLLM()
    spec = {"project": {"name": "calc"}, "feature": [{"name": "add", "acceptance": ["2+3=5"]}]}
    res = build(spec, tmp_path, llm=llm)
    assert res.passed
    assert res.iterations == 1
    assert sum("repair stage" in s for s in llm.calls) == 1


def test_writer_blocks_path_traversal(tmp_path):
    import pytest
    from zfactory.core.files import write_files
    with pytest.raises(ValueError):
        write_files(tmp_path, {"../evil.txt": "x"})
