"""Storage interface for Box configuration and state."""

from __future__ import annotations

from typing import Protocol


class Storage(Protocol):
    def load_config(self) -> dict:
        raise NotImplementedError

    def save_config(self, config: dict) -> None:
        raise NotImplementedError
