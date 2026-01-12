# Setup-WebGUI

## Zweck
WLAN-Profile in der virtuellen Box konfigurieren, ohne CLI oder API.

## Voraussetzungen
- Box laeuft: `python3 box/main.py run`

## Schritt-fuer-Schritt
1) Setup-UI oeffnen:
```
http://127.0.0.1:9000/setup
```
2) SSID auswaehlen, Passwort eingeben.
3) "Verbinden" klicken.
4) Status pruefen:
```
curl http://127.0.0.1:8000/status
```

## Felder
- SSID: Dropdown aus dem Mock-Scan
- Passwort: Freitext

## Erwartete Ergebnisse
- WLAN-Profil wird verschluesselt gespeichert
- `wifi_state` wird `WIFI_ONLINE`
- `connected_ssid` passt zur Auswahl

## Checkliste
- ✅ Setup-UI laedt
- ✅ Submit speichert Profil
- ✅ `/status` zeigt `WIFI_ONLINE`

## Troubleshooting
- Setup-UI nicht erreichbar:
  - Port 9000 frei? Box laeuft?
- Submit ohne Wirkung:
  - Logs pruefen, `box/data/secrets.enc` muss schreibbar sein.

## Hinweise
- Setup-UI ist nur schreibend, wenn keine Profile existieren.
- Bei vorhandenen Profilen ist die Seite read-only.
