# P11 · Lenovo Linux studio workstation: Handoff

> Factory: 06 · Infrastructure & Hardware · Status: To do · Last updated: 2026-11-25 by Claude Code

## Summary
Back up the Lenovo 20HGS0Y91D (i5-7300U, ~16 GB RAM, Intel HD 620, 256 GB SSD), install a Debian-based Linux, and set up the content + dev toolchain so every repo in this project can be run and tested locally.

## Current status
Not started (owner's hardware). Toolchain list prepared below and in `docs/testing/mobile-and-web.md`.

## Where things are
- Drive: "P11 · Lenovo Linux studio workstation — Project Brief", "Laptops, Specs & Linux Studio Setup", "Gemini-only setup notes", Master Tracker tab "Hardware".

## How to run
Toolchain to install after Linux (all free):
```bash
sudo apt install -y git python3 python3-venv make curl ffmpeg docker.io docker-compose-plugin
# Node.js 22 LTS (e.g. via nvm), then:  npm i -g eas-cli
# Optional: Android Studio (emulator; slow on a 2-core CPU, prefer a real phone with Expo Go)
```

## How to test
From the repo root: `scripts/verify.sh` must pass on the new machine (it runs every test and build).

## Decisions
- Debian-based distro (brief) · exact distro not chosen yet.

## Open questions and blockers
- Distro choice (Debian 13, Ubuntu LTS, Linux Mint) · owner: Zain.
- 256 GB SSD is small for video work: use the 1 TB laptop via Syncthing (Hardware tab).

## Next actions
1. Back up files to Drive and the 1 TB laptop.
2. Pick the distro and install it.
3. Install the toolchain above, clone this repo, run `scripts/verify.sh`, and record the result here.
4. Run a first end-to-end test video with the studio pipeline.

## Session log
- 2026-11-25 · Claude Code · wrote this handoff and toolchain list · nothing run on the owner's hardware.
