# Offline-Szenarien

## Zweck
Offline/Online-Verhalten in der virtuellen Box pruefen.

## Voraussetzungen
- Box laeuft auf `http://127.0.0.1:8000`

## Schritt-fuer-Schritt
### WLAN offline (keine Profile)
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_reset"}'
```
Erwartung:
- `wifi_state = WIFI_UNCONFIGURED`
- `connected_ssid = null`

### WLAN online
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_add_profile","payload":{"ssid":"HomeWiFi","password":"secret","priority":10}}'
```
Erwartung:
- `wifi_state = WIFI_ONLINE`
- `connected_ssid = HomeWiFi`

### Spotify nicht konfiguriert
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"spotify_clear"}'
```
Erwartung:
- `spotify_status = NOT_CONFIGURED`

### Spotify bereit
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"spotify_set_tokens","payload":{"access_token":"a","refresh_token":"b","expires_at":123}}'
```
Erwartung:
- `spotify_status = READY`

## Checkliste
- ✅ WLAN-Reset zeigt UNCONFIGURED
- ✅ WLAN-Profil zeigt ONLINE
- ✅ Spotify clear zeigt NOT_CONFIGURED
- ✅ Spotify set zeigt READY

## Troubleshooting
- Status aendert sich nicht:
  - `/status` nach Commands abfragen.
  - Schreibrechte auf `box/data/secrets.enc` pruefen.
