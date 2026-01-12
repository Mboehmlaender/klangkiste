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
curl http://127.0.0.1:8000/status
```
- GUI API-Base pruefen:
  - `VITE_BOX_API_URL` oder Default `http://localhost:8000`

### Playback startet nicht
- Tags pruefen:
```
cat box/data/box.json
```
- Medien pruefen:
```
ls -la box/data/media
```
- Status pruefen:
```
curl http://127.0.0.1:8000/status
```

### Resume bleibt leer
- State pruefen:
```
cat box/data/state.json
```
- Playback mit `nfc_off` beenden.

### Setup UI nicht erreichbar
- Port 9000 frei?
- Box laeuft?

### Box wird nicht erkannt (Server)
- Server-URL in `box/data/box.json` pruefen (`server_url`).
- Server laeuft auf Port 7000?
- `server/data/boxes.json` pruefen.

### Box erscheint mehrfach
- `box_id` in `box/data/box.json` pruefen.
- Factory-Reset nur gezielt ausfuehren.

### Fingerprint aendert sich
- `secret_seed` in `box/data/secrets.enc` darf sich nicht aendern.
- `box/data/box.json` darf nicht geloescht werden.

### Pairing haengt
- `server/data/boxes.json` pruefen: state, api_token.
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
- Server-GUI (`/ui`) pruefen.
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
