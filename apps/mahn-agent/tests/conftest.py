from datetime import date

import pytest

from mahn_agent import seed
from mahn_agent.config import Settings
from mahn_agent.connectors.demo import DemoConnector
from mahn_agent.db import make_engine, make_sessionmaker
from mahn_agent.mailer import OutboxMailer
from mahn_agent.service import DunningService

TODAY = date(2026, 6, 15)


@pytest.fixture(autouse=True)
def fixed_rates(monkeypatch):
    monkeypatch.setenv("MAHN_BASE_RATE_DE", "1.27")
    monkeypatch.setenv("MAHN_BASE_RATE_AT", "1.53")
    for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"):
        monkeypatch.delenv(k, raising=False)


@pytest.fixture
def env(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path}/t.db", demo_erp_file=tmp_path / "erp.json",
                        outbox_dir=tmp_path / "outbox", llm="off")
    seed.write(settings.demo_erp_file, today=TODAY)
    factory = make_sessionmaker(make_engine(settings.database_url))
    connector = DemoConnector(settings.demo_erp_file)
    mailer = OutboxMailer(settings.outbox_dir)

    def make_service(client=None):
        return DunningService(factory(), settings, connector=connector, mailer=mailer, llm_client=client)

    return {"settings": settings, "factory": factory, "connector": connector, "mailer": mailer,
            "service": make_service, "tmp": tmp_path}
