"""Persistent storage for Box metadata and runtime state."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class BoxStorage:
    def __init__(self, base_dir: str | None = None) -> None:
        default_dir = Path(__file__).resolve().parents[1] / "data"
        self._base_dir = Path(base_dir) if base_dir else default_dir
        self._box_path = self._base_dir / "box.json"
        self._state_path = self._base_dir / "state.json"
        self._media_dir = self._base_dir / "media"

    @property
    def base_dir(self) -> Path:
        return self._base_dir

    @property
    def media_dir(self) -> Path:
        return self._media_dir

    @property
    def box_path(self) -> Path:
        return self._box_path

    @property
    def state_path(self) -> Path:
        return self._state_path

    def ensure_layout(self) -> None:
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._media_dir.mkdir(parents=True, exist_ok=True)

    def load_box_meta(self) -> dict[str, Any]:
        if not self._box_path.exists():
            return {}
        return json.loads(self._box_path.read_text(encoding="utf-8"))

    def save_box_meta(self, data: dict[str, Any]) -> None:
        self._box_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def load_state(self) -> dict[str, Any]:
        if not self._state_path.exists():
            return {}
        return json.loads(self._state_path.read_text(encoding="utf-8"))

    def save_state(self, data: dict[str, Any]) -> None:
        self._state_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
