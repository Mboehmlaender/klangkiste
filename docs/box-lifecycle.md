# Box Lifecycle

## Purpose
Defines the virtual box lifecycle: identity, WiFi states, and restart behavior.

## Prerequisites
- Box started with `python3 box/main.py run`

## Step-by-step
### Box identity
- Generated on first start if `box/data/box.json` has no `box_id`.
- Format: `klangkiste-<10 chars a-z0-9>`
- Stored in `box/data/box.json`

### WiFi states (logical)
- `WIFI_UNCONFIGURED`: no profiles stored
- `WIFI_CONNECTING`: reserved for future; not emitted in mock
- `WIFI_ONLINE`: profile exists and mock is "connected"
- `WIFI_OFFLINE`: profile exists but not connected

### IP model (informational)
- Setup/AP mode: `192.168.4.1`
- Normal mode: `127.0.0.1`

### Restart behavior
- Box reloads `box_id`, resume state, and WiFi profiles from `box/data/`
- Playback resume and WiFi status are preserved

### Resets
- WiFi reset: clears WiFi profiles only (`wifi_reset` command)
- Factory reset: delete `box/data/box.json`, `box/data/state.json`, `box/data/secrets.enc`

## Checklist
- ✅ After first boot, `box/data/box.json` contains `box_id`
- ✅ `GET /status` returns `wifi_state` and `ip_address`
- ✅ WiFi reset clears profiles, `wifi_state=WIFI_UNCONFIGURED`

## Troubleshooting
- `wifi_state` not changing:
  - Add a WiFi profile via setup UI or API.
- Missing `box_id`:
  - Ensure `box/data/box.json` is writable.
