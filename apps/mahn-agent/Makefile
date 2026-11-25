PY ?= python3
VENV ?= .venv
BIN = $(VENV)/bin

.PHONY: install test seed run serve demo eval docker clean

install:            ## create venv and install with dev + llm extras
	$(PY) -m venv $(VENV)
	$(BIN)/pip install -e ".[dev,llm]"

test:               ## run the test suite (offline)
	$(BIN)/pytest -q

seed:               ## write fresh demo ERP data and reset the local DB
	$(BIN)/mahn-agent seed --reset

run:                ## one dunning run (sync, match payments, draft reminders)
	$(BIN)/mahn-agent run

serve:              ## web UI + API on http://localhost:8000
	$(BIN)/mahn-agent serve --port 8000

demo: seed run serve   ## seed, run once, start the UI

eval:               ## drafting eval (uses Claude if ANTHROPIC_API_KEY is set)
	$(BIN)/mahn-agent eval

docker:             ## full stack: app + Postgres + Mailpit
	docker compose up --build

clean:
	rm -rf data/*.db data/demo_erp.json data/outbox
