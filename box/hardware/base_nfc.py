"""Base NFC reader interface."""

from __future__ import annotations

from typing import Protocol


class BaseNFC(Protocol):
    def read_tag(self) -> str | None:
        raise NotImplementedError
