"""CLI entrypoint for the Box runtime (Phase 1a)."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import os
import sys
from pathlib import Path
from typing import Any

import uvicorn

from api.http import create_app
from core.box_controller import BoxController
from core.identity import generate_box_id
from core.lifecycle import NetworkLifecycle
from core.state import BoxState, RuntimeState
from player.mock_player import MockPlayer
from setup.webui import create_setup_app
from spotify.mock import MockSpotifyBackend
from storage.box_store import BoxStore
from storage.state_store import StateStore
from storage.secret_store import SecretStore
from storage.json_storage import JsonStorage
from wifi.mock import MockWifiBackend


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="klangkiste-box",
        description="Klangkiste Box CLI (Phase 1a, local simulation)",
    )
    parser.add_argument(
        "--config",
        default="config/box_config.json",
        help=\"Path to local box config JSON (legacy seed)\",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("status", help="Show current runtime status")

    nfc_on = subparsers.add_parser("simulate-nfc", help="Simulate NFC tag detection")
    nfc_on.add_argument("uid", help="NFC UID")

    nfc_off = subparsers.add_parser("simulate-nfc-off", help="Simulate NFC tag removal")
    nfc_off.add_argument("uid", help="NFC UID")

    tick_parser = subparsers.add_parser("tick", help="Simulate playback time")
    tick_parser.add_argument("seconds", type=int, help="Seconds to advance")

    subparsers.add_parser("run", help="Start interactive session + HTTP API")
    return parser


def _state_from_data(
    box_meta: dict[str, Any], state_data: dict[str, Any]
) -> RuntimeState:
    box_id = str(box_meta.get("box_id", "unknown"))
    settings = box_meta.get("settings", {}) if isinstance(box_meta.get("settings"), dict) else {}
    default_volume = settings.get("default_volume", 0)
    max_volume = settings.get("max_volume", 100)
    state = RuntimeState(
        box_id=box_id,
        volume=int(default_volume),
        max_volume=int(max_volume),
    )

    resume_raw = state_data.get("resume", {})
    if isinstance(resume_raw, dict):
        for uid, data in resume_raw.items():
            if not isinstance(uid, str) or not isinstance(data, dict):
                continue
            file_index = data.get("file_index")
            position = data.get("position")
            if isinstance(file_index, int) and isinstance(position, int):
                state._resume[uid] = (file_index, position)
    return state


def _normalize_tag_paths(tags: dict[str, Any]) -> dict[str, Any]:
    normalized = {}
    for uid, tag in tags.items():
        if not isinstance(tag, dict):
            continue
        path = tag.get("path")
        if isinstance(path, str) and path.startswith("../media/"):
            tag = dict(tag)
            tag["path"] = path.replace("../media/", "media/", 1)
        normalized[uid] = tag
    return normalized


def _print_status(state: RuntimeState) -> None:
    current = state.current_media if state.current_media is not None else "-"
    current_file = state.current_file if state.current_file is not None else "-"
    current_duration = state.current_duration if state.current_duration is not None else "-"
    active_uid = state.active_uid if state.active_uid is not None else "-"
    playback = state.playback_path if state.playback_path is not None else "-"
    file_index = state.file_index if state.file_index is not None else "-"
    position = state.position if state.position is not None else "-"
    print(f"box_id={state.box_id}")
    print(f"state={state.state.value}")
    print(f"active_uid={active_uid}")
    print(f"playback={playback}")
    print(f"current_file={current_file}")
    print(f"file_index={file_index}")
    print(f"position={position}")
    print(f"duration={current_duration}")
    print(f"current_media={current}")
    print(f"volume={state.volume}")
    print(f"max_volume={state.max_volume}")


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = (Path(__file__).resolve().parent / config_path).resolve()
    base_dir = Path(__file__).resolve().parent / "data"
    base_dir.mkdir(parents=True, exist_ok=True)
    (base_dir / "media").mkdir(parents=True, exist_ok=True)

    box_store = BoxStore(base_dir)
    box_meta = box_store.load()
    if "box_id" not in box_meta:
        box_meta["box_id"] = generate_box_id()
    if "settings" not in box_meta:
        box_meta["settings"] = {}
    if "tags" not in box_meta:
        legacy_storage = JsonStorage(str(config_path))
        legacy_config = legacy_storage.load_config()
        if isinstance(legacy_config.get("tags"), dict):
            box_meta["tags"] = _normalize_tag_paths(legacy_config.get("tags", {}))
    if isinstance(box_meta.get("tags"), dict):
        box_meta["tags"] = _normalize_tag_paths(box_meta.get("tags", {}))
    box_store.save(box_meta)

    state_store = StateStore(base_dir)
    state_data = state_store.load()

    state = _state_from_data(box_meta, state_data)
    secrets = SecretStore(base_dir, state.box_id)
    wifi_backend = MockWifiBackend(state_store, secrets)
    spotify_backend = MockSpotifyBackend(secrets)
    lifecycle = NetworkLifecycle(wifi_backend)
    controller = BoxController(
        state=state,
        player=MockPlayer(),
        config=box_meta,
        config_path=str(box_store.path),
    )

    if args.command == "status":
        _print_status(controller.state)
        return 0

    if args.command == "simulate-nfc":
        controller.handle_nfc_on(args.uid)
        _print_status(controller.state)
        _persist_resume(controller, state_store)
        return 0

    if args.command == "simulate-nfc-off":
        controller.handle_nfc_off(args.uid)
        _print_status(controller.state)
        _persist_resume(controller, state_store)
        return 0

    if args.command == "tick":
        controller.tick(args.seconds)
        _print_status(controller.state)
        _persist_resume(controller, state_store)
        return 0

    if args.command == "run":
        asyncio.run(
            _run_with_api(
                controller,
                state_store,
                lifecycle,
                wifi_backend,
                spotify_backend,
            )
        )
        return 0

    return 0


def _resume_to_json(state: RuntimeState) -> dict[str, dict[str, int]]:
    return {
        uid: {"file_index": file_index, "position": position}
        for uid, (file_index, position) in state._resume.items()
    }


def _stdin_is_foreground() -> bool:
    try:
        if not sys.stdin.isatty():
            return False
        return os.getpgrp() == os.tcgetpgrp(sys.stdin.fileno())
    except OSError:
        return False


async def _run_with_api(
    controller: BoxController,
    storage: StateStore,
    lifecycle: NetworkLifecycle,
    wifi_backend: MockWifiBackend,
    spotify_backend: MockSpotifyBackend,
) -> None:
    app = create_app(
        controller,
        lifecycle,
        wifi_backend,
        spotify_backend,
        lambda: _persist_resume(controller, storage),
    )
    api_server = uvicorn.Server(
        uvicorn.Config(
            app,
            host="0.0.0.0",
            port=8000,
            log_level="warning",
            access_log=False,
        )
    )
    setup_app = create_setup_app(lifecycle, wifi_backend)
    setup_server = uvicorn.Server(
        uvicorn.Config(
            setup_app,
            host="127.0.0.1",
            port=9000,
            log_level="warning",
            access_log=False,
        )
    )
    stop_event = asyncio.Event()
    tick_task = asyncio.create_task(
        _auto_tick_loop(controller, storage, stop_event)
    )
    api_task = asyncio.create_task(api_server.serve())
    setup_task = asyncio.create_task(setup_server.serve())

    try:
        if _stdin_is_foreground():
            await _run_session(controller, storage)
            api_server.should_exit = True
            setup_server.should_exit = True
        await api_task
    except asyncio.CancelledError:
        api_server.should_exit = True
        setup_server.should_exit = True
    finally:
        stop_event.set()
        tick_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await tick_task
        setup_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await setup_task


async def _run_session(
    controller: BoxController, storage: StateStore
) -> None:
    print("Klangkiste Box - Interactive Mode")
    print("Type 'help' for commands.")
    while True:
        try:
            raw = await asyncio.to_thread(input, "> ")
            raw = raw.strip()
        except asyncio.CancelledError:
            break
        except EOFError:
            print()
            break
        if not raw:
            continue
        parts = raw.split()
        command = parts[0]
        args = parts[1:]

        if command in {"exit", "quit"}:
            if controller.state.active_uid is not None:
                controller.handle_nfc_off(controller.state.active_uid)
                _persist_resume(controller, storage)
            break
        if command == "help":
            _print_help()
            continue
        if command == "status":
            _print_status(controller.state)
            continue
        if command == "nfc":
            if len(args) != 1:
                print("error: usage: nfc <UID>")
                continue
            controller.handle_nfc_on(args[0])
            _print_status(controller.state)
            _persist_resume(controller, storage)
            continue
        if command == "nfc-off":
            if len(args) != 1:
                print("error: usage: nfc-off <UID>")
                continue
            controller.handle_nfc_off(args[0])
            _print_status(controller.state)
            _persist_resume(controller, storage)
            continue
        if command == "tick":
            if len(args) != 1:
                print("error: usage: tick <seconds>")
                continue
            try:
                seconds = int(args[0])
            except ValueError:
                print("error: seconds must be an integer")
                continue
            controller.tick(seconds)
            _print_status(controller.state)
            _persist_resume(controller, storage)
            continue
        if command in {"play", "pause"}:
            controller.play_pause()
            _print_status(controller.state)
            continue
        if command in {"next", "vor"}:
            controller.next_track()
            _print_status(controller.state)
            _persist_resume(controller, storage)
            continue
        if command in {"prev", "zurueck"}:
            controller.prev_track()
            _print_status(controller.state)
            _persist_resume(controller, storage)
            continue
        if command in {"vol-up", "lauter"}:
            controller.volume_up()
            _print_status(controller.state)
            continue
        if command in {"vol-down", "leiser"}:
            controller.volume_down()
            _print_status(controller.state)
            continue

        print(f"error: unknown command '{command}'")


async def _auto_tick_loop(
    controller: BoxController,
    storage: StateStore,
    stop_event: asyncio.Event,
) -> None:
    while not stop_event.is_set():
        await asyncio.sleep(1)
        if controller.state.state == BoxState.PLAYING:
            controller.tick(1)
            _persist_resume(controller, storage)


def _persist_resume(
    controller: BoxController, storage: StateStore
) -> None:
    data = storage.load()
    data["resume"] = _resume_to_json(controller.state)
    storage.save(data)


def _print_help() -> None:
    print("Commands:")
    print("  nfc <UID>         simulate NFC tag detection")
    print("  nfc-off <UID>     simulate NFC tag removal")
    print("  tick <seconds>    simulate time progression")
    print("  play | pause      toggle PLAYING/PAUSED")
    print("  next | vor        jump to next file")
    print("  prev | zurueck    jump to previous file")
    print("  vol-up | lauter   increase volume")
    print("  vol-down | leiser decrease volume")
    print("  status            show current status")
    print("  help              show this help")
    print("  exit | quit       leave interactive mode")


if __name__ == "__main__":
    raise SystemExit(main())
