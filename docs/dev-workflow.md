# Dev-Workflow

## Zweck
Start/Stop der virtuellen Box, Logs, und GUI-API-Konfiguration.

## Voraussetzungen
- Python 3
- Node.js + npm
- Aus dem Repo-Root ausfuehren

## Schritt-fuer-Schritt
### Alles starten (empfohlen)
```
./dev.sh
```
- Frontend, Backend und Box laufen im Hintergrund.
- CLI-Kommandos fuer die Box bitte in einem separaten Terminal absetzen.

### Komponenten separat starten
Box only:
```
python3 box/main.py run
```
Frontend only:
```
cd gui/frontend
npm run dev -- --host 0.0.0.0 --port 5174 --strictPort
```
Backend only:
```
cd gui/backend
npm run dev
```

## Ports / Hosts
- Backend API: `http://127.0.0.1:5001`
- Frontend GUI: `http://127.0.0.1:5174`
- Box API: `http://127.0.0.1:8000`
- Setup UI: `http://127.0.0.1:9000/setup`
- GUI: `http://127.0.0.1:5174`

## API-URL fuer die GUI
Default ist `http://<HOST-IP>:5001` (aus `hostname -I`). Override:
```
KLANGKISTE_BACKEND_URL=http://<server-ip>:5001 ./dev.sh
VITE_BACKEND_URL=http://<server-ip>:5001 npm run dev
```

## Logs ansehen
- Backend-Logs: Terminal mit `cd gui/backend && npm run dev`
- Box-Logs: Terminal mit `python3 box/main.py run`
- GUI-Logs: Browser-Konsole

## Sauber beenden
- `Ctrl+C` im Box-Terminal.
- `dev.sh` beendet die GUI automatisch.

## Checkliste
- ✅ `./dev.sh` gestartet
- ✅ Box-CLI Prompt sichtbar
- ✅ GUI im Browser erreichbar
- ✅ `curl http://127.0.0.1:5001/api/boxes` liefert JSON

## Troubleshooting
- Port belegt:
  - 8000/9000: andere Prozesse beenden oder Ports in `box/main.py` aendern.
- CORS-Fehler:
  - API muss laufen und erreichbar sein.
- GUI zeigt "Failed to fetch":
  - `VITE_BACKEND_URL` pruefen.
