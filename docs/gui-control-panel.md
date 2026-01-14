# GUI Control Panel

## Zweck
Nutzung des Frontend Control Panels zur Steuerung und Beobachtung der Boxen ueber das Backend.

## Voraussetzungen
- Backend laeuft auf `http://127.0.0.1:5001`
- Frontend gestartet (`cd gui/frontend && npm run dev` oder `./dev.sh`)
- Box laeuft und meldet sich per Announce beim Backend

## Schritt-fuer-Schritt
1) GUI oeffnen:
```
http://127.0.0.1:5174
```
2) In "Neue Boxen" die Box auswaehlen und "Pairen" klicken.
3) In der Sidebar unter "Aktive Sessions" eine Box aktiv setzen (gilt fuer alle Seiten).
4) Status und Commands nutzen.

## Controls (im GUI vorhanden)
- Pairen (Button in "Neue Boxen")
- Statusanzeige (automatisch, Polling)
- Play/Pause, Next, Prev, Vol +/-, Stop
- NFC on/off (UID manuell eingeben; kein Auto-Fill)
- Unpair (Button in "Gepairte Boxen")
- Medien-Explorer (Ordner/Dateien, Upload, Rename, Move, Delete)
- Neuer/Leerer Tag erkannt (Panel)
  - Wenn keine UID erkannt: ID zuweisen & schreiben
  - Wenn UID erkannt, `known=false`: nur Medienordnerwahl + "Nur in die DB uebernehmen"
  - Medienordner zuordnen
  - Importierte Tag-IDs wiederverwenden
- Tags (Datenbank)
  - Alias setzen, Medium zuweisen, Tag loeschen
- Tag-Matrix (Sperren)
  - Tags pro Box sperren/entsperren
- Tags nur auf dieser Box
  - Lokale Tags ohne DB-Eintrag
  - Dateien anzeigen
  - Auf Server uebertragen (mit neuem Ordnernamen)
- Mobile: Aktive Sessions als Bottom-Sheet (Topbar-Icon)
- Hardware-UID (simuliert) wird im Tag-Panel und Live-Status angezeigt, wenn NFC on ohne UID genutzt wird

## Controls (nur Backend/API)
- WiFi add/reset
- Spotify set/clear

Beispiel via Backend-API (weitergeleitet an die Box):
```
curl -X POST http://127.0.0.1:5001/api/boxes/<box_id>/command \
  -H "Content-Type: application/json" \
  -d '{"command":"wifi_add_profile","payload":{"ssid":"HomeWiFi","password":"secret","priority":10}}'
```

## Erwartete Ergebnisse
- Nach jedem Klick wird der Status innerhalb von 1s aktualisiert.
- Fehler werden im GUI angezeigt.

## Checkliste
- ✅ GUI laedt und zeigt Backend-URL
- ✅ Neue Boxen erscheinen unter "Neue Boxen"
- ✅ Pairing verschiebt die Box in die gepaarte Liste
- ✅ Aktive Box ist global gesetzt (Sidebar "Aktive Sessions")
- ✅ Buttons aendern den `/status`

## Troubleshooting
- GUI zeigt "Failed to fetch":
  - Backend erreichbar? `http://127.0.0.1:5001/api/boxes`
  - Browser-Konsole pruefen.
- Buttons ohne Wirkung:
  - Box gepairt?
  - Backend-Logs pruefen.
