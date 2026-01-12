# Security & Storage

## Zweck
Beschreibt Datenablage, Verschluesselung und Key-Ableitung.

## Voraussetzungen
- Box mindestens einmal gestartet

## Schritt-fuer-Schritt
1) Box starten:
```
python3 box/main.py run
```
2) Datenordner pruefen:
```
ls -la box/data
```

## Datenstruktur
```
box/data/
├── box.json      # box_id, settings, tags (Klartext)
├── state.json    # resume, wifi state (Klartext)
├── media/        # Audiodateien
└── secrets.enc   # verschluesselte Secrets
```

## Klartext
- box_id
- Box-Name
- Lautstaerke
- Resume-Positionen
- Playback-State
- Media-Pfade
- UI-Zustaende

## Verschluesselt
- WLAN-Profile
- Spotify Tokens
- Server Tokens (api_token)
- secret_seed (Fingerprint-Seed)

## Key-Ableitung
- Key = PBKDF2-HMAC-SHA256(box_id + STATIC_SALT)
- Key wird nie gespeichert
- secrets.enc ist nicht zwischen Boxen austauschbar

## Reset-Verhalten
- WLAN-Reset: nur wifi_profiles entfernen
- Factory-Reset: `box/data/box.json`, `box/data/state.json`, `box/data/secrets.enc` loeschen

## Checkliste
- ✅ `secrets.enc` existiert nach WiFi/Spotify set
- ✅ `box.json` enthaelt `box_id`
- ✅ Keine Secrets in `/status`

## Troubleshooting
- secrets.enc fehlt:
  - WiFi/Spotify set ausfuehren.
- secrets.enc unlesbar nach Reset:
  - Neue box_id erzeugt neuen Key.
