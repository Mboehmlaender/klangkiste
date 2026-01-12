# Virtual Box Flow (IDE)

## Purpose
Describe the full, hardware-free box lifecycle used in development.

## Prerequisites
- Python 3
- Box started with `python3 box/main.py run`

## Step-by-step
1) Box starts and creates `box/data/box.json` if missing.
2) WiFi state is derived from stored profiles:
   - none -> `WIFI_UNCONFIGURED`
3) Setup UI available at `http://127.0.0.1:9000/setup`.
4) After profile submission, box becomes `WIFI_ONLINE`.
5) API available at `http://127.0.0.1:8000`.

## Troubleshooting
- Setup UI not reachable:
  - Ensure port 9000 is free and Box is running.
- API not reachable:
  - Ensure port 8000 is free and Box is running.
