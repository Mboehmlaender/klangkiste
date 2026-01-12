# GUI Control Panel

## Zweck
Nutzung des GUI Control Panels zur Steuerung und Beobachtung der virtuellen Box.

## Voraussetzungen
- Box laeuft auf `http://127.0.0.1:8000`
- GUI gestartet (`npm run dev` oder `./dev.sh`)
 - Bei gepaarter Box: `VITE_BOX_API_TOKEN` gesetzt

## Schritt-fuer-Schritt
1) GUI oeffnen:
```
http://127.0.0.1:5174
```
2) Buttons klicken, Status beobachten.

## Controls (im GUI vorhanden)
- Play / Pause
- Next
- Prev
- Vol +
- Vol -
- NFC UID_1 ON
- NFC UID_1 OFF
- Refresh Status

## Controls (nur API)
- WiFi add/reset
- Spotify set/clear

Beispiel via API:
```

## Auth-Token fuer GUI
- Nach Pairing: Token ueber Server-API oder Server-GUI ermitteln.\n- GUI mit Token starten:\n```\nVITE_BOX_API_TOKEN=<api_token> npm run dev\n```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_add_profile","payload":{"ssid":"HomeWiFi","password":"secret","priority":10}}'
```

## Erwartete Ergebnisse
- Nach jedem Klick wird der Status innerhalb von 1s aktualisiert.
- `last_error` wird angezeigt, wenn gesetzt.

## Checkliste
- ✅ GUI laedt und zeigt API-URL
- ✅ Status aktualisiert sich automatisch
- ✅ Buttons aendern `/status`

## Troubleshooting
- GUI zeigt "Failed to fetch":
  - `VITE_BOX_API_URL` pruefen.
  - Box API muss laufen.
- Buttons ohne Wirkung:
  - API-Command-Namen in `docs/api.md` pruefen.
