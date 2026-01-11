"""Mock player for Phase 1a (no real audio)."""

from __future__ import annotations

from player.base_player import BasePlayer


class MockPlayer(BasePlayer):
    def __init__(self) -> None:
        self._current: str | None = None
        self._volume: int = 0

    def play(self, media_ref: str) -> None:
        self._current = media_ref

    def pause(self) -> None:
        return None

    def stop(self) -> None:
        self._current = None

    def set_volume(self, volume: int) -> None:
        self._volume = volume
