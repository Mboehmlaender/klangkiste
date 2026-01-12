# Acceptance-Tests

## Zweck
Konsistenter Testkatalog basierend auf dem aktuellen Code. Alle Tests trennen Simulation und Hardware. Nicht implementierte Punkte sind explizit markiert.

## Voraussetzungen
- Repo-Root
- Python 3
- Box API fuer Simulation: `python3 box/main.py run`
- GUI optional: `cd gui && npm run dev`

## Schritt-fuer-Schritt
Die Tests koennen einzeln oder der Reihe nach ausgefuehrt werden.

---

# Lokale Box-Tests (L1-L10)

## Test L1: Box-Start & box_id

1) Ziel
- box_id wird einmalig erzeugt und bleibt stabil.

2) Voraussetzungen
- Simulation: `box/data/box.json` kann fehlen.
- Hardware: frischer Start.

3) Durchfuehrung – Simulation / Emulation
- Box starten:
```
python3 box/main.py run
```
- Status lesen:
```
curl http://127.0.0.1:8000/status
```
- Datei pruefen:
```
cat box/data/box.json
```

4) Durchfuehrung – Reale Box (Hardware)
- Box einschalten.
- Statusseite/API pruefen (sofern erreichbar).

5) Erwartetes Ergebnis
- `box_id` im Format `klangkiste-<10 chars a-z0-9>`.
- `box/data/box.json` bleibt stabil ueber Neustarts.

6) Abweichungen / Fehlersuche
- `box_id` fehlt: Schreibrechte in `box/data/` pruefen.

---

## Test L2: WLAN-Ersteinrichtung (Setup WebGUI)

1) Ziel
- WLAN-Profil per Setup UI anlegen.

2) Voraussetzungen
- Keine WLAN-Profile gespeichert.

3) Durchfuehrung – Simulation / Emulation
- WLAN reset:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_reset"}'
```
- Setup UI oeffnen:
```
http://127.0.0.1:9000/setup
```
- SSID waehlen, Passwort eingeben, speichern.
- Status pruefen:
```
curl http://127.0.0.1:8000/status
```

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code: kein echter AP/WLAN-Stack.

5) Erwartetes Ergebnis
- `wifi_state = WIFI_ONLINE`
- `connected_ssid` gesetzt

6) Abweichungen / Fehlersuche
- Setup UI nicht erreichbar: Port 9000 frei, Box laeuft.

---

## Test L3: Persistenz & Neustart

1) Ziel
- Resume und WLAN-Profile bleiben ueber Neustart erhalten.

2) Voraussetzungen
- WLAN-Profil vorhanden.
- Playback einmal gestartet.

3) Durchfuehrung – Simulation / Emulation
- WLAN-Profil setzen:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_add_profile","payload":{"ssid":"HomeWiFi","password":"secret","priority":10}}'
```
- Playback starten:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```
- Playback stoppen:
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_off","payload":{"uid":"UID_1"}}'
```
- Box-Prozess neu starten.
- Status pruefen:
```
curl http://127.0.0.1:8000/status
```

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code: kein echter WLAN-Stack.

5) Erwartetes Ergebnis
- `box/data/state.json` enthaelt Resume.
- `box/data/secrets.enc` existiert.

6) Abweichungen / Fehlersuche
- Resume fehlt: `box/data/state.json` pruefen.

---

## Test L4: HTTP API Status & Commands

1) Ziel
- /status und /command liefern Antworten und aendern Status.

2) Voraussetzungen
- Box laeuft.

3) Durchfuehrung – Simulation / Emulation
- Status:
```
curl http://127.0.0.1:8000/status
```
- Command (vor Pairing -> 403 erwartet):
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"play_pause"}'
```

4) Durchfuehrung – Reale Box (Hardware)
- Gleich wie Simulation, sofern API erreichbar.

5) Erwartetes Ergebnis
- Vor Pairing: HTTP 403 fuer gesperrte Commands.
- Nach Pairing (mit Token): HTTP 200 und Status aktualisiert.

6) Abweichungen / Fehlersuche
- 400: Payload pruefen.

---

## Test L5: GUI-Steuerung

1) Ziel
- GUI steuert Box und zeigt Live-Status.

2) Voraussetzungen
- GUI laeuft auf 127.0.0.1:5174.

3) Durchfuehrung – Simulation / Emulation
- GUI oeffnen, Buttons klicken.
- Status aendert sich innerhalb von 1s.

4) Durchfuehrung – Reale Box (Hardware)
- GUI auf Box-IP ausrichten (spaeter).

5) Erwartetes Ergebnis
- `/status` aendert sich nach Commands.

6) Abweichungen / Fehlersuche
- GUI "Failed to fetch": `VITE_BOX_API_URL` pruefen.

---

## Test L6: Playback & NFC

1) Ziel
- NFC startet Playback.

2) Voraussetzungen
- Tags in `box/data/box.json`.
- Medien in `box/data/media`.

3) Durchfuehrung – Simulation / Emulation
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"nfc_on","payload":{"uid":"UID_1"}}'
```

