# CLI-Referenz

## Zweck
Alle CLI-Interaktionen der virtuellen Box.

## Voraussetzungen
- Box-Code in `box/`

## Schritt-fuer-Schritt
### One-shot Commands
Status:
```
python3 box/main.py status
```

NFC simulieren:
```
python3 box/main.py simulate-nfc UID_1
python3 box/main.py simulate-nfc-off UID_1
```

Manuelles Tick:
```
python3 box/main.py tick 30
```

### Interaktiver Run-Modus
```
python3 box/main.py run
```
Commands im Run-Modus:
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

## Checkliste
- ✅ `status` gibt Runtime-State aus
- ✅ `simulate-nfc` startet Playback
- ✅ `run` akzeptiert interaktive Commands

## Troubleshooting
- Commands nicht gefunden:
  - Aus Repo-Root ausfuehren oder `box/main.py` voll referenzieren.
- Kein Playback:
- Tags in `box/data/box.json` und Medien im Backend unter `gui/backend/media` pruefen.
