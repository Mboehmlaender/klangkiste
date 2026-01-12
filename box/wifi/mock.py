"""Mock WiFi backend (logical simulation)."""

from __future__ import annotations

from typing import Any

from storage.state_store import StateStore
from storage.secret_store import SecretStore
from wifi.base import WifiBackend, WifiProfile


class MockWifiBackend(WifiBackend):
    def __init__(self, state_store: StateStore, secret_store: SecretStore) -> None:
        self._state_store = state_store
        self._secret_store = secret_store
        self._profiles: list[WifiProfile] = []
        self._connected_ssid: str | None = None
        self._available_networks = ["HomeWiFi", "Hotspot"]
        self._load()

    def scan_available_networks(self) -> list[str]:
        return list(self._available_networks)

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
        self._secret_store.clear_wifi_secrets()
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
            return "WIFI_UNCONFIGURED"
        if self._connected_ssid:
            return "WIFI_ONLINE"
        return "WIFI_OFFLINE"

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

    def _load(self) -> None:
        secrets = self._secret_store.load_secrets()
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

        state = self._state_store.load()
        wifi_state = state.get("wifi", {}) if isinstance(state.get("wifi"), dict) else {}
        connected = wifi_state.get("connected_ssid")
        if isinstance(connected, str):
            self._connected_ssid = connected
        self._auto_connect()

    def _save_profiles(self) -> None:
        secrets = self._secret_store.load_secrets()
        secrets["wifi_profiles"] = [
            {"ssid": p.ssid, "password": p.password, "priority": p.priority}
            for p in self._profiles
        ]
        self._secret_store.save_secrets(secrets)

    def _save_state(self) -> None:
        state = self._state_store.load()
        state["wifi"] = {"connected_ssid": self._connected_ssid}
        self._state_store.save(state)
