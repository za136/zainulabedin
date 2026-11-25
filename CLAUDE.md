# Notes for Claude

- Monorepo; Python package in `src/zfactory`, CLI `zf` (`python -m zfactory` also works with `PYTHONPATH=src`).
- Priorities: 1 software factory, 2 app + website factories, 3 content studio, research, ventures.
- Run `pytest -q` before committing; tests must stay offline (no API calls).
- Every factory must work without an API key (template mode).
- Medical/cosmetic content: no outcome guarantees; keep disclaimers.
- Register new projects in `projects.toml` and the README table.
