# Virtuelle Box (IDE)

## Zweck
Beschreibt den vollstaendigen, hardwarefreien Box-Flow fuer die IDE.

## Voraussetzungen
- Python 3
- Box gestartet mit `python3 box/main.py run`

## Schritt-fuer-Schritt
1) Box erzeugt `box_id` in `box/data/box.json`.
2) WLAN-Status wird aus Profilen abgeleitet:
   - keine Profile -> `WIFI_UNCONFIGURED`
3) Setup UI unter `http://127.0.0.1:9000/setup`.
4) Nach Submit wird `WIFI_ONLINE`.
5) API unter `http://127.0.0.1:8000`.
6) Box meldet sich beim Backend (announce).
7) Pairing ueber GUI oder API.

## Troubleshooting
- Setup UI nicht erreichbar:
  - Port 9000 frei? Box laeuft?
- API nicht erreichbar:
  - Port 8000 frei? Box laeuft?
