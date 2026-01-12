# Acceptance Tests

## Purpose
Comprehensive test catalog derived from the current codebase. Each test is runnable in Simulation and described for Real Box hardware. Behaviors not implemented are explicitly marked.

## Prerequisites
- Repo root
- Python 3
- Box API running for Simulation: `python3 box/main.py run`
- GUI optional: `cd gui && npm run dev`

## Step-by-step
Use the tests below in order or individually.

---

## Test A: Box-Start & Identitaet (box_id)

1) Goal
- Verify box_id is created once and persists.

2) Preconditions
- Simulation: `box/data/box.json` may be missing.
- Real Box: storage is empty or fresh install.

3) Procedure – Simulation / Emulation
- Start Box:
```
python3 box/main.py run
```
- Check box_id in API:
```
curl http://127.0.0.1:8000/status
```
- Inspect file:
```
cat box/data/box.json
```

4) Procedure – Real Box (Hardware)
- Power on device.
- Open status UI (if available) or API endpoint.

5) Expected Result
- `/status` contains `box_id` with format `klangkiste-<10 chars a-z0-9>`.
- `box/data/box.json` contains `box_id` and is stable across restarts.

6) Deviations / Troubleshooting
- `box_id` missing: check write permissions for `box/data/`.
- `box_id` changes: indicates manual deletion of `box/data/box.json`.

---

## Test B: WLAN-Ersteinrichtung (Setup WebGUI)

1) Goal
- Configure WiFi profile via setup UI and reach WIFI_ONLINE.

2) Preconditions
- No WiFi profiles stored.

3) Procedure – Simulation / Emulation
- Reset WiFi profiles:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_reset"}'
```
- Open Setup UI:
```
http://127.0.0.1:9000/setup
```
- Choose SSID and enter password, click "Verbinden".
- Check status:
```
curl http://127.0.0.1:8000/status
```

4) Procedure – Real Box (Hardware)
- Power on device.
- Connect to device AP SSID (not implemented in code).
- Open setup page and submit WiFi credentials.

5) Expected Result
- `wifi_state = WIFI_ONLINE`
- `connected_ssid` matches selected SSID
- `wifi_profiles_count` increments

6) Deviations / Troubleshooting
- Setup UI unreachable: port 9000 occupied or Box not running.
- Not testable with current code: AP SSID and real WiFi connect.

---

## Test C: Persistenz & Neustart

1) Goal
- Ensure resume state and WiFi profiles persist across restarts.

2) Preconditions
- At least one WiFi profile stored.
- Playback started once.

3) Procedure – Simulation / Emulation
- Add WiFi profile (if needed):
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_add_profile","payload":{"ssid":"HomeWiFi","password":"secret","priority":10}}'
```
- Start playback:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```
- Stop playback:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_off","payload":{"uid":"UID_1"}}'
```
- Restart Box process.
- Check status:
```
curl http://127.0.0.1:8000/status
```

4) Procedure – Real Box (Hardware)
- Start playback via NFC.
- Power cycle device.
- Verify WiFi profile and resume state persist.

5) Expected Result
- `box/data/state.json` contains `resume`.
- `box/data/secrets.enc` exists and contains profiles (encrypted).
- After restart, `wifi_state` is not UNCONFIGURED.

6) Deviations / Troubleshooting
- Resume missing: check `box/data/state.json`.
- WiFi profiles missing: check `box/data/secrets.enc` creation.

---

## Test D: HTTP API Status & Commands

1) Goal
- Verify /status and /command are functional.

2) Preconditions
- Box running.

3) Procedure – Simulation / Emulation
- Status:
```
curl http://127.0.0.1:8000/status
```
- Command:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"play_pause"}'
```

4) Procedure – Real Box (Hardware)
- Same as above once API is reachable in real network.

5) Expected Result
- HTTP 200 responses.
- `/status` fields updated after commands.

6) Deviations / Troubleshooting
- CORS errors: ensure API is running.
- 400 errors: check payload requirements.

---

## Test E: GUI-Steuerung

1) Goal
- Verify GUI can control playback and display status.

2) Preconditions
- Box running on 127.0.0.1:8000.
- GUI running on 127.0.0.1:5174.

3) Procedure – Simulation / Emulation
- Open GUI:
```
http://127.0.0.1:5174
```
- Click Play / Pause, Next, Prev, Vol +, Vol -.
- Click NFC UID_1 ON/OFF.
- Watch status refresh (polling every 1s).

4) Procedure – Real Box (Hardware)
- Use GUI from another device pointing to Box IP.

5) Expected Result
- `/status` changes after each button.
- GUI shows updated status and last_error if present.

6) Deviations / Troubleshooting
- GUI shows "Failed to fetch": verify VITE_BOX_API_URL.

---

## Test F: Playback & NFC

1) Goal
- Verify NFC starts playback from tags.

2) Preconditions
- Tags exist in `box/data/box.json`.
- Media exists under `box/data/media`.

3) Procedure – Simulation / Emulation
- Start playback:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```
- Observe `/status`:
```
curl http://127.0.0.1:8000/status
```

