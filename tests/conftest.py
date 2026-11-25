from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPECS = ROOT / "specs"


@pytest.fixture
def specs() -> Path:
    return SPECS
