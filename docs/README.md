# Klangkiste Dev Playbook

## Purpose
This playbook documents the "virtual box" development environment. It is a complete, hardware-free simulation that runs entirely inside the repo and lets you test setup, playback, and API flows end-to-end.

Docs live in the repo-level `docs/` to keep all dev guidance in one predictable place for both Box and GUI contributors.

## Prerequisites
- Python 3
- Node.js + npm
- From repo root

## Step-by-step
Quickstart (3-5 minutes):
1) Start everything:
```
./dev.sh
```
2) Open the WiFi setup UI:
```
http://127.0.0.1:9000/setup
```
3) Add a WiFi profile and submit.
4) Check status:
```
curl http://127.0.0.1:8000/status
```
5) Start playback:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```

## Troubleshooting
- Box not starting:
  - Ensure dependencies are installed and ports 8000/9000 are free.
- GUI cannot reach API:
  - Check `VITE_BOX_API_URL` and Box logs.

## What Is Mock vs Real
- Mock: WiFi, IP, Spotify, audio, hardware. These are logical simulations only.
- Real: Box process, playback state machine, API, CLI, resume logic, media traversal.

## Link Index
- Dev workflow: `docs/dev-workflow.md`
- Box lifecycle: `docs/box-lifecycle.md`
- Setup WebGUI: `docs/setup-webgui.md`
- HTTP API contract: `docs/api.md`
- GUI control panel: `docs/gui-control-panel.md`
- Playback testing: `docs/playback-testing.md`
- Offline scenarios: `docs/offline-scenarios.md`
- Security & storage: `docs/security-storage.md`
- CLI reference: `docs/cli.md`
- Virtual box notes: `docs/virtual-box.md`
- Legacy storage notes: `docs/storage.md`
