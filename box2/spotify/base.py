"""Spotify backend interface (logical)."""

from __future__ import annotations

from typing import Protocol


class SpotifyBackend(Protocol):
    def set_tokens(
        self,
        access_token: str,
        refresh_token: str,
        expires_at: int,
        account_id: str | None = None,
    ) -> None:
        raise NotImplementedError

    def clear(self) -> None:
        raise NotImplementedError

    @property
    def status(self) -> str:
        raise NotImplementedError
