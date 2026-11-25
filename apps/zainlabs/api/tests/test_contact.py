from .conftest import ADMIN, VALID_CONTACT


def test_contact_stored_and_visible_to_admin(env):
    c = env["client"]
    r = c.post("/api/contact", json=VALID_CONTACT)
    assert r.status_code == 201 and r.json()["ok"] is True
    leads = c.get("/api/admin/leads", headers=ADMIN).json()
    assert len(leads) == 1 and leads[0]["email"] == "anna@example.at" and leads[0]["status"] == "new"


def test_contact_validation_messages(env):
    c = env["client"]
    for patch, field in [({"email": "nope"}, "email"), ({"message": "short"}, "message"),
                         ({"stream": "marketing"}, "stream"), ({"consent": False}, "consent"),
                         ({"project": "invented-project"}, "project"), ({"phone": "123"}, "phone")]:
        env["clock"].t += 601  # stay under the rate limit
        r = c.post("/api/contact", json={**VALID_CONTACT, **patch})
        body = r.json()
        assert r.status_code == 422, patch
        assert body["code"] == "validation_error" and field in body["fields"], (patch, body)
        assert body["error"]


def test_unknown_fields_are_rejected_not_ignored(env):
    r = env["client"].post("/api/contact", json={**VALID_CONTACT, "budget": "10k"})
    assert r.status_code == 422 and r.json()["fields"]["budget"] == "Unknown field."


def test_honeypot_pretends_success_but_stores_nothing(env):
    c = env["client"]
    r = c.post("/api/contact", json={**VALID_CONTACT, "website": "http://spam.example"})
    assert r.status_code == 201
    assert c.get("/api/admin/leads", headers=ADMIN).json() == []


def test_rate_limit(env):
    c = env["client"]
    for _ in range(5):
        assert c.post("/api/contact", json=VALID_CONTACT).status_code == 201
    r = c.post("/api/contact", json=VALID_CONTACT)
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and int(r.headers["retry-after"]) > 0
    env["clock"].t += 601
    assert c.post("/api/contact", json=VALID_CONTACT).status_code == 201


def test_owner_notification_and_webhook(env, monkeypatch):
    env["settings"].owner_email = "owner@zainlabs.example"
    env["settings"].lead_webhook_url = "https://hooks.example/lead"
    sent = []
    import zainlabs_api.services as services

    class Resp:
        def raise_for_status(self):
            raise RuntimeError("webhook down")

    monkeypatch.setattr(services.httpx, "post", lambda url, json, timeout: sent.append((url, json)) or Resp())
    r = env["client"].post("/api/contact", json={**VALID_CONTACT, "project": "mahn-agent"})
    assert r.status_code == 201  # webhook failure must not lose the lead
    assert sent and sent[0][1]["project"] == "mahn-agent"
    mails = list(env["settings"].outbox_dir.glob("*.eml"))
    assert len(mails) == 1 and "New lead: Anna Gruber" in mails[0].read_text()
