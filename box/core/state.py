"""State model for the Box runtime (placeholder)."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class BoxState(str, Enum):
    IDLE = "IDLE"
    PLAYING = "PLAYING"
    PAUSED = "PAUSED"


@dataclass
class RuntimeState:
    box_id: str
    state: BoxState = BoxState.IDLE
    current_media: Optional[str] = None
    volume: int = 0
    active_uid: Optional[str] = None
    playback_type: Optional[str] = None
    playback_path: Optional[str] = None
    current_file: Optional[str] = None
    current_duration: Optional[int] = None
    file_index: Optional[int] = None
    position: Optional[int] = None
    _resume: dict[str, tuple[int, int]] = field(default_factory=dict)
    _playlist: list[str] = field(default_factory=list)
