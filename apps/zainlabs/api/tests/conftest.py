import pytest
from fastapi.testclient import TestClient

from zainlabs_api.config import Settings
from zainlabs_api.main import create_app
from zainlabs_api.mailer import OutboxMailer
from zainlabs_api.ratelimit import RateLimiter


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


@pytest.fixture
def env(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path}/t.db", outbox_dir=tmp_path / "outbox",
                        admin_token="test-admin-token", site_url="https://site.example", api_url="https://api.example")
    clock = Clock()
    limiter = RateLimiter(5, 600, clock=clock)
    app = create_app(settings, mailer=OutboxMailer(settings.outbox_dir), limiter=limiter)
    return {"client": TestClient(app), "settings": settings, "clock": clock, "app": app, "tmp": tmp_path}


ADMIN = {"Authorization": "Bearer test-admin-token"}

VALID_CONTACT = {"name": "Anna Gruber", "email": "Anna@Example.at", "company": "Alpenblick GmbH",
                 "stream": "apps", "message": "We need an app for our hotel guests.", "consent": True, "source": "web"}
