"""Network lifecycle state machine (logical)."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from wifi.base import WifiBackend


class WifiState(str, Enum):
    WIFI_UNCONFIGURED = "WIFI_UNCONFIGURED"
    WIFI_CONNECTING = "WIFI_CONNECTING"
    WIFI_ONLINE = "WIFI_ONLINE"
    WIFI_OFFLINE = "WIFI_OFFLINE"


@dataclass
class NetworkSnapshot:
    wifi_state: WifiState
    ip_address: str
    connected_ssid: str | None
    wifi_profiles_count: int


class NetworkLifecycle:
    def __init__(self, wifi_backend: WifiBackend) -> None:
        self._wifi = wifi_backend
        self._wifi_state = WifiState.WIFI_UNCONFIGURED
        self._ip_address = "192.168.4.1"
        self.refresh()

    def refresh(self) -> None:
        if self._wifi.profiles_count == 0:
            self._wifi_state = WifiState.WIFI_UNCONFIGURED
            self._ip_address = "192.168.4.1"
            return
        if self._wifi.connected_ssid:
            self._wifi_state = WifiState.WIFI_ONLINE
            self._ip_address = "127.0.0.1"
            return
        self._wifi_state = WifiState.WIFI_OFFLINE
        self._ip_address = "127.0.0.1"

    def snapshot(self) -> NetworkSnapshot:
        self.refresh()
        return NetworkSnapshot(
            wifi_state=self._wifi_state,
            ip_address=self._ip_address,
            connected_ssid=self._wifi.connected_ssid,
            wifi_profiles_count=self._wifi.profiles_count,
        )
