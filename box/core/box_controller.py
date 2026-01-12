"""Central orchestration placeholder for the Box runtime."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from core.state import BoxState, RuntimeState
from player.base_player import BasePlayer
import hashlib


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
        if self._state.state == BoxState.ERROR:
            return None
        if self._state.active_uid == uid and self._state.state != BoxState.IDLE:
            return None
        if self._config.get("server_reachable") is False:
            print("error: server not reachable")
            self._trigger_error("server_unreachable")
            return None
        tag = self._resolve_tag(uid)
        if tag is None:
            print(f"error: uid '{uid}' not found in config tags")
            self._trigger_error("uid_unmapped")
            return None
        self._state.last_error = None

        playlist = self._build_playlist(tag)
        if not playlist:
            path_value = tag.get("path", "-")
            resolved = self._resolve_path(path_value)
            print(
                f"error: no playable files found for uid '{uid}' at path '{resolved}'"
            )
            self._trigger_error("no_playable_files")
            return None

        if uid in self._state._resume:
            file_index, position = self._state._resume[uid]
        else:
            file_index, position = 0, 0

        if file_index < 0 or file_index >= len(playlist):
            print(
                f"error: stored progress points outside playlist for uid '{uid}'"
            )
            self._trigger_error("invalid_resume")
            return None

        if self._state.active_uid and self._state.active_uid != uid:
            self._store_progress(self._state.active_uid)
            self.stop()

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
        self._clear_playback_state()

    def handle_nfc_off(self, uid: str) -> None:
        if self._state.state == BoxState.ERROR:
            return None
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
        if self._state.state == BoxState.ERROR:
            return None
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
                last_index = len(self._state._playlist) - 1
                last_media = self._state._playlist[last_index]
                last_duration = self._duration_for(last_media)
                self._state.file_index = last_index
                self._state.position = last_duration
                if self._state.active_uid:
                    self._store_progress(self._state.active_uid)
                self.stop()
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
        return [str(p) for p in self._collect_files(path)]

    def _collect_files(self, root: Path) -> list[Path]:
        entries = list(root.iterdir())
        dirs = sorted([p for p in entries if p.is_dir()], key=lambda p: p.name)
        files = sorted([p for p in entries if p.is_file()], key=lambda p: p.name)
        result: list[Path] = []
        for directory in dirs:
            result.extend(self._collect_files(directory))
        result.extend(files)
        return result

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
        if name in durations:
            return durations[name]
        if not name.lower().endswith(".mp3"):
            return 0
        digest = hashlib.md5(name.encode("utf-8")).hexdigest()
        seed = int(digest[:8], 16)
        return 120 + (seed % 241)

    def play_pause(self) -> None:
        if self._state.state in {BoxState.IDLE, BoxState.ERROR}:
            return None
        if self._state.state == BoxState.PLAYING:
            self._state.state = BoxState.PAUSED
            return None
        if self._state.state == BoxState.PAUSED:
            self._state.state = BoxState.PLAYING
            return None

    def next_track(self) -> None:
        if self._state.state in {BoxState.IDLE, BoxState.ERROR}:
            return None
        if not self._state._playlist:
            return None
        if self._state.file_index is None:
            return None
        next_index = self._state.file_index + 1
        if next_index >= len(self._state._playlist):
            if self._state.active_uid:
                self._store_progress(self._state.active_uid)
            self.stop()
            return None
        self._jump_to_index(next_index, 0)
        self._state.state = BoxState.PLAYING

    def prev_track(self, threshold_seconds: int = 3) -> None:
        if self._state.state in {BoxState.IDLE, BoxState.ERROR}:
            return None
        if self._state.file_index is None or self._state.position is None:
            return None
        if self._state.position > threshold_seconds:
            self._state.position = 0
            return None
        prev_index = max(self._state.file_index - 1, 0)
        self._jump_to_index(prev_index, 0)
        self._state.state = BoxState.PLAYING

    def volume_up(self, step: int = 5) -> None:
        if self._state.state == BoxState.ERROR:
            return None
        self._state.volume = min(self._state.volume + step, self._state.max_volume)

    def volume_down(self, step: int = 5) -> None:
        if self._state.state == BoxState.ERROR:
            return None
        self._state.volume = max(self._state.volume - step, 0)

    def _jump_to_index(self, file_index: int, position: int) -> None:
        if not self._state._playlist:
            return None
        if file_index < 0 or file_index >= len(self._state._playlist):
            return None
        media_ref = self._state._playlist[file_index]
        self._state.file_index = file_index
        self._state.position = position
        self._state.current_media = media_ref
        self._state.current_file = Path(media_ref).name
        self._state.current_duration = self._duration_for(media_ref)
        self._player.play(media_ref)

    def _trigger_error(self, code: str) -> None:
        if self._state.state in {BoxState.PLAYING, BoxState.PAUSED}:
            self._player.pause()
        self._state.state = BoxState.ERROR
        self._state.last_error = code
        self._player.play(f"system:error:{code}")
        self._clear_playback_state()

    def _clear_playback_state(self) -> None:
        self._state.state = BoxState.IDLE
        self._state.active_uid = None
        self._state.playback_type = None
        self._state.playback_path = None
        self._state.current_media = None
        self._state.current_file = None
        self._state.current_duration = None
        self._state.file_index = None
        self._state.position = None
        self._state._playlist = []

    def trigger_error(self, code: str) -> None:
        self._trigger_error(code)
