"""Base button interface."""

from __future__ import annotations

from typing import Protocol


class BaseButtons(Protocol):
    def poll(self) -> str | None:
        raise NotImplementedError
