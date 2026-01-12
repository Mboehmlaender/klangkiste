"""Logical Spotify token manager (mock, no server dependency)."""

from __future__ import annotations

from typing import Any

from storage.secrets_store import SecretsStore


class SpotifyManager:
    def __init__(self, secrets: SecretsStore) -> None:
        self._secrets = secrets
        self._tokens: dict[str, Any] = {}
        self._load()

    def set_tokens(
        self,
        access_token: str,
        refresh_token: str,
        expires_at: int,
        account_id: str | None = None,
    ) -> None:
        self._tokens = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
        }
        if account_id is not None:
            self._tokens["account_id"] = account_id
        self._save()

    def clear(self) -> None:
        self._tokens = {}
        secrets = self._secrets.load_secrets()
        if "spotify" in secrets:
            secrets.pop("spotify")
            self._secrets.save_secrets(secrets)

    @property
    def status(self) -> str:
        if not self._tokens:
            return "NOT_CONFIGURED"
        return "READY"

    def _load(self) -> None:
        secrets = self._secrets.load_secrets()
        tokens = secrets.get("spotify")
        if isinstance(tokens, dict):
            self._tokens = dict(tokens)

    def _save(self) -> None:
        secrets = self._secrets.load_secrets()
        secrets["spotify"] = dict(self._tokens)
        self._secrets.save_secrets(secrets)
