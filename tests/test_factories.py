import csv
import io

from zfactory.app_factory import generate as gen_app
from zfactory.cli import main
from zfactory.content_studio import produce
from zfactory.core.spec import load_spec
from zfactory.research import new_project, plan
from zfactory.web_factory import generate as gen_web


def test_web_factory_all_site_specs(specs, tmp_path):
    for spec_path in (specs / "sites").glob("*.toml"):
        out = tmp_path / spec_path.stem
        gen_web(load_spec(spec_path), out)
        html = (out / "index.html").read_text()
        assert "<!DOCTYPE html>" in html and "styles.css" in html
        assert (out / "contact.html").exists()


def test_clinic_site_has_medical_disclaimer(specs, tmp_path):
    gen_web(load_spec(specs / "sites/aesthetic-clinic.toml"), tmp_path)
    assert "not medical advice" in (tmp_path / "services.html").read_text()


def test_app_factory(specs, tmp_path):
    gen_app(load_spec(specs / "apps/aesthetic-clinic-app.toml"), tmp_path)
    assert (tmp_path / "app/(tabs)/index.tsx").exists()
    assert (tmp_path / "app/(tabs)/book.tsx").exists()
    assert "Rhinoplasty" in (tmp_path / "data/content.ts").read_text()
    assert 'name="aftercare"' in (tmp_path / "app/(tabs)/_layout.tsx").read_text()


def test_content_studio(specs, tmp_path):
    produce(load_spec(specs / "studio/short-film.toml"), tmp_path)
    rows = list(csv.DictReader(io.StringIO((tmp_path / "03_shot_list.csv").read_text())))
    assert len(rows) == 12
    assert "INT. PROJECTION BOOTH - NIGHT" in (tmp_path / "02_screenplay.fountain").read_text()
    sched = (tmp_path / "05_schedule.md").read_text()
    assert "Projection booth, scenes 1, 3" in sched


def test_research(tmp_path):
    d = new_project("Does LED therapy reduce acne?", tmp_path, domain="dermatology")
    assert (d / "findings.md").exists()
    assert "Sub-questions" in plan(d, None).read_text()


def test_cli_projects(capsys):
    assert main(["projects"]) == 0
    out = capsys.readouterr().out
    assert "P01" in out and out.index("Mahn-Agent") < out.index("KlangWerk")
