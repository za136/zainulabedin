# zainulabedin

One monorepo for every project: the **software factory**, the **app and website factories**, the
**content studio**, **research**, and the **ventures** they serve (plastic surgery clinic, facials
spa, film studio).

| Priority | Project | What it does | Command |
|---|---|---|---|
| 1 | **P01 Mahn-Agent** ([apps/mahn-agent](apps/mahn-agent)) | Agentic dunning for DACH receivables: ERP sync, payment matching, Claude-drafted German reminders, human approval, dashboard | `cd apps/mahn-agent && make install && make demo` |
| 2 | **ZAIN LABS platform** ([apps/zainlabs](apps/zainlabs)) | The main website + iOS/Android app: every stream and project from one content source, Canva-based design, 3D hero, public API | `cd apps/zainlabs/web && npm i && npm run dev` |
| 1 | Software Factory | Spec -> plan -> code -> tests -> auto-fix loop | `zf software build specs/software/task-tracker.toml` |
| 2 | Mobile App Factory | Spec -> Expo/React Native app (iOS + Android) | `zf app build specs/apps/aesthetic-clinic-app.toml` |
| 2 | Website Factory | Brief -> static multi-page site (clinic, spa, studio, SaaS presets) | `zf web build specs/sites/aesthetic-clinic.toml` |
| 3 | Content Studio | Logline -> treatment -> screenplay -> shot list -> storyboards -> schedule | `zf studio produce specs/studio/short-film.toml` |
| 3 | Research | Research project scaffolds + AI-drafted plans | `zf research new "Your question?"` |

The full registry is in [`projects.toml`](projects.toml); run `zf projects` to list it.

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[llm,dev]"
zf projects
zf web build specs/sites/aesthetic-clinic.toml   # -> out/sites/aura-aesthetics/index.html
pytest
```

**AI mode vs template mode.** If `ANTHROPIC_API_KEY` is set and `anthropic` is installed, the
factories use Claude (default `claude-opus-5-5`; override with `ZF_MODEL`) to plan, write code,
repair failing tests, write copy, treatments and screenplays. Without a key (or with `--offline` /
`ZF_OFFLINE=1`) they produce deterministic templates, so everything runs offline and in CI.

## Layout

```
apps/zainlabs/       ZAIN LABS website (Next.js) + app (Expo) + shared content
apps/mahn-agent/     P01 product: FastAPI + Claude agent + web UI + Docker (own README, tests, ADRs)
src/zfactory/
  core/              LLM client, safe file writer, spec loader
  software_factory/  P1: planner -> builder -> test runner -> fixer loop
  app_factory/       P2: Expo / expo-router generator
  web_factory/       P2: static site generator + industry presets
  content_studio/    P3: film/video pre-production pipeline
  research/          P3: research project scaffolding
  cli.py             `zf` command
specs/               input specs (TOML) for each factory; copy one to start something new
ventures/            business plans/checklists: plastic-surgery, facials, studio, setups
research/            research projects created with `zf research new`
docs/                roadmap and architecture
tests/               pytest suite (runs offline)
```

Generated output goes to `out/` (git-ignored). Move anything you want to keep into its own folder or repo.

See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.
