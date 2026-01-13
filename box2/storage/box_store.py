"""Box metadata storage (app-level, within box/data)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from core.identity import generate_box_id


class BoxStore:
    def __init__(self, base_dir: Path) -> None:
        self._base_dir = base_dir
        self._path = self._base_dir / "box.json"

    @property
    def path(self) -> Path:
        return self._path

    def load(self) -> dict[str, Any]:
        if not self._path.exists():
            return {}
        return json.loads(self._path.read_text(encoding="utf-8"))

    def save(self, data: dict[str, Any]) -> None:
        self._path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def ensure_box_id(self) -> str:
        data = self.load()
        if "box_id" not in data:
            data["box_id"] = generate_box_id()
            self.save(data)
        return str(data["box_id"])
