import json

from zainlabs_api.config import DEFAULT_CONTENT


def test_health_and_content(env):
    c = env["client"]
    h = c.get("/api/health").json()
    assert h["status"] == "ok" and h["projects"] > 0
    r = c.get("/api/content")
    assert r.status_code == 200 and r.json() == json.loads(DEFAULT_CONTENT.read_text())
    etag = r.headers["etag"]
    assert c.get("/api/content", headers={"If-None-Match": etag}).status_code == 304


def test_streams_projects_and_errors(env):
    c = env["client"]
    streams = c.get("/api/streams").json()
    assert [s["slug"] for s in streams] == ["software", "web", "apps", "studio", "deeptech"]
    assert sum(s["projectCount"] for s in streams) == len(c.get("/api/projects").json())
    sw = c.get("/api/projects", params={"stream": "software"}).json()
    assert sw and all(p["stream"] == "software" for p in sw)
    assert c.get("/api/projects/mahn-agent").json()["title"] == "Mahn-Agent"
    r = c.get("/api/projects/does-not-exist")
    assert r.status_code == 404 and r.json()["code"] == "not_found"
    r = c.get("/api/projects", params={"stream": "invented"})
    assert r.status_code == 422 and r.json()["code"] == "validation_error" and "stream" in r.json()["fields"]
    assert c.get("/api/nope").json()["code"] == "not_found"
