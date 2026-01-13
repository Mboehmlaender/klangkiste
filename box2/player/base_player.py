"""Base player interface for audio playback."""

from __future__ import annotations

from typing import Protocol


class BasePlayer(Protocol):
    def play(self, media_ref: str) -> None:
        raise NotImplementedError

    def pause(self) -> None:
        raise NotImplementedError

    def stop(self) -> None:
        raise NotImplementedError

    def set_volume(self, volume: int) -> None:
        raise NotImplementedError
