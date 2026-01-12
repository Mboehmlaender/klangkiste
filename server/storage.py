"""Server-side storage for box registry."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class BoxRecord:
    box_id: str
    fingerprint: str
    state: str
    first_seen: int
    last_seen: int
    firmware_version: str
    capabilities: dict[str, Any]
    api_token: str | None = None


class BoxRegistry:
    def __init__(self, base_dir: Path) -> None:
        self._path = base_dir / "boxes.json"

    def load(self) -> dict[str, BoxRecord]:
        if not self._path.exists():
            return {}
        raw = json.loads(self._path.read_text(encoding="utf-8"))
        result: dict[str, BoxRecord] = {}
        for box_id, data in raw.items():
            if not isinstance(data, dict):
                continue
            result[box_id] = BoxRecord(
                box_id=box_id,
                fingerprint=str(data.get("fingerprint", "")),
                state=str(data.get("state", "UNPAIRED")),
                first_seen=int(data.get("first_seen", 0)),
                last_seen=int(data.get("last_seen", 0)),
                firmware_version=str(data.get("firmware_version", "")),
                capabilities=dict(data.get("capabilities", {})),
                api_token=data.get("api_token"),
            )
        return result

    def save(self, records: dict[str, BoxRecord]) -> None:
        data = {
            box_id: {
                "fingerprint": rec.fingerprint,
                "state": rec.state,
                "first_seen": rec.first_seen,
                "last_seen": rec.last_seen,
                "firmware_version": rec.firmware_version,
                "capabilities": rec.capabilities,
                "api_token": rec.api_token,
            }
            for box_id, rec in records.items()
        }
        self._path.write_text(json.dumps(data, indent=2), encoding="utf-8")
