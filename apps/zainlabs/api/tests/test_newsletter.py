import re
from datetime import datetime, timedelta, timezone

from zainlabs_api.models import Subscriber

from .conftest import ADMIN

SUB = {"email": "Max@Example.de", "consent": True, "source": "app"}


def token_from_mail(env):
    from email import message_from_bytes, policy
    raw = sorted(env["settings"].outbox_dir.glob("*.eml"))[-1].read_bytes()
    mail = message_from_bytes(raw, policy=policy.default).get_content()
    return re.search(r"confirm\?token=([\w-]+)", mail).group(1)


def test_double_opt_in_flow(env):
    c = env["client"]
    r = c.post("/api/newsletter", json=SUB)
    assert r.status_code == 202 and r.json() == {"ok": True, "status": "pending"}
    subs = c.get("/api/admin/subscribers", headers=ADMIN).json()
    assert subs[0]["status"] == "pending" and subs[0]["email"] == "max@example.de"
    token = token_from_mail(env)
    r = c.get("/api/newsletter/confirm", params={"token": token}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "https://site.example/newsletter?status=confirmed"
    assert c.get("/api/admin/subscribers", headers=ADMIN).json()[0]["status"] == "confirmed"
    r = c.get("/api/newsletter/unsubscribe", params={"token": token}, follow_redirects=False)
    assert r.headers["location"].endswith("status=unsubscribed")
    assert c.get("/api/admin/subscribers", headers=ADMIN).json()[0]["status"] == "unsubscribed"


def test_no_enumeration_and_invalid_tokens(env):
    c = env["client"]
    c.post("/api/newsletter", json=SUB)
    c.get("/api/newsletter/confirm", params={"token": token_from_mail(env)})
    again = c.post("/api/newsletter", json=SUB)
    assert again.status_code == 202 and again.json()["status"] == "pending"  # same answer for confirmed address
    r = c.get("/api/newsletter/confirm", params={"token": "x" * 40}, follow_redirects=False)
    assert r.headers["location"].endswith("status=invalid")


def test_expired_confirmation_link(env):
    c = env["client"]
    c.post("/api/newsletter", json=SUB)
    token = token_from_mail(env)
    with env["app"].state.ctx.session() as s:
        sub = s.query(Subscriber).one()
        sub.consent_at = datetime.now(timezone.utc) - timedelta(days=8)
        s.commit()
    r = c.get("/api/newsletter/confirm", params={"token": token}, follow_redirects=False)
    assert r.headers["location"].endswith("status=invalid")


def test_consent_required(env):
    r = env["client"].post("/api/newsletter", json={**SUB, "consent": False})
    assert r.status_code == 422 and "consent" in r.json()["fields"]
