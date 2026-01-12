# Offline Scenarios

## Purpose
Simulate online/offline behavior in the virtual box and verify status fields.

## Prerequisites
- Box running on `http://127.0.0.1:8000`

## Step-by-step
### WiFi offline (no profiles)
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_reset"}'
```
Expected:
- `wifi_state = WIFI_UNCONFIGURED`
- `connected_ssid = null`

### WiFi online
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_add_profile","payload":{"ssid":"HomeWiFi","password":"secret","priority":10}}'
```
Expected:
- `wifi_state = WIFI_ONLINE`
- `connected_ssid = HomeWiFi`

### Spotify unavailable
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"spotify_clear"}'
```
Expected:
- `spotify_status = NOT_CONFIGURED`

### Spotify ready
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"spotify_set_tokens","payload":{"access_token":"a","refresh_token":"b","expires_at":123}}'
```
Expected:
- `spotify_status = READY`

## Checklist
- ✅ WiFi reset shows UNCONFIGURED
- ✅ WiFi add profile shows ONLINE
- ✅ Spotify clear shows NOT_CONFIGURED
- ✅ Spotify set shows READY

## Troubleshooting
- Status not changing:
  - Ensure `/status` is polled after sending commands.
  - Check that Box is running and secrets file is writable.
