# Setups

## Dev setup
```bash
git clone https://github.com/za136/zainulabedin && cd zainulabedin
python -m venv .venv && source .venv/bin/activate
pip install -e ".[llm,dev]"
export ANTHROPIC_API_KEY=...   # optional; without it everything runs in template mode
pytest
```
Mobile apps also need Node.js 20+ (`npx expo start`).

## Studio setup (checklist)
- [ ] Camera, lenses, support
- [ ] Lighting kit
- [ ] Sound: recorder, boom, lavs
- [ ] Edit / color / sound workstation and storage plan

## Ops setup
- [ ] Domains and hosting for generated sites (any static host: GitHub Pages, Netlify, Cloudflare Pages)
- [ ] Apple Developer + Google Play accounts for apps (EAS build)
- [ ] Form / booking backend
