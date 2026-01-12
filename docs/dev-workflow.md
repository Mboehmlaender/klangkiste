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
- GUI laeuft im Hintergrund.
- Box laeuft im Vordergrund und akzeptiert CLI-Kommandos.

### Komponenten separat starten
Box only:
```
python3 box/main.py run
```
GUI only:
```
cd gui
npm run dev
```

## Ports / Hosts
- Server API + GUI: `http://127.0.0.1:7000` (GUI unter `/ui`)
- Box API: `http://127.0.0.1:8000`
- Setup UI: `http://127.0.0.1:9000/setup`
- GUI: `http://127.0.0.1:5174`

## API-URL fuer die GUI
Default ist `http://localhost:8000`. Override:
```
VITE_BOX_API_URL=http://127.0.0.1:8000 npm run dev
```

## Logs ansehen
- Server-Logs: Terminal mit `python3 server/main.py`
- Box-Logs: Terminal mit `python3 box/main.py run`
- GUI-Logs: Browser-Konsole

## Sauber beenden
- `Ctrl+C` im Box-Terminal.
- `dev.sh` beendet die GUI automatisch.

## Checkliste
- ✅ `./dev.sh` gestartet
- ✅ Box-CLI Prompt sichtbar
- ✅ GUI im Browser erreichbar
- ✅ `curl http://127.0.0.1:8000/status` liefert JSON

## Troubleshooting
- Port belegt:
  - 8000/9000: andere Prozesse beenden oder Ports in `box/main.py` aendern.
- CORS-Fehler:
  - API muss laufen und erreichbar sein.
- GUI zeigt "Failed to fetch":
  - `VITE_BOX_API_URL` pruefen.
