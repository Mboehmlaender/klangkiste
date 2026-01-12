# Dev Workflow

## Purpose
How to start/stop the virtual box, how to access logs, and how to point the GUI to the API.

## Prerequisites
- Python 3
- Node.js + npm
- Run from repo root

## Step-by-step
### Start everything (recommended)
```
./dev.sh
```
- GUI runs in the background
- Box runs in the foreground (you can type CLI commands)

### Start separately
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
- Box API: `http://127.0.0.1:8000`
- Setup UI: `http://127.0.0.1:9000/setup`
- GUI: `http://127.0.0.1:5174`

## API URL for GUI
Default is `http://localhost:8000`. Override with:
```
VITE_BOX_API_URL=http://127.0.0.1:8000 npm run dev
```

## Logs
- Box logs appear in the same terminal where you run `python3 box/main.py run`.
- GUI logs appear in the browser console.

## Stop / Cleanup
- Press `Ctrl+C` in the terminal where the box is running.
- `dev.sh` will also stop the GUI process.

## Checklist
- ✅ Run `./dev.sh`
- ✅ Box shows interactive prompt
- ✅ GUI loads in browser
- ✅ `curl http://127.0.0.1:8000/status` returns JSON

## Troubleshooting
- Port already in use:
  - 8000 or 9000: stop other processes, or change ports in `box/main.py`.
- CORS error in browser:
  - Ensure API is running; CORS is already enabled in the Box API.
- GUI shows "Failed to fetch":
  - Check `VITE_BOX_API_URL` and Box API port.
