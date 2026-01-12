# Debugging Guide

## Purpose
Fast diagnosis guide: "If X happens, check Y" with separate paths for Simulation and Real Box.

## Prerequisites
- Box running (simulation or device)
- Access to `/status` and data files

## Step-by-step
Use the sections below by symptom.

## Simulation (IDE)
### If GUI shows "Failed to fetch"
- Check API is running:
```
curl http://127.0.0.1:8000/status
```
- Verify GUI API base:
  - `VITE_BOX_API_URL` or default `http://localhost:8000`

### If playback does not start
- Check tags:
```
cat box/data/box.json
```
- Check media files:
```
ls -la box/data/media
```
- Check `/status`:
```
curl http://127.0.0.1:8000/status
```

### If resume does not persist
- Check state file:
```
cat box/data/state.json
```
- Ensure playback was stopped via `nfc_off` or end-of-media.

### If setup UI not reachable
- Check port 9000 free.
- Ensure Box is running.

## Real Box (Hardware)
### If device not reachable in browser
- Ensure it is powered on and connected to the same network.
- Check the IP shown by your router.

### If NFC does nothing
- Confirm tag UID exists in `box.json`.
- Confirm NFC hardware is working (not implemented in code).

### If audio is silent
- Audio backend is mock in current code.
- Not testable with current code.

## Files to inspect
- `box/data/box.json`: identity, tags, settings
- `box/data/state.json`: resume and wifi state
- `box/data/secrets.enc`: encrypted secrets

## Status fields to watch
- `wifi_state`, `ip_address`, `connected_ssid`
- `playback_state.state`, `playback_state.active_uid`
- `playback_state.position`, `playback_state.file_index`
- `playback_state.last_error`

## Troubleshooting
- 400 from `/command`:
  - Check required payload fields in `docs/api.md`.
- No change after command:
  - Poll `/status` after sending.
