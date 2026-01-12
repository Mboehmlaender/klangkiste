"""Minimal server API and GUI for pairing."""

from __future__ import annotations

import secrets
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
import uvicorn

from storage import BoxRecord, BoxRegistry

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

registry = BoxRegistry(DATA_DIR)
app = FastAPI()


class AnnounceRequest(BaseModel):
    box_id: str
    fingerprint: str
    firmware_version: str
    capabilities: dict[str, Any]


class PollRequest(BaseModel):
    box_id: str


class PairRequest(BaseModel):
    box_id: str


def _now() -> int:
    return int(time.time())


def _validate_box_id(value: str) -> bool:
    if not value.startswith("klangkiste-"):
        return False
    suffix = value.replace("klangkiste-", "", 1)
    if len(suffix) != 10:
        return False
    return all(c.isdigit() or ("a" <= c <= "z") for c in suffix)


@app.post("/api/boxes/announce")
def announce(req: AnnounceRequest) -> dict[str, Any]:
    if not _validate_box_id(req.box_id):
        raise HTTPException(status_code=400, detail="invalid box_id")
    if not req.fingerprint:
        raise HTTPException(status_code=400, detail="fingerprint required")

    boxes = registry.load()
    now = _now()
    if req.box_id in boxes:
        record = boxes[req.box_id]
        if record.fingerprint and record.fingerprint != req.fingerprint:
            raise HTTPException(status_code=400, detail="fingerprint mismatch")
        record.last_seen = now
        record.firmware_version = req.firmware_version
        record.capabilities = req.capabilities
        if record.state != "PAIRED":
            record.state = "UNPAIRED"
    else:
        record = BoxRecord(
            box_id=req.box_id,
            fingerprint=req.fingerprint,
            state="UNPAIRED",
            first_seen=now,
            last_seen=now,
            firmware_version=req.firmware_version,
            capabilities=req.capabilities,
        )
    boxes[req.box_id] = record
    registry.save(boxes)
    return {"ok": True}


@app.post("/api/boxes/poll-pairing")
def poll_pairing(req: PollRequest) -> dict[str, Any]:
    boxes = registry.load()
    record = boxes.get(req.box_id)
    if not record:
        raise HTTPException(status_code=404, detail="unknown box")
    if record.state == "PAIRED" and record.api_token:
        return {"paired": True, "api_token": record.api_token}
    return {"paired": False}


@app.post("/api/boxes/pair")
def pair_box(req: PairRequest) -> dict[str, Any]:
    boxes = registry.load()
    record = boxes.get(req.box_id)
    if not record:
        raise HTTPException(status_code=404, detail="unknown box")
    if record.state != "PAIRED":
        record.state = "PAIRED"
        record.api_token = secrets.token_hex(32)
        boxes[req.box_id] = record
        registry.save(boxes)
    return {"paired": True, "api_token": record.api_token}


@app.get("/ui", response_class=HTMLResponse)
def ui() -> str:
    boxes = _apply_offline(registry.load())
    unpaired = [b for b in boxes.values() if b.state != "PAIRED"]
    paired = [b for b in boxes.values() if b.state == "PAIRED"]

    def _row(box: BoxRecord) -> str:
        return (
            f"<tr><td>{box.box_id}</td><td>{box.firmware_version}</td>"
            f"<td>{box.last_seen}</td>"
            f"<td><form method='post' action='/ui/pair'>"
            f"<input type='hidden' name='box_id' value='{box.box_id}'/>"
            f"<button type='submit'>Box hinzufuegen</button>"
            f"</form></td></tr>"
        )

    unpaired_rows = "".join(_row(b) for b in unpaired) or "<tr><td colspan='4'>Keine</td></tr>"
    paired_rows = "".join(
        f"<tr><td>{b.box_id}</td><td>{b.firmware_version}</td><td>{b.last_seen}</td></tr>"
        for b in paired
    ) or "<tr><td colspan='3'>Keine</td></tr>"

    return f"""
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Klangkiste Server</title></head>
  <body>
    <h1>Neue Boxen (UNPAIRED)</h1>
    <table border="1">
      <tr><th>box_id</th><th>firmware</th><th>last_seen</th><th>action</th></tr>
      {unpaired_rows}
    </table>
    <h1>Gepaarte Boxen</h1>
    <table border="1">
      <tr><th>box_id</th><th>firmware</th><th>last_seen</th></tr>
      {paired_rows}
    </table>
  </body>
</html>
"""


def _apply_offline(boxes: dict[str, BoxRecord], threshold_seconds: int = 120) -> dict[str, BoxRecord]:
    now = _now()
    for record in boxes.values():
        if now - record.last_seen > threshold_seconds:
            record.state = "OFFLINE"
    registry.save(boxes)
    return boxes


@app.post("/ui/pair")
def ui_pair(box_id: str = Form(...)) -> RedirectResponse:
    pair_box(PairRequest(box_id=box_id))
    return RedirectResponse(url="/ui", status_code=303)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7000, log_level="info")
