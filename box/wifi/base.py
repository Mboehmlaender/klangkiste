"""WiFi backend interface (logical, no OS integration)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class WifiProfile:
    ssid: str
    password: str
    priority: int = 0


class WifiBackend(Protocol):
    def scan_available_networks(self) -> list[str]:
        raise NotImplementedError

    def add_profile(self, ssid: str, password: str, priority: int = 0) -> None:
        raise NotImplementedError

    def remove_profile(self, ssid: str) -> None:
        raise NotImplementedError

    def reset(self) -> None:
        raise NotImplementedError

    def select_best_profile(self) -> WifiProfile | None:
        raise NotImplementedError

    def connect(self, profile: WifiProfile) -> None:
        raise NotImplementedError

    @property
    def network_status(self) -> str:
        raise NotImplementedError

    @property
    def connected_ssid(self) -> str | None:
        raise NotImplementedError

    @property
    def profiles_count(self) -> int:
        raise NotImplementedError
