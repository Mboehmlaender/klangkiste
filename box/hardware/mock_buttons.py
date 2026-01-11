"""Mock buttons for Phase 1a."""

from __future__ import annotations

from collections import deque

from hardware.base_buttons import BaseButtons


class MockButtons(BaseButtons):
    def __init__(self) -> None:
        self._queue: deque[str] = deque()

    def enqueue(self, button_id: str) -> None:
        self._queue.append(button_id)

    def poll(self) -> str | None:
        if not self._queue:
            return None
        return self._queue.popleft()
