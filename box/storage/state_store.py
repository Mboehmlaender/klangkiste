"""Runtime state storage (resume, wifi state)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class StateStore:
    def __init__(self, base_dir: Path) -> None:
        self._path = base_dir / "state.json"

    @property
    def path(self) -> Path:
        return self._path

    def load(self) -> dict[str, Any]:
        if not self._path.exists():
            return {}
        return json.loads(self._path.read_text(encoding="utf-8"))

    def save(self, data: dict[str, Any]) -> None:
        self._path.write_text(json.dumps(data, indent=2), encoding="utf-8")
