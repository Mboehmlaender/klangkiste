#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Klangkiste (Box + GUI)"

# Ensure both processes are stopped on exit or Ctrl+C.
cleanup() {
  echo ""
  echo "🛑 Stopping Klangkiste..."
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "${GUI_PID:-}" ]]; then
    kill -TERM "$GUI_PID" 2>/dev/null || true
    wait "$GUI_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

# Server starten (FastAPI + GUI)
echo "▶️  Starting Server..."
(
  cd server
  python3 main.py
) &

SERVER_PID=$!

# GUI starten (Vite)
GUI_PORT="${KLANGKISTE_GUI_PORT:-5174}"
echo "▶️  Starting GUI on port ${GUI_PORT}..."
(
  cd gui
  npm run dev -- --host 0.0.0.0 --port "${GUI_PORT}" --strictPort
) &

GUI_PID=$!

# Box starten (FastAPI + Run-Modus)
echo "▶️  Starting Box..."
cd box
python3 main.py run

echo ""
echo "✅ Server PID: $SERVER_PID"
echo "✅ GUI PID: $GUI_PID"
echo "🛑 Press Ctrl+C to stop everything"
echo ""
