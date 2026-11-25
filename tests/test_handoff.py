from pathlib import Path

from zfactory.cli import REPO_ROOT, main
from zfactory.handoff import check, check_handoff

TEMPLATE = REPO_ROOT / "docs/handoff/TEMPLATE.md"


def test_repo_handoffs_are_complete():
    assert check(REPO_ROOT) == {}


def test_check_detects_missing_sections(tmp_path: Path):
    p = tmp_path / "H.md"
    p.write_text("# X\n\n> Status: MVP · Last updated: 2026-01-01\n\n## Summary\nx\n")
    errs = check_handoff(p)
    assert any("Next actions" in e for e in errs) and any("Session log" in e for e in errs)


def test_template_is_structurally_complete_except_placeholders():
    errs = check_handoff(TEMPLATE)
    # the template uses placeholders instead of real numbered items/dates
    assert all("Next actions" in e or "Session log" in e for e in errs)


def test_cli_status_and_check(capsys):
    assert main(["handoff", "check"]) == 0
    assert main(["handoff", "status"]) == 0
    out = capsys.readouterr().out
    for code in ["F1", "F5", "P01", "P11", "ZL", "V02"]:
        assert code in out
