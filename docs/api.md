# Box HTTP API

## Zweck
Stabiler Vertrag zwischen GUI/CLI und Box.
Die Box ist autoritativ, der Client sendet nur Commands und liest Status.

## Voraussetzungen
- Box laeuft auf `http://127.0.0.1:8000`

## Schritt-fuer-Schritt
### Status
```
curl http://127.0.0.1:8000/status
```

### Command (Beispiel)
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```

## GET /status
Felder:
- `box_id`: eindeutige Box-ID
- `pairing_state`: `UNPAIRED | PAIRING_PENDING | PAIRED`
- `wifi_state`: `WIFI_UNCONFIGURED | WIFI_CONNECTING | WIFI_ONLINE | WIFI_OFFLINE`
- `ip_address`: simulierte IP (`192.168.4.1` oder `127.0.0.1`)
- `connected_ssid`: verbundene SSID oder `null`
- `wifi_profiles_count`: Anzahl gespeicherter Profile
- `spotify_status`: `NOT_CONFIGURED | READY`
- `playback_state`:
  - `state`: `IDLE | PLAYING | PAUSED`
  - `active_uid`
  - `playback_root`
  - `current_file`
  - `file_index`
  - `position`
  - `duration`
  - `volume`
  - `last_error`

Beispielantwort:
```
{
  "box_id": "klangkiste-a9f3k7m2q8",
  "pairing_state": "UNPAIRED",
  "wifi_state": "WIFI_ONLINE",
  "ip_address": "127.0.0.1",
  "connected_ssid": "HomeWiFi",
  "wifi_profiles_count": 1,
  "spotify_status": "READY",
  "playback_state": {
    "state": "PLAYING",
    "active_uid": "UID_1",
    "playback_root": "media/book_1",
    "current_file": "/root/klangkiste/box/data/media/book_1/01.mp3",
    "file_index": 0,
    "position": 42,
    "duration": 180,
    "volume": 40,
    "last_error": null
  }
}
```

## POST /command
Request Body:
```
{
  "command": "nfc_on",
  "payload": { "uid": "UID_1" }
}
```

Unterstuetzte Commands:
- `nfc_on` `{ uid }`
- `nfc_off` `{ uid }`
- `play_pause`
- `next`
- `prev`
- `volume_up`
- `volume_down`
- `vol_up` (Alias)
- `vol_down` (Alias)
- `stop`
- `trigger_error` `{ type }`
- `wifi_add_profile` `{ ssid, password, priority? }`
- `wifi_reset`
- `spotify_set_tokens` `{ access_token, refresh_token, expires_at, account_id? }`
- `spotify_clear`

## Auth fuer Commands
- Vor Pairing sind nur diese Commands erlaubt:
  - `wifi_add_profile`, `wifi_reset`, `spotify_set_tokens`, `spotify_clear`
- Alle anderen Commands erfordern `X-API-Token` im Header.

Beispiel mit Token:\n```
curl -X POST http://127.0.0.1:8000/command \\
  -H "Content-Type: application/json" \\
  -H "X-API-Token: <api_token>" \\
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```

Beispiel: WLAN-Profil hinzufuegen
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_add_profile","payload":{"ssid":"HomeWiFi","password":"secret","priority":10}}'
```

Beispiel: Spotify Tokens setzen
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"spotify_set_tokens","payload":{"access_token":"a","refresh_token":"b","expires_at":123}}'
```

## Checkliste
- ✅ `GET /status` liefert JSON
- ✅ `POST /command` liefert `{ "ok": true }`
- ✅ Keine Secrets in `/status`

## Troubleshooting
- 400 Responses:
  - Payload pruefen (Pflichtfelder).
- CORS-Fehler:
  - API muss laufen und erreichbar sein.
