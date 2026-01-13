"""Mock audio backend (no real playback)."""

from __future__ import annotations

from audio.base import AudioBackend


class MockAudioBackend(AudioBackend):
    def __init__(self) -> None:
        self._current: str | None = None

    def play(self, media_ref: str) -> None:
        self._current = media_ref

    def pause(self) -> None:
        return None

    def stop(self) -> None:
        self._current = None
