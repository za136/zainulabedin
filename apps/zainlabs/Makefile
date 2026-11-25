# ZAIN LABS platform: one-command setup and checks. Run from apps/zainlabs.
PY ?= python3
VENV ?= api/.venv

.PHONY: install dev api web mobile test e2e guard openapi export

install:          ## install backend (venv) and all Node packages
	$(PY) -m venv $(VENV) && $(VENV)/bin/pip install -e "api[dev]"
	cd content && npm install && cd ../web && npm install && cd ../mobile && npm install

api:              ## backend on http://localhost:8100 (docs: /docs)
	cd api && .venv/bin/zainlabs-api serve --port 8100 --reload

web:              ## website on http://localhost:3000 (proxies /api to :8100)
	cd web && npm run dev

dev:              ## backend + website together (Ctrl+C stops both)
	$(MAKE) -j2 api web

mobile:           ## Expo dev server (scan QR with Expo Go; set EXPO_PUBLIC_API_URL to your LAN IP:8100)
	cd mobile && npx expo start

export:           ## after editing content/src: regenerate content.json
	cd content && npm run export && npm run check

openapi:          ## after changing the backend contract: regenerate api/openapi.json
	cd api && .venv/bin/zainlabs-api openapi > openapi.json

guard:            ## anti-hallucination rules
	node scripts/guard.mjs

test: guard       ## everything except browser tests
	cd content && npm run check
	cd api && .venv/bin/python -m pytest -q
	cd web && npx tsc --noEmit && npx next build
	cd mobile && npx tsc --noEmit && EXPO_OFFLINE=1 npx expo export --platform web --output-dir /tmp/zl-export

e2e:              ## browser smoke tests (needs a build; first time: cd web && npx playwright install chromium)
	cd web && npm run test:e2e
