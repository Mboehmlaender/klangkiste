#!/usr/bin/env bash
set -euo pipefail

PORTS=(5001 5174 8000 9000 8001 9001)

have_lsof() {
  command -v lsof >/dev/null 2>&1
}

have_ss() {
  command -v ss >/dev/null 2>&1
}

list_listeners_lsof() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
}

list_listeners_ss() {
  local port="$1"
  ss -ltnp "sport = :${port}" 2>/dev/null || true
}

kill_pid() {
  local pid="$1"
  kill -TERM "$pid" 2>/dev/null || true
}

found_any=false

for port in "${PORTS[@]}"; do
  if have_lsof; then
    output="$(list_listeners_lsof "$port")"
    if [[ -z "$output" ]]; then
      continue
    fi
    found_any=true
    echo "Port ${port}:"
    echo "$output"
    pids=$(echo "$output" | awk 'NR>1 {print $2}' | sort -u)
  elif have_ss; then
    output="$(list_listeners_ss "$port")"
    if [[ -z "$output" ]]; then
      continue
    fi
    found_any=true
    echo "Port ${port}:"
    echo "$output"
    pids=$(echo "$output" | awk -F 'pid=' 'NF>1 {print $2}' | awk -F ',' '{print $1}' | sort -u)
  else
    echo "error: neither lsof nor ss is available"
    exit 1
  fi

  if [[ -z "$pids" ]]; then
    continue
  fi

  read -r -p "Kill these PIDs on port ${port}? (y/n) " answer
  if [[ "$answer" != "y" ]]; then
    echo "Skipping port ${port}."
    continue
  fi

  for pid in $pids; do
    echo "Killing PID ${pid} (port ${port})"
    kill_pid "$pid"
  done
  echo "Done for port ${port}."
  echo ""

done

if [[ "$found_any" == "false" ]]; then
  echo "No listeners found on ports: ${PORTS[*]}"
fi