4) Procedure – Real Box (Hardware)
- Place NFC tag mapped to UID_1.

5) Expected Result
- `playback_state.state = PLAYING`
- `active_uid = UID_1`

6) Deviations / Troubleshooting
- No playback: check tags in `box/data/box.json` and files in `box/data/media`.

---

## Test G: Resume-Logik

1) Goal
- Resume picks up last file index and position per UID.

2) Preconditions
- Playback started at least once for UID_1.

3) Procedure – Simulation / Emulation
- Start playback, wait ~5s.
- Stop with `nfc_off`.
- Start again with `nfc_on`.

4) Procedure – Real Box (Hardware)
- Place NFC tag, remove, place again.

5) Expected Result
- Resume uses stored `file_index` and `position`.
- `box/data/state.json` contains resume for UID_1.

6) Deviations / Troubleshooting
- Resume resets to 0: check `state.json` and path changes.

---

## Test H: Ordner- & Rekursionslogik

1) Goal
- Verify recursive ordering (DFS, folders first, lexicographic).

2) Preconditions
- Nested media structure in `box/data/media`.

3) Procedure – Simulation / Emulation
- Create nested structure in `box/data/media/book_6/CD1/...`.
- Point a tag to `media/book_6` in `box/data/box.json`.
- Start playback with `nfc_on`.

4) Procedure – Real Box (Hardware)
- Copy nested folders to the device media path.
- Start playback via NFC.

5) Expected Result
- Files play in DFS order: subfolders sorted, then files.

6) Deviations / Troubleshooting
- Ordering unexpected: check folder names and lexicographic sort.

---

## Test I: Offline-Szenarien (Box intern)

1) Goal
- Verify WiFi and Spotify states in offline/online flows.

2) Preconditions
- Box running.

3) Procedure – Simulation / Emulation
- WiFi reset:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_reset"}'
```
- Spotify clear:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"spotify_clear"}'
```

4) Procedure – Real Box (Hardware)
- Not testable with current code: real network loss and Spotify connectivity.

5) Expected Result
- `wifi_state = WIFI_UNCONFIGURED`
- `spotify_status = NOT_CONFIGURED`

6) Deviations / Troubleshooting
- Status unchanged: ensure you read `/status` after command.

---

## Test J: Fehlerfaelle (Box intern)

1) Goal
- Verify error sound and error reporting.

2) Preconditions
- Box running.

