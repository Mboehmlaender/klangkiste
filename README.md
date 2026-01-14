# Klangkiste

Klangkiste ist eine DIY-Kinder-Audiobox mit serverseitiger Verwaltung und
vollstaendiger Offline-Faehigkeit. Ziel ist eine robuste, kindgerechte Box:
Tags auflegen, Inhalte starten, und Eltern verwalten alles bequem ueber eine
einfache Web-Oberflaeche.

## Was die Box aktuell kann
- NFC-Workflow (simuliert): Tags auflegen, Tags erkennen, Tag-IDs in der
  Datenbank speichern, Tags Medienordnern zuordnen.
- Playback-Steuerung (simuliert): Play/Pause, Next, Prev, Stop, Volume.
- Spotify-Anbindung (Token-Flow, Playback-Integration vorbereitet).
- Webradio-Start ueber Tags (geplant/Workflow vorgesehen).
- Medienverwaltung: Ordnerstruktur anzeigen, Uploads, Umbenennen, Verschieben,
  Loeschen.
- Eigene Medienverwaltung ohne Cloud-Abhaengigkeit.
- Box-Verwaltung: Pairing/Unpairing, Box-Status, Commands an einzelne Boxen.
- Tag-Verwaltung: Alias, Zuordnung, Sperren pro Box, Import von lokalen Tags.
- Tag-Matrix mit Sperren pro Box (Whitelist/Block-Logik).
- Offline-Logik (simuliert): Box arbeitet mit lokalem Cache, Server kann wieder
  synchronisieren.
- Mehrere Boxen gleichzeitig (box + box2) fuer Multi-Box-Tests.

## Was geplant ist
- Echte NFC-Hardware-Integration (Lesen/Schreiben von Tag-IDs).
- Reale Audio-Ausgabe auf der Box, nicht nur Simulation.
- Robuste Setup-Flows fuer WLAN, Updates und Fehlerdiagnose.
- Feinschliff der GUI (Mobile-Flows, Accessibility, klare Nutzerfuehrung).
- Vereinfachte Installation fuer Familien (Image/Installer).
- Anbindung externer Server und Rueckfuehrung der dortigen Medien auf den
  eigenen Server inkl. Tag-Erstellung.

## Abgrenzung zu gaengigen Audioboxen
Klangkiste verfolgt einen anderen Ansatz als gaengige Audioboxen:
- Keine proprietaeren Cloud-Bindungen: Inhalte liegen lokal und bleiben
  voll kontrollierbar.
- Eigene Medien und Ordnerstrukturen statt geschlossener Oekosysteme.
- Flexible Server-Anbindung (geplant), inkl. Rueckfuehrung und Tag-Workflows.
- Tag-Matrix und Sperren pro Box fuer feinere Kontrolle in Mehrbox-Setups.
- Vollstaendige Transparenz durch offene APIs und lokale Datenhaltung.

## Status
Phase 1.x – lokale Entwicklung ohne Hardware (Mocks + API + GUI)

## Repo-Struktur
- `box/` – Box-Software (Python, NFC/Playback/Resume, API)
- `box2/` – zweite Box-Instanz fuer Multi-Box-Tests
- `gui/backend/` – Backend (Node.js + SQLite, Box-Verwaltung, Media-API)
- `gui/frontend/` – Control-Panel (React + Vite)
- `docs/` – Dev-Playbook, API-Vertrag, Tests

## Quickstart (lokal)
1) Alles starten:
```
./dev.sh
```
2) Setup-WebGUI (Box):
```
http://127.0.0.1:9000/setup
```
3) Backend pruefen:
```
curl http://127.0.0.1:5001/api/boxes
```
4) Frontend oeffnen:
```
http://127.0.0.1:5174
```

## Ports (Default)
- Backend API: `5001`
- Frontend GUI: `5174`
- Box API: `8000`
- Setup UI: `9000`
- Box2 API (optional): `8001`
- Box2 Setup (optional): `9001`

## Entwicklungsprinzipien (Kurz)
- Box und GUI/Backend teilen keinen Code.
- Kommunikation nur ueber JSON-APIs.
- Box ist Quelle der Wahrheit fuer Playback/State.
- Server verwaltet Tags, Medien und Boxen.

## Technisch (kurz)
- Start via `./dev.sh` (startet Frontend, Backend, Box-Simulation).
- Frontend spricht mit Backend (`/api`), Backend spricht mit Boxen (HTTP).
- NFC/Playback sind aktuell simuliert; reale Hardware folgt.

## Doku
- `docs/README.md` – Startpunkt fuer den Dev-Playbook
- `docs/dev-workflow.md` – Start/Stop, Ports, Logs
- `docs/api.md` – API-Vertrag
