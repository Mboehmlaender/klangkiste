# Klangkiste Dev-Playbook

## Zweck
Dieses Playbook dokumentiert die "virtuelle Box"-Entwicklungsumgebung. Es ist eine vollstaendige, hardwarefreie Simulation, die komplett im Repo laeuft und Setup-, Playback- und API-Flows end-to-end testbar macht.

Die Doku liegt bewusst im Repo-weiten `docs/`-Ordner, damit Box- und GUI-Entwickler einen gemeinsamen Einstiegspunkt haben.

## Voraussetzungen
- Python 3
- Node.js + npm
- Aus dem Repo-Root ausfuehren

## Schritt-fuer-Schritt
Quickstart (3-5 Minuten):
1) Alles starten:
```
./dev.sh
```
2) Setup-WebGUI oeffnen:
```
http://127.0.0.1:9000/setup
```
3) WLAN-Profil eintragen und speichern.
4) Status pruefen:
```
curl http://127.0.0.1:8000/status
```
5) Playback starten:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```

## Troubleshooting
- Box startet nicht:
  - Pruefe Abhaengigkeiten und ob Ports 8000/9000 frei sind.
- GUI erreicht API nicht:
  - Pruefe `VITE_BOX_API_URL` und Box-Logs.

## Was ist Mock vs. real
- Mock: WLAN, IP, Spotify, Audio, Hardware. Diese Backends sind logische Simulationen.
- Real: Box-Prozess, Playback-State-Machine, API, CLI, Resume-Logik, Media-Traversal.

## Link-Index
- Dev-Workflow: `docs/dev-workflow.md`
- Box-Lifecycle: `docs/box-lifecycle.md`
- Setup-WebGUI: `docs/setup-webgui.md`
- HTTP-API Vertrag: `docs/api.md`
- GUI Control Panel: `docs/gui-control-panel.md`
- Playback-Tests: `docs/playback-testing.md`
- Offline-Szenarien: `docs/offline-scenarios.md`
- Security & Storage: `docs/security-storage.md`
- CLI-Referenz: `docs/cli.md`
- Acceptance-Tests: `docs/acceptance-tests.md`
- Debugging-Guide: `docs/debugging.md`
- Virtual-Box-Notizen: `docs/virtual-box.md`
- Legacy-Storage-Notizen: `docs/storage.md`
