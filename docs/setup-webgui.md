# Setup WebGUI

## Purpose
Configure WiFi profiles in the virtual box without touching the API or CLI.

## Prerequisites
- Box running: `python3 box/main.py run`

## Step-by-step
1) Open the Setup UI:
```
http://127.0.0.1:9000/setup
```
2) Choose SSID and enter password.
3) Click "Verbinden".
4) Refresh `/status` to see `wifi_state` and `connected_ssid`.

## Fields
- SSID: drop-down from mock scan
- Password: free text

## Expected results
- WiFi profile is saved (encrypted)
- `wifi_state` becomes `WIFI_ONLINE`
- `connected_ssid` matches selected SSID

## Checklist
- ✅ Setup UI loads
- ✅ Submit stores a profile
- ✅ `/status` reflects `WIFI_ONLINE`

## Troubleshooting
- Setup UI not reachable:
  - Ensure Box is running and port `9000` is free.
- Submit does nothing:
  - Check Box logs for errors; secrets file must be writable.

## Notes
- Setup UI is write-enabled only when no profiles exist.
- When profiles exist, the page switches to read-only status.
