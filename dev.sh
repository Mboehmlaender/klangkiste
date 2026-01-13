#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Klangkiste (Box + Backend + Frontend)"

HOST_IP="${KLANGKISTE_HOST_IP:-}"
if [[ -z "$HOST_IP" ]]; then
  HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
if [[ -z "$HOST_IP" ]]; then
  HOST_IP="127.0.0.1"
fi
BACKEND_URL_DEFAULT="http://${HOST_IP}:5001"
BACKEND_URL="${KLANGKISTE_BACKEND_URL:-$BACKEND_URL_DEFAULT}"

read -rp "➡️ Backend: npm install ausführen? (y/N) " backend_install_choice
if [[ "$backend_install_choice" =~ ^([YyJj]|[Yy]es|[Jj]a)$ ]]; then
  BACKEND_NPM_INSTALL="1"
else
  BACKEND_NPM_INSTALL="0"
fi

read -rp "➡️ Frontend: npm install ausführen? (y/N) " frontend_install_choice
if [[ "$frontend_install_choice" =~ ^([YyJj]|[Yy]es|[Jj]a)$ ]]; then
  FRONTEND_NPM_INSTALL="1"
else
  FRONTEND_NPM_INSTALL="0"
fi

# Ensure both processes are stopped on exit or Ctrl+C.
cleanup() {
  echo ""
  echo "🛑 Stopping Klangkiste..."
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${GUI_PID:-}" ]]; then
    kill -TERM "$GUI_PID" 2>/dev/null || true
    wait "$GUI_PID" 2>/dev/null || true
  fi
  if [[ -n "${BOX_PID:-}" ]]; then
    kill -TERM "$BOX_PID" 2>/dev/null || true
    wait "$BOX_PID" 2>/dev/null || true
  fi
  if [[ -n "${BOX2_PID:-}" ]]; then
    kill -TERM "$BOX2_PID" 2>/dev/null || true
    wait "$BOX2_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

# Backend starten (Node + SQLite)
echo "▶️  Starting Backend..."
(
  cd gui/backend
  if [[ "$BACKEND_NPM_INSTALL" == "1" ]]; then
    npm install
  else
    echo "ℹ️ Backend npm install übersprungen."
  fi
  npm run dev
) &

BACKEND_PID=$!

# Frontend starten (Vite + React)
GUI_PORT="${KLANGKISTE_GUI_PORT:-5174}"
echo "▶️  Starting Frontend on port ${GUI_PORT}..."
(
  cd gui/frontend
  if [[ "$FRONTEND_NPM_INSTALL" == "1" ]]; then
    npm install
  else
    echo "ℹ️ Frontend npm install übersprungen."
  fi
  VITE_BACKEND_URL="${BACKEND_URL}" npm run dev -- --host 0.0.0.0 --port "${GUI_PORT}" --strictPort
) &

GUI_PID=$!

# Box starten (FastAPI + Run-Modus)
echo "▶️  Starting Box..."
(
  cd box
  KLANGKISTE_SERVER_URL="${BACKEND_URL}" python3 main.py run
) &

BOX_PID=$!

# Box 2 starten (FastAPI + Run-Modus)
echo "▶️  Starting Box 2..."
(
  cd box2
  KLANGKISTE_SERVER_URL="${BACKEND_URL}" \
  KLANGKISTE_API_PORT="8001" \
  KLANGKISTE_SETUP_PORT="9001" \
  python3 main.py run
) &

BOX2_PID=$!

echo ""
echo "✅ Backend PID: $BACKEND_PID"
echo "✅ Frontend PID: $GUI_PID"
echo "✅ Box PID: $BOX_PID"
echo "✅ Box2 PID: $BOX2_PID"
echo "🛑 Press Ctrl+C to stop everything"
echo ""

wait "$BOX_PID"