4) Durchfuehrung – Reale Box (Hardware)
- NFC-Tag auflegen (spaeter).

5) Erwartetes Ergebnis
- `playback_state.state = PLAYING`

6) Abweichungen / Fehlersuche
- Tag fehlt: `box/data/box.json` pruefen.

---

## Test L7: Resume-Logik

1) Ziel
- Resume pro UID funktioniert.

2) Voraussetzungen
- Playback einmal gestartet.

3) Durchfuehrung – Simulation / Emulation
- `nfc_on UID_1`, warten, `nfc_off UID_1`, dann `nfc_on UID_1`.

4) Durchfuehrung – Reale Box (Hardware)
- NFC auflegen/abnehmen (spaeter).

5) Erwartetes Ergebnis
- Resume nutzt gespeicherte Position.

6) Abweichungen / Fehlersuche
- Resume = 0: `box/data/state.json` pruefen.

---

## Test L8: Rekursion & Ordnerstruktur

1) Ziel
- Rekursive Reihenfolge (DFS) ist korrekt.

2) Voraussetzungen
- Verschachtelte Ordner in `box/data/media`.

3) Durchfuehrung – Simulation / Emulation
- Tag auf `media/book_6` setzen, `nfc_on`.

4) Durchfuehrung – Reale Box (Hardware)
- Medienstruktur auf Box kopieren (spaeter).

5) Erwartetes Ergebnis
- DFS-Reihenfolge, lexikografisch.

6) Abweichungen / Fehlersuche
- Reihenfolge falsch: Ordnernamen pruefen.

---

## Test L9: Offline-Szenarien (Box intern)

1) Ziel
- WiFi/Spotify-Status reagieren auf Commands.

2) Voraussetzungen
- Box laeuft.

3) Durchfuehrung – Simulation / Emulation
- `wifi_reset` und `spotify_clear` ausfuehren.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code.

5) Erwartetes Ergebnis
- `wifi_state = WIFI_UNCONFIGURED`
- `spotify_status = NOT_CONFIGURED`

6) Abweichungen / Fehlersuche
- Status aendert sich nicht: `/status` pruefen.

---

## Test L10: Fehlerfaelle (Box intern)

1) Ziel
- Fehler setzen `last_error`.

2) Voraussetzungen
- Box laeuft.

3) Durchfuehrung – Simulation / Emulation
```
curl -X POST http://127.0.0.1:8000/command \
  -H "Content-Type: application/json" \
  -d '{"command":"trigger_error","payload":{"type":"uid_unmapped"}}'
```

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code.

5) Erwartetes Ergebnis
- `playback_state.last_error` gesetzt.

6) Abweichungen / Fehlersuche
- Kein Fehler sichtbar: `/status` pruefen.

---

# Server/Pairing-Tests (A-J)

## Test A: Box-Erststart & Identitaet

1) Ziel
- box_id wird einmalig erzeugt.

2) Voraussetzungen
- Box gestartet.

3) Durchfuehrung – Simulation / Emulation
- Siehe Test L1.

4) Durchfuehrung – Reale Box (Hardware)
- Siehe Test L1.

5) Erwartetes Ergebnis
- box_id stabil.

6) Abweichungen / Fehlersuche
- Siehe Test L1.

---

## Test B: Announce -> neue Box erscheint im Server

1) Ziel
- Box meldet sich beim Server und erscheint als UNPAIRED.

2) Voraussetzungen
- Server laeuft:
```
python3 server/main.py
```

3) Durchfuehrung – Simulation / Emulation
- Box starten:
```
python3 box/main.py run
```
- 30-60s warten (Announce-Intervall).
- Server-GUI oeffnen:
```
http://127.0.0.1:7000/ui
```
- Optional: Server-Storage pruefen:
```
cat server/data/boxes.json
```

4) Durchfuehrung – Reale Box (Hardware)
- Box einschalten.
- Server-GUI oeffnen, Box sollte erscheinen.

5) Erwartetes Ergebnis
- Box erscheint als UNPAIRED in der Server-GUI.
- `server/data/boxes.json` enthaelt `box_id` und `fingerprint`.

6) Abweichungen / Fehlersuche
- Keine Box sichtbar: Server-URL in `box/data/box.json` pruefen.
- Server nicht erreichbar: Server-Prozess/Port 7000 pruefen.

---

## Test C: Mehrere Boxen gleichzeitig

1) Ziel
- Mehrere Boxen werden separat erkannt.

2) Voraussetzungen
- Mehrere Boxen mit unterschiedlichen `box_id`.

3) Durchfuehrung – Simulation / Emulation
- Nicht testbar mit aktuellem Code: Box nutzt festen `box/data/`-Pfad und kann nicht mehrfach parallel laufen.

4) Durchfuehrung – Reale Box (Hardware)
- Zwei physische Boxen einschalten.
- Server-GUI zeigt beide UNPAIRED an.

5) Erwartetes Ergebnis
- Zwei Eintraege mit unterschiedlichen `box_id`.

6) Abweichungen / Fehlersuche
- Duplikate: `box_id` doppelt? Factory-Reset pruefen.

