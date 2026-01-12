# Box HTTP API

## Purpose
Defines the stable contract between the GUI/CLI and the Box.
The Box is authoritative; the client only sends commands and reads status.

## Prerequisites
- Box running on `http://127.0.0.1:8000`

## Step-by-step
### Status
```
curl http://127.0.0.1:8000/status
```

### Command (example)
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```

## GET /status
Response fields:
- `box_id`: unique device ID
- `wifi_state`: `WIFI_UNCONFIGURED | WIFI_CONNECTING | WIFI_ONLINE | WIFI_OFFLINE`
- `ip_address`: simulated IP (`192.168.4.1` or `127.0.0.1`)
- `connected_ssid`: connected SSID or `null`
- `wifi_profiles_count`: number of stored profiles
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

Example response:
```
{
  "box_id": "klangkiste-a9f3k7m2q8",
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
Request body:
```
{
  "command": "nfc_on",
  "payload": { "uid": "UID_1" }
}
```

Supported commands:
- `nfc_on` `{ uid }`
- `nfc_off` `{ uid }`
- `play_pause`
- `next`
- `prev`
- `volume_up`
- `volume_down`
- `vol_up` (alias)
- `vol_down` (alias)
- `stop`
- `trigger_error` `{ type }`
- `wifi_add_profile` `{ ssid, password, priority? }`
- `wifi_reset`
- `spotify_set_tokens` `{ access_token, refresh_token, expires_at, account_id? }`
- `spotify_clear`

Example: add WiFi profile
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_add_profile","payload":{"ssid":"HomeWiFi","password":"secret","priority":10}}'
```

Example: set Spotify tokens
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"spotify_set_tokens","payload":{"access_token":"a","refresh_token":"b","expires_at":123}}'
```

## Checklist
- ✅ `GET /status` returns JSON
- ✅ `POST /command` returns `{ "ok": true }`
- ✅ No secrets appear in `/status`

## Troubleshooting
- 400 responses:
  - Check required fields in the payload.
- CORS errors:
  - Ensure Box API is running on the expected host/port.
