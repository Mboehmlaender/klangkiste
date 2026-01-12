# Box CLI Reference

## Purpose
List all CLI interactions available in the virtual box.

## Prerequisites
- Box code available in `box/`

## Step-by-step
### One-shot commands
Status:
```
python3 box/main.py status
```

Simulate NFC:
```
python3 box/main.py simulate-nfc UID_1
python3 box/main.py simulate-nfc-off UID_1
```

Manual tick:
```
python3 box/main.py tick 30
```

### Interactive run mode
```
python3 box/main.py run
```
Commands inside run mode:
```
status
nfc <UID>
nfc-off <UID>
tick <seconds>
play | pause
next | vor
prev | zurueck
vol-up | lauter
vol-down | leiser
help
exit | quit
```

## Checklist
- ✅ `status` prints runtime state
- ✅ `simulate-nfc` starts playback
- ✅ `run` accepts interactive commands

## Troubleshooting
- Commands not found:
  - Ensure you run from repo root or use full path to `box/main.py`.
- No playback:
  - Check tags in `box/data/box.json` and media under `box/data/media`.
