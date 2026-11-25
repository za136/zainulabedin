"""Website factory: spec -> static multi-page site (no build step, deploy anywhere)."""
from __future__ import annotations

import html
import json
from pathlib import Path

from ..core.files import slugify, write_files
from ..core.llm import LLM
from .presets import PRESETS

COPY_SYSTEM = """You write website copy. Return JSON only: {"tagline": str, "about": str, \
"services": [{"name": str, "summary": str, "details": str}]}. Keep service names from the input. \
Be accurate and avoid guarantees of results; for medical or cosmetic businesses do not make \
claims about outcomes."""

e = html.escape


def _merge(spec: dict) -> dict:
    site = spec["site"]
    preset = PRESETS.get(site.get("preset", "saas"), PRESETS["saas"])
    cfg = {**preset, **{k: v for k, v in site.items() if v}}
    cfg["palette"] = {**preset["palette"], **site.get("palette", {})}
    cfg["services"] = spec.get("service") or preset["services"]
    cfg.setdefault("about", f"{site['name']} is located in {site.get('city', 'your city')}.")
    return cfg


def _layout(cfg: dict, title: str, body: str) -> str:
    nav = "".join(f'<a href="{href}">{label}</a>' for label, href in
                  [("Home", "index.html"), ("Services", "services.html"), ("About", "about.html"),
                   ("Contact", "contact.html")])
    disclaimer = f'<p class="disclaimer">{e(cfg["disclaimer"])}</p>' if cfg.get("disclaimer") else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} | {e(cfg['name'])}</title>
<meta name="description" content="{e(cfg['tagline'])}">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header><a class="brand" href="index.html">{e(cfg['name'])}</a><nav>{nav}</nav></header>
<main>
{body}
</main>
<footer>{disclaimer}<p>&copy; {e(cfg['name'])} &middot; {e(cfg.get('phone', ''))} &middot; {e(cfg.get('email', ''))}</p></footer>
</body>
</html>
"""


def _css(p: dict) -> str:
    return f""":root{{--bg:{p['bg']};--fg:{p['fg']};--accent:{p['accent']};--muted:{p['muted']}}}
*{{box-sizing:border-box}}body{{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6}}
header{{display:flex;justify-content:space-between;align-items:center;padding:1rem 5vw;border-bottom:1px solid var(--muted)}}
.brand{{font-weight:700;font-size:1.25rem;color:var(--fg);text-decoration:none}}nav a{{margin-left:1.25rem;color:var(--fg);text-decoration:none}}nav a:hover{{color:var(--accent)}}
main{{padding:0 5vw}}.hero{{padding:6rem 0 4rem;max-width:44rem}}.hero h1{{font-size:clamp(2rem,5vw,3.5rem);line-height:1.1;margin:0 0 1rem}}
.btn{{display:inline-block;background:var(--accent);color:#fff;padding:.8rem 1.5rem;border-radius:999px;text-decoration:none;font-weight:600;border:0;font-size:1rem;cursor:pointer}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1.25rem;padding:2rem 0 4rem}}
.card{{background:var(--muted);border-radius:1rem;padding:1.5rem}}.card h3{{margin-top:0}}.card a{{color:var(--accent);font-weight:600}}
form{{display:grid;gap:1rem;max-width:32rem;padding-bottom:4rem}}label{{display:grid;gap:.35rem;font-weight:600}}
input,select,textarea{{font:inherit;padding:.7rem;border-radius:.5rem;border:1px solid var(--muted);background:#fff;color:#111}}
footer{{padding:2rem 5vw;border-top:1px solid var(--muted);font-size:.9rem;opacity:.85}}.disclaimer{{font-size:.8rem}}
"""


def _pages(cfg: dict) -> dict[str, str]:
    services = cfg["services"]
    cards = "".join(f'<article class="card" id="{slugify(s["name"])}"><h3>{e(s["name"])}</h3>'
                    f'<p>{e(s["summary"])}</p>{"<p>" + e(s["details"]) + "</p>" if s.get("details") else ""}</article>'
                    for s in services)
    teaser = "".join(f'<article class="card"><h3>{e(s["name"])}</h3><p>{e(s["summary"])}</p>'
                     f'<a href="services.html#{slugify(s["name"])}">Learn more</a></article>' for s in services[:3])
    options = "".join(f"<option>{e(s['name'])}</option>" for s in services)
    form_action = cfg.get("form_action", "")
    return {
        "index.html": _layout(cfg, "Home", f"""<section class="hero"><h1>{e(cfg['tagline'])}</h1>
<p>{e(cfg['about'])}</p><a class="btn" href="contact.html">{e(cfg['cta'])}</a></section>
<h2>Featured</h2><section class="grid">{teaser}</section>"""),
        "services.html": _layout(cfg, "Services", f"<h1>Services</h1><section class='grid'>{cards}</section>"),
        "about.html": _layout(cfg, "About", f"<section class='hero'><h1>About {e(cfg['name'])}</h1><p>{e(cfg['about'])}</p></section>"),
        "contact.html": _layout(cfg, "Contact", f"""<h1>{e(cfg['cta'])}</h1>
<form method="post" action="{e(form_action)}">
<label>Name<input name="name" required></label>
<label>Email<input type="email" name="email" required></label>
<label>Phone<input type="tel" name="phone"></label>
<label>Service<select name="service">{options}</select></label>
<label>Preferred date<input type="date" name="date"></label>
<label>Message<textarea name="message" rows="4"></textarea></label>
<button class="btn" type="submit">{e(cfg['cta'])}</button>
</form>"""),
        "styles.css": _css(cfg["palette"]),
    }


def generate(spec: dict, out_dir: Path, llm: LLM | None = None) -> list[Path]:
    cfg = _merge(spec)
    if llm is not None:
        raw = llm.complete(COPY_SYSTEM, json.dumps({k: cfg[k] for k in ("name", "tagline", "about", "services")}
                                                    | {"preset": cfg.get("preset"), "city": cfg.get("city")}),
                           effort="medium")
        copy = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
        cfg.update({k: copy[k] for k in ("tagline", "about", "services") if copy.get(k)})
    return write_files(Path(out_dir), _pages(cfg))
