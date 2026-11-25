"""`zf` command line: one entry point for every factory.

  zf projects                                  list projects by priority
  zf software build specs/software/x.toml      software factory
  zf app build specs/apps/x.toml               mobile app factory
  zf web build specs/sites/x.toml              website factory
  zf studio produce specs/studio/x.toml        content studio
  zf research new "question?" [--title ...]    new research project
  zf research plan research/<slug>             draft a research plan

Add --offline to force template mode (no API calls). Output defaults to ./out/<kind>/<slug>.
"""
from __future__ import annotations

import argparse
import sys
import tomllib
from pathlib import Path

from .core.files import slugify
from .core.llm import get_llm
from .core.spec import load_spec

REPO_ROOT = Path(__file__).resolve().parents[2]


def _out(args, kind: str, name: str) -> Path:
    return Path(args.out) if args.out else Path("out") / kind / slugify(name)


def cmd_projects(args) -> int:
    path = REPO_ROOT / "projects.toml"
    with open(path, "rb") as f:
        projects = tomllib.load(f)["project"]
    for p in sorted(projects, key=lambda p: (p["priority"], p["id"])):
        print(f"P{p['priority']}  {p['status']:<9} {p['name']:<36} {p['path']}")
        print(f"    {p['summary']}")
    return 0


def cmd_software(args) -> int:
    from .software_factory import build
    spec = load_spec(args.spec)
    res = build(spec, _out(args, "software", spec["project"]["name"]), llm=get_llm(args.offline),
                max_fix_iters=args.max_fix_iters, run=not args.no_test)
    print("\n".join(res.log))
    print(f"-> {res.out_dir}")
    return 0 if (res.passed or args.no_test) else 1


def cmd_app(args) -> int:
    from .app_factory import generate
    spec = load_spec(args.spec)
    out = _out(args, "apps", spec["app"]["name"])
    files = generate(spec, out)
    print(f"wrote {len(files)} files -> {out}")
    return 0


def cmd_web(args) -> int:
    from .web_factory import generate
    spec = load_spec(args.spec)
    out = _out(args, "sites", spec["site"]["name"])
    files = generate(spec, out, llm=get_llm(args.offline))
    print(f"wrote {len(files)} files -> {out}  (open {out / 'index.html'})")
    return 0


def cmd_studio(args) -> int:
    from .content_studio import produce
    spec = load_spec(args.spec)
    out = _out(args, "studio", spec["film"]["title"])
    files = produce(spec, out, llm=get_llm(args.offline))
    print(f"wrote {len(files)} files -> {out}")
    return 0


def cmd_research_new(args) -> int:
    from .research import new_project
    d = new_project(args.question, Path(args.root), title=args.title, domain=args.domain)
    print(f"created {d}")
    return 0


def cmd_research_plan(args) -> int:
    from .research import plan
    print(f"wrote {plan(Path(args.dir), get_llm(args.offline))}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="zf", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("projects").set_defaults(func=cmd_projects)

    def spec_cmd(group: str, action: str, func, **extra):
        g = sub.add_parser(group).add_subparsers(dest="action", required=True)
        c = g.add_parser(action)
        c.add_argument("spec")
        c.add_argument("--out")
        c.add_argument("--offline", action="store_true")
        c.set_defaults(func=func)
        return c

    sw = spec_cmd("software", "build", cmd_software)
    sw.add_argument("--max-fix-iters", type=int, default=3)
    sw.add_argument("--no-test", action="store_true")
    spec_cmd("app", "build", cmd_app)
    spec_cmd("web", "build", cmd_web)
    spec_cmd("studio", "produce", cmd_studio)

    r = sub.add_parser("research").add_subparsers(dest="action", required=True)
    rn = r.add_parser("new")
    rn.add_argument("question")
    rn.add_argument("--title")
    rn.add_argument("--domain", default="general")
    rn.add_argument("--root", default="research")
    rn.set_defaults(func=cmd_research_new)
    rp = r.add_parser("plan")
    rp.add_argument("dir")
    rp.add_argument("--offline", action="store_true")
    rp.set_defaults(func=cmd_research_plan)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
