# Playback-Tests

## Zweck
Tests fuer NFC-Playback, Rekursion, Resume und Buttons.

## Voraussetzungen
- Box laeuft: `python3 box/main.py run`
- Medienkatalog unter `gui/backend/media/`
- Box spielt nur Medien, die ueber Tags zugeordnet wurden.

## Schritt-fuer-Schritt
### NFC-Simulation
Start:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```
Stop:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_off","payload":{"uid":"UID_1"}}'
```

### Resume
1) `nfc_on UID_1`
2) Warten (Auto-Tick)
3) `nfc_off UID_1`
4) `nfc_on UID_1`
Erwartung: Resume nutzt gespeicherte Position.

### Tag-Wechsel
1) `nfc_on UID_1`
2) `nfc_on UID_2`
3) `nfc_on UID_1`
Erwartung: UID_1 resumed.

### Rekursive Reihenfolge
- Ordner werden DFS traversiert (Unterordner zuerst, dann Dateien).
- Sortierung lexikografisch.

### Ende-des-Mediums
- Letzte Datei endet -> Playback stoppt, Position wird am Ende gespeichert.

### Buttons
- `next`: file_index + 1
- `prev`: wenn position > 3s -> position=0, sonst file_index - 1
- `play_pause`: toggelt PLAYING/PAUSED
- `volume_up` / `volume_down`: innerhalb 0..max

## Checkliste
- ✅ Resume pro UID
- ✅ Tag-Wechsel speichert und resumed
- ✅ Rekursion entspricht Ordnerstruktur
- ✅ Ende-des-Mediums stoppt und speichert

## Troubleshooting
- Kein Playback:
  - Tags in `box/data/box.json` pruefen.
- Medienordner im Backend pruefen (`gui/backend/media`).
- Duration = 0:
  - Unbekannte Dateinamen -> Hash-Dauer, nicht 0.
