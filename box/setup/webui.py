"""Setup Web UI for WiFi configuration (mock)."""

from __future__ import annotations

from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse

from core.lifecycle import NetworkLifecycle, WifiState
from wifi.base import WifiBackend


def create_setup_app(lifecycle: NetworkLifecycle, wifi_backend: WifiBackend) -> FastAPI:
    app = FastAPI()

    @app.get("/setup", response_class=HTMLResponse)
    def setup_page() -> str:
        snapshot = lifecycle.snapshot()
        networks = wifi_backend.scan_available_networks()
        options = "".join(f"<option value='{n}'>{n}</option>" for n in networks)
        status = snapshot.wifi_state.value
        connected = snapshot.connected_ssid or "-"
        if snapshot.wifi_state != WifiState.WIFI_UNCONFIGURED:
            return _render_readonly(status, connected)
        return _render_form(status, connected, options)

    @app.post("/setup", response_class=HTMLResponse)
    def setup_submit(ssid: str = Form(...), password: str = Form("")) -> str:
        wifi_backend.add_profile(ssid=ssid, password=password, priority=10)
        snapshot = lifecycle.snapshot()
        status = snapshot.wifi_state.value
        connected = snapshot.connected_ssid or "-"
        return _render_readonly(status, connected)

    return app


def _render_form(status: str, connected: str, options: str) -> str:
    return f"""
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Klangkiste Setup</title></head>
  <body>
    <h1>WLAN Setup</h1>
    <p>Status: {status}</p>
    <p>Connected: {connected}</p>
    <form method="post" action="/setup">
      <label>SSID</label>
      <select name="ssid">{options}</select>
      <br />
      <label>Password</label>
      <input type="password" name="password" />
      <br />
      <button type="submit">Verbinden</button>
    </form>
  </body>
</html>
"""


def _render_readonly(status: str, connected: str) -> str:
    return f"""
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Klangkiste Setup</title></head>
  <body>
    <h1>WLAN Status</h1>
    <p>Status: {status}</p>
    <p>Connected: {connected}</p>
  </body>
</html>
"""
