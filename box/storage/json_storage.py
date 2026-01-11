"""JSON file storage placeholder for Phase 1a."""

from __future__ import annotations

import json
from pathlib import Path

from storage.storage import Storage


class JsonStorage(Storage):
    def __init__(self, path: str) -> None:
        self._path = Path(path)

    def load_config(self) -> dict:
        if not self._path.exists():
            return {}
        return json.loads(self._path.read_text(encoding="utf-8"))

    def save_config(self, config: dict) -> None:
        self._path.write_text(json.dumps(config, indent=2), encoding="utf-8")
