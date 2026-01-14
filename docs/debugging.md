# Debugging-Guide

## Zweck
Schnelle Diagnose: "Wenn X passiert, pruefe Y" getrennt nach Simulation und Hardware.

## Voraussetzungen
- Box laeuft (Simulation oder Hardware)
- Zugriff auf `/status` und Datenfiles

## Schritt-fuer-Schritt
Nutze die Sektionen nach Symptomen.

## Simulation (IDE)
### GUI zeigt "Failed to fetch"
- API pruefen:
```
curl http://127.0.0.1:5001/api/boxes
```
- GUI API-Base pruefen:
  - GUI nutzt `/api/...` und Vite-Proxy.
  - `VITE_BACKEND_URL` zeigt auf das Backend (ohne `/api`).
  - Reverse-Proxy: `/api` muss auf Port 5001 zeigen (ohne doppeltes `/api`).

### Playback startet nicht
- Tags pruefen:
```
cat box/data/box.json
```
- Medienkatalog pruefen:
```
ls -la gui/backend/media
```
- Status pruefen:
```
curl http://127.0.0.1:8000/status
```
- Tag lokal vorhanden, aber nicht in DB:
  - GUI: "Tags nur auf dieser Box" pruefen.
  - Import ueber "Auf Server uebertragen".

### Resume bleibt leer
- State pruefen:
```
cat box/data/state.json
```
- Playback mit `nfc_off` beenden.

### Setup UI nicht erreichbar
- Port 9000 frei?
- Box laeuft?

### Box wird nicht erkannt (Backend)
- Server-URL in `box/data/box.json` pruefen (`server_url`).
- Backend laeuft auf Port 5001?
- `gui/backend/db/klangkiste.sqlite` pruefen.

### Box erscheint mehrfach
- `box_id` in `box/data/box.json` pruefen.
- Factory-Reset nur gezielt ausfuehren.

### Fingerprint aendert sich
- `secret_seed` in `box/data/secrets.enc` darf sich nicht aendern.
- `box/data/box.json` darf nicht geloescht werden.

### Pairing haengt
- `gui/backend/db/klangkiste.sqlite` pruefen: state, api_token.
- Box-Status: `pairing_state` in `/status` pruefen.

## Reale Box (Hardware)
### Box nicht im Browser erreichbar
- Stromversorgung ok?
- Im gleichen Netzwerk?
- Router-IP pruefen.

### NFC reagiert nicht
- UID in `box.json` vorhanden?
- NFC-Hardware (nicht implementiert) pruefen.

### Audio bleibt stumm
- Audio-Backend ist Mock im aktuellen Code.
- Nicht testbar mit aktuellem Code.

### Box wird nicht erkannt / erscheint mehrfach / Fingerprint wechselt / Pairing haengt
- Frontend-GUI (`http://127.0.0.1:5174`) pruefen.
- Box-IP/Server-IP/VLAN pruefen.
- Box-Logs pruefen.

## Files
- `box/data/box.json`: Identitaet, Tags, Settings
- `box/data/state.json`: Resume und WiFi-State
- `box/data/secrets.enc`: verschluesselte Secrets

## Statusfelder
- `wifi_state`, `ip_address`, `connected_ssid`
- `playback_state.state`, `playback_state.active_uid`
- `playback_state.position`, `playback_state.file_index`
- `playback_state.last_error`

## Troubleshooting
- 400 von `/command`:
  - Payload pruefen (Pflichtfelder).
- Keine Aenderung nach Command:
  - `/status` danach erneut abrufen.
