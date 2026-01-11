"""Mock NFC reader for Phase 1a."""

from __future__ import annotations

from hardware.base_nfc import BaseNFC


class MockNFC(BaseNFC):
    def __init__(self) -> None:
        self._next_uid: str | None = None

    def set_next_uid(self, uid: str | None) -> None:
        self._next_uid = uid

    def read_tag(self) -> str | None:
        uid = self._next_uid
        self._next_uid = None
        return uid
