# Playback Testing

## Purpose
Test NFC playback, recursive media order, resume, and playback controls.

## Prerequisites
- Box running: `python3 box/main.py run`
- Media in `box/data/media/`

## Step-by-step
### NFC simulation
Start playback:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```
Stop playback:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_off","payload":{"uid":"UID_1"}}'
```

### Resume tests
1) `nfc_on UID_1`
2) Wait or use `tick` in CLI
3) `nfc_off UID_1`
4) `nfc_on UID_1` again
Expected: position resumes from saved state.

### Tag switching
1) `nfc_on UID_1`
2) `nfc_on UID_2`
3) `nfc_on UID_1`
Expected: UID_1 resumes from previous position.

### Recursive order
- Order is depth-first, folders first, lexicographic.
- Change folder names or nesting to see ordering changes.

### End of media behavior
- When the last file ends:
  - Playback stops
  - Position saved at end
  - State becomes IDLE

### Buttons
- `next`: file_index + 1
- `prev`: if position > 3s then position=0, else file_index - 1
- `play_pause`: toggle PLAYING/PAUSED
- `volume_up` / `volume_down`: change volume within 0..max

## Checklist
- ✅ Resume works for same UID
- ✅ Tag switching preserves per-UID resume
- ✅ Recursive order matches folder structure
- ✅ End-of-media stops playback and saves

## Troubleshooting
- No playback starts:
  - Check tags in `box/data/box.json`.
  - Ensure files exist under `box/data/media`.
- Duration is 0:
  - Filenames not matched; mock uses hash-based durations for unknown names.
