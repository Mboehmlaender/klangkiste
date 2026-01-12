# Box-Lifecycle

## Zweck
Definiert Identitaet, WLAN-Status und Neustartverhalten der virtuellen Box.

## Voraussetzungen
- Box gestartet mit `python3 box/main.py run`

## Schritt-fuer-Schritt
### Box-Identitaet
- Wird beim ersten Start erzeugt, wenn `box/data/box.json` keine `box_id` enthaelt.
- Format: `klangkiste-<10 Zeichen a-z0-9>`
- Persistiert in `box/data/box.json`

### WLAN-Zustaende (logisch)
- `WIFI_UNCONFIGURED`: keine Profile gespeichert
- `WIFI_CONNECTING`: reserviert fuer spaeter (im Mock nicht aktiv)
- `WIFI_ONLINE`: Profil vorhanden und verbunden
- `WIFI_OFFLINE`: Profil vorhanden, aber nicht verbunden

### IP-Modell (informativ)
- Setup/AP-Modus: `192.168.4.1`
- Normalbetrieb: `127.0.0.1`

### Neustartverhalten
- Box laedt `box_id`, Resume-State und WLAN-Profile aus `box/data/`
- Resume und WLAN-Status bleiben erhalten

### Resets
- WLAN-Reset: nur WLAN-Profile loeschen (`wifi_reset`)
- Factory-Reset: `box/data/box.json`, `box/data/state.json`, `box/data/secrets.enc` loeschen

### Pairing-Status
- `UNPAIRED`: Box ist nicht gekoppelt
- `PAIRING_PENDING`: Box pollt Pairing-Status beim Server
- `PAIRED`: Box ist gekoppelt, API-Token vorhanden

## Checkliste
- ✅ Nach erstem Start existiert `box/data/box.json` mit `box_id`
- ✅ `GET /status` liefert `wifi_state` und `ip_address`
- ✅ WLAN-Reset setzt `wifi_state=WIFI_UNCONFIGURED`

## Troubleshooting
- `wifi_state` aendert sich nicht:
  - WLAN-Profil via Setup UI oder API hinzufuegen.
- `box_id` fehlt:
  - Schreibrechte fuer `box/data/box.json` pruefen.
