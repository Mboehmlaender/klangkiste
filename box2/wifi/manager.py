"""Logical WiFi manager (mock, no OS integration)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from storage.box_storage import BoxStorage
from storage.secrets_store import SecretsStore


@dataclass
class WifiProfile:
    ssid: str
    password: str
    priority: int = 0


class WifiManager:
    def __init__(self, storage: BoxStorage, secrets: SecretsStore) -> None:
        self._storage = storage
        self._secrets = secrets
        self._profiles: list[WifiProfile] = []
        self._connected_ssid: str | None = None
        self._load_state()

    def scan_available_networks(self) -> list[str]:
        return []

    def add_profile(self, ssid: str, password: str, priority: int = 0) -> None:
        self._profiles = [p for p in self._profiles if p.ssid != ssid]
        self._profiles.append(WifiProfile(ssid=ssid, password=password, priority=priority))
        self._save_profiles()
        self._auto_connect()

    def remove_profile(self, ssid: str) -> None:
        self._profiles = [p for p in self._profiles if p.ssid != ssid]
        if self._connected_ssid == ssid:
            self._connected_ssid = None
        self._save_profiles()
        self._save_state()
        self._auto_connect()

    def reset(self) -> None:
        self._profiles = []
        self._connected_ssid = None
        self._secrets.clear_wifi_secrets()
        self._save_state()

    def select_best_profile(self) -> WifiProfile | None:
        if not self._profiles:
            return None
        return sorted(self._profiles, key=lambda p: (-p.priority, p.ssid))[0]

    def connect(self, profile: WifiProfile) -> None:
        self._connected_ssid = profile.ssid
        self._save_state()

    @property
    def network_status(self) -> str:
        if not self._profiles:
            return "NOT_CONFIGURED"
        if self._connected_ssid:
            return "CONNECTED"
        return "DISCONNECTED"

    @property
    def connected_ssid(self) -> str | None:
        return self._connected_ssid

    @property
    def profiles_count(self) -> int:
        return len(self._profiles)

    def _auto_connect(self) -> None:
        profile = self.select_best_profile()
        if profile is not None:
            self.connect(profile)

    def _load_state(self) -> None:
        secrets = self._secrets.load_secrets()
        profiles_raw = secrets.get("wifi_profiles", [])
        if isinstance(profiles_raw, list):
            for entry in profiles_raw:
                if not isinstance(entry, dict):
                    continue
                ssid = entry.get("ssid")
                password = entry.get("password")
                priority = entry.get("priority", 0)
                if isinstance(ssid, str) and isinstance(password, str):
                    if not isinstance(priority, int):
                        priority = 0
                    self._profiles.append(
                        WifiProfile(ssid=ssid, password=password, priority=priority)
                    )

        state = self._storage.load_state()
        wifi_state = state.get("wifi", {}) if isinstance(state.get("wifi"), dict) else {}
        connected = wifi_state.get("connected_ssid")
        if isinstance(connected, str):
            self._connected_ssid = connected
        self._auto_connect()

    def _save_profiles(self) -> None:
        secrets = self._secrets.load_secrets()
        secrets["wifi_profiles"] = [
            {"ssid": p.ssid, "password": p.password, "priority": p.priority}
            for p in self._profiles
        ]
        self._secrets.save_secrets(secrets)

    def _save_state(self) -> None:
        state = self._storage.load_state()
        state["wifi"] = {"connected_ssid": self._connected_ssid}
        self._storage.save_state(state)
