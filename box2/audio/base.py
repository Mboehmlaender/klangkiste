"""Audio backend interface (placeholder)."""

from __future__ import annotations

from typing import Protocol


class AudioBackend(Protocol):
    def play(self, media_ref: str) -> None:
        raise NotImplementedError

    def pause(self) -> None:
        raise NotImplementedError

    def stop(self) -> None:
        raise NotImplementedError