---

## Test D: Pairing-Freigabe ueber Server-GUI

1) Ziel
- Pairing liefert API-Token und Box wird PAIRED.

2) Voraussetzungen
- Box erscheint als UNPAIRED in `/ui`.

3) Durchfuehrung – Simulation / Emulation
- Server-GUI oeffnen:
```
http://127.0.0.1:7000/ui
```
- Button "Box hinzufuegen" klicken.
- API-Token via Server-API abrufen:
```
curl -X POST http://127.0.0.1:7000/api/boxes/pair   -H "Content-Type: application/json"   -d '{"box_id":"<box_id>"}'
```

4) Durchfuehrung – Reale Box (Hardware)
- Gleiches Vorgehen ueber Server-GUI.

5) Erwartetes Ergebnis
- Box erscheint in der gepaarten Liste.
- `api_token` wird an die Box ausgeliefert.

6) Abweichungen / Fehlersuche
- Pairing bleibt aus: `server/data/boxes.json` pruefen.

---

## Test E: Verhalten vor Pairing (keine Steuerung erlaubt)

1) Ziel
- Vor Pairing werden Steuerbefehle blockiert.

2) Voraussetzungen
- Box UNPAIRED.

3) Durchfuehrung – Simulation / Emulation
```
curl -i -X POST http://127.0.0.1:8000/command   -H "Content-Type: application/json"   -d '{"command":"play_pause"}'
```

4) Durchfuehrung – Reale Box (Hardware)
- Gleicher Request gegen Box-IP.

5) Erwartetes Ergebnis
- HTTP 403 "pairing required".

6) Abweichungen / Fehlersuche
- Wenn 200: Pairing-Status und API-Token pruefen.

---

## Test F: Verhalten nach Pairing

1) Ziel
- Nach Pairing sind Commands erlaubt (mit Token).

2) Voraussetzungen
- Box PAIRED und api_token vorhanden.

3) Durchfuehrung – Simulation / Emulation
```
curl -i -X POST http://127.0.0.1:8000/command   -H "Content-Type: application/json"   -H "X-API-Token: <api_token>"   -d '{"command":"play_pause"}'
```

4) Durchfuehrung – Reale Box (Hardware)
- Gleiches Vorgehen gegen Box-IP.

5) Erwartetes Ergebnis
- HTTP 200, Status aktualisiert.

6) Abweichungen / Fehlersuche
- 403: Token pruefen, Pairing-Status pruefen.

---

## Test G: Neustart vor/nach Pairing

1) Ziel
- Pairing-Status und Token bleiben ueber Neustart erhalten.

2) Voraussetzungen
- Box PAIRED.

3) Durchfuehrung – Simulation / Emulation
- Box-Prozess stoppen, neu starten.
- Mit Token Command senden.

4) Durchfuehrung – Reale Box (Hardware)
- Power cycle.

5) Erwartetes Ergebnis
- Box bleibt PAIRED, Token weiterhin gueltig.

6) Abweichungen / Fehlersuche
- Token fehlt: `box/data/secrets.enc` pruefen.

---

## Test H: Factory Reset -> neue Identitaet

1) Ziel
- Factory Reset erzeugt neue Identitaet.

2) Voraussetzungen
- Box einmal gestartet.

3) Durchfuehrung – Simulation / Emulation
- Box stoppen.
- Dateien loeschen:
```
rm -f box/data/box.json box/data/state.json box/data/secrets.enc
```
- Box neu starten.

4) Durchfuehrung – Reale Box (Hardware)
- Nicht testbar mit aktuellem Code: kein Reset-Mechanismus.

5) Erwartetes Ergebnis
- Neue `box_id`.

6) Abweichungen / Fehlersuche
- `box_id` bleibt gleich: Dateien nicht geloescht.

---

## Test I: Offline / Server nicht erreichbar

1) Ziel
- Box laeuft weiter ohne Server.

2) Voraussetzungen
- Box laeuft, Server gestoppt.

3) Durchfuehrung – Simulation / Emulation
- Server stoppen.
- Playback starten (mit Token falls gepairt).

4) Durchfuehrung – Reale Box (Hardware)
- Server vom Netz trennen.

5) Erwartetes Ergebnis
- Lokale Playback-Logik laeuft weiter.
- Server-GUI zeigt Box ggf. als OFFLINE nach Timeout.

6) Abweichungen / Fehlersuche
- Box stoppt: lokale Logs pruefen.

---

## Test J: Simulation vs. Hardware – Unterschiede

1) Ziel
- Unterschiede klar dokumentieren.

2) Voraussetzungen
- Box laeuft in Simulation.

3) Durchfuehrung – Simulation / Emulation
- WiFi/IP/Spotify/Audio sind Mock.
- Setup UI und API funktionieren lokal.

4) Durchfuehrung – Reale Box (Hardware)
- Echte Backends notwendig (nicht implementiert).

5) Erwartetes Ergebnis
- Simulation laeuft ohne Hardware.

6) Abweichungen / Fehlersuche
- Hardware-Backends fehlen.
