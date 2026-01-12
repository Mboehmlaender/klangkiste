#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Klangkiste (Box + GUI)"

# Ensure both processes are stopped on exit or Ctrl+C.
cleanup() {
  echo ""
  echo "🛑 Stopping Klangkiste..."
  if [[ -n "${GUI_PID:-}" ]]; then
    kill -TERM "$GUI_PID" 2>/dev/null || true
    wait "$GUI_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

# GUI starten (Vite)
echo "▶️  Starting GUI..."
(
  cd gui
  npm run dev
) &

GUI_PID=$!

# Box starten (FastAPI + Run-Modus)
echo "▶️  Starting Box..."
cd box
python3 main.py run

echo ""
echo "✅ GUI PID: $GUI_PID"
echo "🛑 Press Ctrl+C to stop everything"
echo ""
