"""Pairing state management for the Box."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from storage.state_store import StateStore
from storage.secret_store import SecretStore


class PairingState(str, Enum):
    UNPAIRED = "UNPAIRED"
    PAIRING_PENDING = "PAIRING_PENDING"
    PAIRED = "PAIRED"


@dataclass
class PairingSnapshot:
    state: PairingState


class PairingManager:
    def __init__(self, state_store: StateStore, secret_store: SecretStore) -> None:
        self._state_store = state_store
        self._secret_store = secret_store
        self._state = PairingState.UNPAIRED
        self._load()

    @property
    def state(self) -> PairingState:
        return self._state

    def set_state(self, state: PairingState) -> None:
        self._state = state
        self._save()

    def snapshot(self) -> PairingSnapshot:
        return PairingSnapshot(state=self._state)

    def is_paired(self) -> bool:
        return self._state == PairingState.PAIRED

    def get_api_token(self) -> str | None:
        return self._secret_store.get_api_token()

    def save_api_token(self, token: str) -> None:
        self._secret_store.save_api_token(token)
        self.set_state(PairingState.PAIRED)

    def _load(self) -> None:
        data = self._state_store.load()
        pairing = data.get("pairing") if isinstance(data.get("pairing"), dict) else {}
        state_raw = pairing.get("state")
        if isinstance(state_raw, str) and state_raw in PairingState.__members__:
            self._state = PairingState[state_raw]

    def _save(self) -> None:
        data = self._state_store.load()
        data["pairing"] = {"state": self._state.name}
        self._state_store.save(data)
