"""Central orchestration placeholder for the Box runtime."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from core.state import BoxState, RuntimeState
from player.base_player import BasePlayer


class BoxController:
    def __init__(
        self,
        state: RuntimeState,
        player: BasePlayer,
        config: dict[str, Any],
        config_path: str,
    ) -> None:
        self._state = state
        self._player = player
        self._config = config
        self._config_path = Path(config_path)

    @property
    def state(self) -> RuntimeState:
        return self._state

    def start(self) -> None:
        """Start the main loop (not implemented in Phase 1a)."""
        return None

    def handle_nfc_on(self, uid: str) -> None:
        tag = self._resolve_tag(uid)
        if tag is None:
            print(f"error: uid '{uid}' not found in config tags")
            return None

        playlist = self._build_playlist(tag)
        if not playlist:
            path_value = tag.get("path", "-")
            resolved = self._resolve_path(path_value)
            print(
                f"error: no playable files found for uid '{uid}' at path '{resolved}'"
            )
            return None

        if self._state.active_uid == uid and uid in self._state._resume:
            file_index, position = self._state._resume[uid]
        else:
            file_index, position = 0, 0

        if file_index < 0 or file_index >= len(playlist):
            file_index, position = 0, 0

        media_ref = playlist[file_index]
        duration = self._duration_for(media_ref)
        self._state.active_uid = uid
        self._state.playback_type = tag.get("type")
        self._state.playback_path = tag.get("path")
        self._state.current_file = Path(media_ref).name
        self._state.current_duration = duration
        self._state.file_index = file_index
        self._state.position = position
        self._state._playlist = playlist

        self._player.play(media_ref)
        self._state.current_media = media_ref
        self._state.state = BoxState.PLAYING

    def pause(self) -> None:
        self._player.pause()
        if self._state.state == BoxState.PLAYING:
            self._state.state = BoxState.PAUSED

    def stop(self) -> None:
        self._player.stop()
        self._state.current_media = None
        self._state.state = BoxState.IDLE

    def handle_nfc_off(self, uid: str) -> None:
        if self._state.active_uid != uid:
            return None
        self._store_progress(uid)
        self.stop()

    def _resolve_tag(self, uid: str) -> dict[str, Any] | None:
        tags = self._config.get("tags", {})
        if not isinstance(tags, dict):
            return None
        tag = tags.get(uid)
        if not isinstance(tag, dict):
            return None
        if "type" not in tag or "path" not in tag:
            return None
        return tag

    def tick(self, seconds: int) -> None:
        if self._state.state != BoxState.PLAYING:
            return None
        if self._state.position is None or self._state.file_index is None:
            return None
        if not self._state._playlist:
            return None
        if seconds <= 0:
            return None

        remaining = seconds
        file_index = self._state.file_index
        position = self._state.position

        while remaining > 0 and file_index < len(self._state._playlist):
            media_ref = self._state._playlist[file_index]
            duration = self._duration_for(media_ref)
            if duration <= 0:
                break
            time_left = duration - position
            if remaining < time_left:
                position += remaining
                remaining = 0
            else:
                remaining -= time_left
                file_index += 1
                position = 0

            if file_index >= len(self._state._playlist):
                self._state.file_index = len(self._state._playlist) - 1
                self._state.position = duration
                self._state.current_media = None
                self._state.current_file = None
                self._state.current_duration = None
                self._state.state = BoxState.IDLE
                return None

        self._state.file_index = file_index
        self._state.position = position
        media_ref = self._state._playlist[file_index]
        self._state.current_media = media_ref
        self._state.current_file = Path(media_ref).name
        self._state.current_duration = self._duration_for(media_ref)

    def _build_playlist(self, tag: dict[str, Any]) -> list[str]:
        path_value = tag.get("path")
        if not isinstance(path_value, str):
            return []
        path = self._resolve_path(path_value)
        if not path.exists() or not path.is_dir():
            return []
        files = [p for p in path.iterdir() if p.is_file()]
        files_sorted = sorted(files, key=lambda p: p.name)
        return [str(p) for p in files_sorted]

    def _resolve_path(self, path_value: str) -> Path:
        path = Path(path_value)
        if not path.is_absolute():
            return (self._config_path.parent / path).resolve()
        return path

    def _store_progress(self, uid: str) -> None:
        file_index = self._state.file_index if self._state.file_index is not None else 0
        position = self._state.position if self._state.position is not None else 0
        self._state._resume[uid] = (file_index, position)

    def _duration_for(self, media_ref: str) -> int:
        name = Path(media_ref).name
        durations = {"01.mp3": 180, "02.mp3": 200, "03.mp3": 220}
        return durations.get(name, 0)
