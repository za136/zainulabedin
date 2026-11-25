import json

import httpx
from fastapi.testclient import TestClient

from mahn_agent.api import create_app
from mahn_agent.connectors.erpnext import ERPNextConnector


def client(env, **settings_overrides):
    s = env["settings"]
    for k, v in settings_overrides.items():
        setattr(s, k, v)
    app = create_app(s, session_factory=env["factory"], connector=env["connector"], mailer=env["mailer"],
                     use_llm_auto=False)
    return TestClient(app)


def test_web_and_api_flow(env):
    c = client(env)
    assert c.get("/api/v1/health").json()["status"] == "ok"
    assert "Forderungsübersicht" in c.get("/").text
    r = c.post("/mahnlauf", follow_redirects=False)
    assert r.status_code == 303 and "/freigaben" in r.headers["location"]
    page = c.get("/freigaben").text
    assert "Freigeben &amp; senden" in page
    drafts = c.get("/api/v1/drafts").json()
    assert drafts and drafts[0]["level"] == 1
    d = drafts[0]
    r = c.post(f"/api/v1/drafts/{d['id']}/approve", json={"approver": "Anna"})
    assert r.status_code == 200 and r.json()["status"] == "sent"
    assert c.post(f"/api/v1/drafts/{d['id']}/approve", json={"approver": "Anna"}).status_code == 409
    for path in ("/faelle", "/zahlungen", "/audit", "/docs"):
        assert c.get(path).status_code == 200, path
    assert c.get("/api/v1/receivables/summary").json()["pending_approvals"] == len(drafts) - 1


def test_web_approve_form_and_reject(env):
    c = client(env)
    c.post("/mahnlauf")
    d1, d2 = c.get("/api/v1/drafts").json()[:2]
    r = c.post(f"/freigaben/{d1['id']}/freigeben", data={"approver": "Anna", "subject": d1["subject"],
                                                         "body": d1["body"]}, follow_redirects=False)
    assert "msg=" in r.headers["location"]
    r = c.post(f"/freigaben/{d2['id']}/ablehnen", data={"approver": "Anna", "reason": "Klärung"},
               follow_redirects=False)
    assert "msg=" in r.headers["location"]


def test_basic_auth(env):
    c = client(env, basic_auth="admin:geheim")
    assert c.get("/").status_code == 401
    assert c.get("/api/v1/health").status_code == 200
    assert c.get("/", auth=("admin", "geheim")).status_code == 200


def test_erpnext_connector_maps_records():
    def handler(request: httpx.Request):
        assert request.headers["Authorization"] == "token k:s"
        if "Sales%20Invoice" in str(request.url) or "Sales Invoice" in request.url.path:
            return httpx.Response(200, json={"data": [{"name": "ACC-SINV-0001", "customer": "Müller GmbH",
                                                       "posting_date": "2026-05-01", "due_date": "2026-05-15",
                                                       "grand_total": 1190.0, "outstanding_amount": 595.0,
                                                       "currency": "EUR"}]})
        return httpx.Response(200, json={"data": [{"name": "Müller GmbH", "customer_name": "Müller GmbH",
                                                   "customer_type": "Company", "email_id": "a@b.de",
                                                   "territory": "Austria"}]})

    conn = ERPNextConnector("https://erp.example", "k", "s",
                            client=httpx.Client(base_url="https://erp.example", transport=httpx.MockTransport(handler),
                                                headers={"Authorization": "token k:s"}))
    inv = conn.open_invoices()[0]
    assert (inv.amount_total_cents, inv.paid_cents, inv.number) == (119000, 59500, "ACC-SINV-0001")
    cu = conn.customers()[0]
    assert cu.country == "AT" and cu.is_business


def test_odoo_connector_maps_records(monkeypatch):
    import mahn_agent.connectors.odoo as odoo

    class FakeProxy:
        def __init__(self, url):
            self.url = url

        def authenticate(self, db, user, key, ctx):
            return 7

        def execute_kw(self, db, uid, key, model, method, args, kw):
            if model == "account.move":
                return [{"id": 1, "name": "INV/2026/0001", "partner_id": [3, "Gruber"], "invoice_date": "2026-05-01",
                         "invoice_date_due": "2026-05-31", "amount_total": 500.0, "amount_residual": 500.0,
                         "currency_id": [1, "EUR"]}]
            return [{"id": 3, "name": "Gruber", "email": False, "country_id": [2, "Austria"], "is_company": False}]

    monkeypatch.setattr(odoo.xmlrpc.client, "ServerProxy", FakeProxy)
    conn = odoo.OdooConnector("https://odoo.example", "db", "u", "k")
    inv = conn.open_invoices()[0]
    assert inv.customer_erp_id == "odoo:3" and inv.amount_total_cents == 50000 and inv.paid_cents == 0
    cu = conn.customers()[0]
    assert cu.country == "AT" and not cu.is_business and cu.email is None


def test_missing_demo_data_gives_clear_503(tmp_path):
    from mahn_agent.config import Settings
    s = Settings(database_url=f"sqlite:///{tmp_path}/x.db", demo_erp_file=tmp_path / "none.json", llm="off")
    c = TestClient(create_app(s, use_llm_auto=False))
    r = c.post("/api/v1/runs")
    assert r.status_code == 503 and "seed" in r.json()["detail"]
    assert "Kein ERP verbunden" in c.post("/mahnlauf").text
