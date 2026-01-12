# GUI Control Panel

## Purpose
How to use the Vite-based GUI to control and observe the virtual box.

## Prerequisites
- Box running on `http://127.0.0.1:8000`
- GUI started (`npm run dev` or `./dev.sh`)

## Step-by-step
1) Open GUI:
```
http://127.0.0.1:5174
```
2) Click buttons to send commands.
3) Observe status updates (polling + refresh after command).

## Controls (current in GUI)
- Play / Pause
- Next
- Prev
- Vol +
- Vol -
- NFC UID_1 ON
- NFC UID_1 OFF
- Refresh Status

## Controls (available via API only)
- WiFi add/reset
- Spotify set/clear

Use API for those:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_add_profile","payload":{"ssid":"HomeWiFi","password":"secret","priority":10}}'
```

## Expected results
- After any button click, status refreshes within 1 second.
- `last_error` is visible if an error occurs.

## Checklist
- ✅ GUI loads and shows API base URL
- ✅ Status updates every 1s
- ✅ Clicking a button updates `/status`

## Troubleshooting
- GUI shows "Failed to fetch":
  - Check `VITE_BOX_API_URL`.
  - Verify Box API is running.
- Buttons have no effect:
  - Check the API command names in `docs/api.md`.