3) Procedure – Simulation / Emulation
- Trigger error:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"trigger_error","payload":{"type":"uid_unmapped"}}'
```
- Check `/status` for `last_error`.

4) Procedure – Real Box (Hardware)
- Not testable with current code: actual error sound output.

5) Expected Result
- `playback_state.last_error` equals error type.
- Box returns to `IDLE` after error.

6) Deviations / Troubleshooting
- No error shown: verify `/status` and that errors are not cleared automatically.

---

## Test K: Announce -> neue Box erscheint im Server

1) Ziel
- Box meldet sich beim Server und erscheint als UNPAIRED / neue Box.

2) Voraussetzungen
- Simulation: Server-Komponente vorhanden und laeuft.
- Real Box: Server erreichbar im Netzwerk.

3) Durchfuehrung – Simulation / Emulation
- Nicht testbar mit aktuellem Code: Box sendet keine Announce-Requests.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code: Announce-Logik ist nicht implementiert.

5) Erwartetes Ergebnis
- Nicht testbar mit aktuellem Code.

6) Abweichungen / Fehlersuche
- Wenn implementiert: Pruefe Server-Logs, API-Endpunkte und Box-Statusfelder.

---

## Test L: Mehrere Boxen gleichzeitig

1) Ziel
- Mehrere Boxen werden als separate, unbekannte Boxen erkannt.

2) Voraussetzungen
- Simulation: Mehrere Box-Prozesse mit unterschiedlichen `box_id`.

3) Durchfuehrung – Simulation / Emulation
- Nicht testbar mit aktuellem Code: Announce/Server-Erkennung fehlt.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code.

5) Erwartetes Ergebnis
- Nicht testbar mit aktuellem Code.

6) Abweichungen / Fehlersuche
- Wenn implementiert: Pruefe Duplikate anhand `box_id` und `fingerprint`.

---

## Test M: Pairing-Freigabe ueber Server-GUI

1) Ziel
- Box wird nach Freigabe gepairt und erhaelt API-Token.

2) Voraussetzungen
- Simulation: Server-GUI und Pairing-Endpunkte implementiert.

3) Durchfuehrung – Simulation / Emulation
- Nicht testbar mit aktuellem Code: Pairing-Flow fehlt.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code.

5) Erwartetes Ergebnis
- Nicht testbar mit aktuellem Code.

6) Abweichungen / Fehlersuche
- Wenn implementiert: Pruefe Token-Speicherung in `box/data/secrets.enc`.

---

## Test N: Verhalten vor Pairing (keine Steuerung erlaubt)

1) Ziel
- Vor Pairing sind Steuerbefehle blockiert.

2) Voraussetzungen
- Server-Integration und Auth-Checks vorhanden.

3) Durchfuehrung – Simulation / Emulation
- Nicht testbar mit aktuellem Code: kein Auth/Pairing implementiert.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code.

5) Erwartetes Ergebnis
- Nicht testbar mit aktuellem Code.

6) Abweichungen / Fehlersuche
- Wenn implementiert: Pruefe API-Responses (401/403) und Server-Logs.

---

## Test O: Verhalten nach Pairing

1) Ziel
- Nach Pairing sind Steuerbefehle erlaubt und Box reagiert.

2) Voraussetzungen
- Pairing-Flow implementiert.

3) Durchfuehrung – Simulation / Emulation
- Nicht testbar mit aktuellem Code.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code.

5) Erwartetes Ergebnis
- Nicht testbar mit aktuellem Code.

6) Abweichungen / Fehlersuche
- Wenn implementiert: Pruefe Token in `secrets.enc` und Server-GUI Status.

---

## Test P: Neustart vor/nach Pairing

1) Ziel
- Box behaelt Pairing-Status und Token ueber Neustarts.

2) Voraussetzungen
- Pairing implementiert.

3) Durchfuehrung – Simulation / Emulation
- Nicht testbar mit aktuellem Code.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code.

5) Erwartetes Ergebnis
- Nicht testbar mit aktuellem Code.

6) Abweichungen / Fehlersuche
- Wenn implementiert: Pruefe `secrets.enc` vor/nach Neustart.

---

## Test Q: Factory Reset -> neue Identitaet

1) Ziel
- Factory Reset loescht box_id und erzeugt neue Identitaet beim naechsten Start.

2) Voraussetzungen
- Box laeuft einmalig und `box/data/` existiert.

3) Durchfuehrung – Simulation / Emulation
- Stoppe Box.
- Loesche folgende Dateien:
```
rm -f box/data/box.json box/data/state.json box/data/secrets.enc
```
- Starte Box neu:
```
python3 box/main.py run
```
- Pruefe `/status`.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code: kein Factory-Reset-Mechanismus implementiert.

5) Erwartetes Ergebnis
- Neue `box_id` erscheint in `/status`.

6) Abweichungen / Fehlersuche
- `box_id` bleibt gleich: Dateien wurden nicht geloescht.

---

## Test R: Offline / Server nicht erreichbar

1) Ziel
- Box laeuft weiter, wenn Server nicht erreichbar ist.

2) Voraussetzungen
- Server-Integration implementiert.

3) Durchfuehrung – Simulation / Emulation
- Nicht testbar mit aktuellem Code: keine Server-Kommunikation.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code.

5) Erwartetes Ergebnis
- Nicht testbar mit aktuellem Code.

6) Abweichungen / Fehlersuche
- Wenn implementiert: pruefe lokale Funktionen (Playback, NFC) laufen weiter.

---

## Test S: Simulation vs. Hardware – Unterschiede

1) Ziel
- Dokumentiere, was real vs. mock ist.

2) Voraussetzungen
- Box laeuft in Simulation.

3) Durchfuehrung – Simulation / Emulation
- Beachte: WiFi/IP/Spotify/Audio sind Mock.
- Setup UI und API funktionieren lokal.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code: Hardware-Backends fehlen.

5) Erwartetes Ergebnis
- Simulation laeuft ohne Hardware.
- Hardware-Backends koennen spaeter ersetzt werden.

6) Abweichungen / Fehlersuche
- Wenn Hardware genutzt wird, fehlen Implementierungen.
