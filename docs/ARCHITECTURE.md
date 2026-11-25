# Architecture

Each factory is a pure function: `spec (TOML) + optional LLM -> files in an output dir`.

- **Specs** are plain TOML in `specs/`: easy to edit by hand, diff and review.
- **LLM** (`core/llm.py`) is one method, `complete(system, prompt, effort)`. `ClaudeLLM` streams from
  the Claude API with adaptive thinking and server-side refusal fallbacks. Tests pass a fake object
  with the same method.
- **Files** (`core/files.py`): models return `<file path="...">` blocks; the writer refuses any path
  outside the output dir.
- **Software factory loop**: plan (JSON) -> build (file blocks) -> `pytest` -> on failure send the
  files plus test output to the fixer, up to `--max-fix-iters` times -> `BUILD_REPORT.md`.
  Generated code runs on your machine: review specs and output before running untrusted builds.

Adding a new factory: create `src/zfactory/<name>/` with a `generate(spec, out_dir, llm=None)`,
add a sample spec in `specs/<name>/`, a subcommand in `cli.py`, an entry in `projects.toml`, and a test.
