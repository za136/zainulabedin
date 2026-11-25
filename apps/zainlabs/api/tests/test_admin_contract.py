import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from zainlabs_api.models import Lead

from .conftest import ADMIN, VALID_CONTACT

API_DIR = Path(__file__).resolve().parents[1]
ZL = API_DIR.parent


def test_admin_auth(env):
    c = env["client"]
    assert c.get("/api/admin/leads").status_code == 401
    assert c.get("/api/admin/leads", headers={"Authorization": "Bearer wrong"}).json()["code"] == "unauthorized"
    env["settings"].admin_token = ""
    assert c.get("/api/admin/leads", headers=ADMIN).json()["code"] == "admin_disabled"


def test_admin_update_delete_purge_audit(env):
    c = env["client"]
    lead_id = c.post("/api/contact", json=VALID_CONTACT).json()["id"]
    r = c.patch(f"/api/admin/leads/{lead_id}", json={"status": "contacted", "note": "Called back"}, headers=ADMIN)
    assert r.json()["status"] == "contacted" and r.json()["note"] == "Called back"
    assert c.get("/api/admin/leads", params={"status": "new"}, headers=ADMIN).json() == []
    # retention: an old lead is purged
    old_id = c.post("/api/contact", json=VALID_CONTACT).json()["id"]
    with env["app"].state.ctx.session() as s:
        s.get(Lead, old_id).created_at = datetime.now(timezone.utc) - timedelta(days=400)
        s.commit()
    assert c.post("/api/admin/purge", headers=ADMIN).json()["deleted_leads"] == 1
    assert c.delete(f"/api/admin/leads/{lead_id}", headers=ADMIN).status_code == 204
    assert c.delete(f"/api/admin/leads/{lead_id}", headers=ADMIN).status_code == 404
    actions = [e["action"] for e in c.get("/api/admin/audit", headers=ADMIN).json()]
    assert {"lead_created", "lead_updated", "lead_deleted", "purge"} <= set(actions)


def test_committed_openapi_matches_code(env):
    """openapi.json is the contract for the frontends. Regenerate with: zainlabs-api openapi > openapi.json"""
    committed = json.loads((API_DIR / "openapi.json").read_text())
    assert committed == json.loads(json.dumps(env["app"].openapi(), sort_keys=True)), \
        "openapi.json is stale: run `zainlabs-api openapi > openapi.json`"


def test_frontend_client_only_calls_endpoints_in_the_contract():
    """Guards against invented endpoints: every path in the shared TS client must exist in openapi.json."""
    spec = json.loads((API_DIR / "openapi.json").read_text())["paths"]
    client = (ZL / "content" / "src" / "api.ts").read_text()
    used = set(re.findall(r'["`](/api/[^"`]+)["`]', client))
    used = {re.sub(r"\$\{[^}]+\}", "{slug}", u) for u in used}
    assert used, "no endpoints found in api.ts"
    assert used <= set(spec), f"api.ts calls endpoints missing from openapi.json: {used - set(spec)}"


def test_no_frontend_code_calls_undeclared_endpoints():
    """Website and app must call the API only through the shared client (content/src/api.ts)."""
    offenders = []
    for root in (ZL / "web", ZL / "mobile"):
        for f in list(root.rglob("*.ts")) + list(root.rglob("*.tsx")):
            if "node_modules" in f.parts or ".next" in f.parts or "dist" in f.parts:
                continue
            if re.search(r"fetch\(\s*[`'\"][^`'\"]*/api/", f.read_text()):
                offenders.append(str(f.relative_to(ZL)))
    assert not offenders, f"call the API via @zainlabs/content/api, not fetch(): {offenders}"
