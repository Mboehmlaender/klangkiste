"""CLI entrypoint for the Box runtime (Phase 1a)."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import os
import sys
import shutil
from pathlib import Path
from typing import Any

import uvicorn

from api.http import create_app
from core.announce import AnnounceConfig, announce_loop, pairing_poll_loop
from core.box_controller import BoxController
from core.identity import generate_box_id
from core.lifecycle import NetworkLifecycle
from core.media_sync import MediaSyncClient
from core.pairing import PairingManager
from core.state import BoxState, RuntimeState
from player.mock_player import MockPlayer
from setup.webui import create_setup_app
from spotify.mock import MockSpotifyBackend
from storage.box_store import BoxStore
from storage.state_store import StateStore
from storage.secret_store import SecretStore
from wifi.mock import MockWifiBackend


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="klangkiste-box",
        description="Klangkiste Box CLI (Phase 1a, local simulation)",
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
    subparsers.add_parser("factory-reset", help="Factory reset (delete all local data)")
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


def _prune_resume(state: RuntimeState, tags: dict[str, Any]) -> bool:
    if not isinstance(tags, dict):
        return False
    valid_uids = {uid for uid, tag in tags.items() if isinstance(tag, dict)}
    stale_uids = [uid for uid in state._resume.keys() if uid not in valid_uids]
    if not stale_uids:
        return False
    for uid in stale_uids:
        state._resume.pop(uid, None)
    return True


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

    base_dir = Path(__file__).resolve().parent / "data"
    base_dir.mkdir(parents=True, exist_ok=True)
    media_root = Path(__file__).resolve().parent / "media"
    media_root.mkdir(parents=True, exist_ok=True)

    box_store = BoxStore(base_dir)
    box_meta = box_store.load()
    if "box_id" not in box_meta:
        box_meta["box_id"] = generate_box_id()
    if "settings" not in box_meta:
        box_meta["settings"] = {}
    if "tags" not in box_meta:
        box_meta["tags"] = {}
    env_server_url = os.getenv("KLANGKISTE_SERVER_URL")
    if env_server_url:
        box_meta["server_url"] = env_server_url
    elif "server_url" not in box_meta:
        box_meta["server_url"] = "http://127.0.0.1:5001"
    if "firmware_version" not in box_meta:
        box_meta["firmware_version"] = "0.1.0"
    if "capabilities" not in box_meta:
        box_meta["capabilities"] = {"nfc": True, "audio": True, "spotify": True}
    box_store.save(box_meta)

    state_store = StateStore(base_dir)
    state_data = state_store.load()

    state = _state_from_data(box_meta, state_data)
    resume_pruned = _prune_resume(state, box_meta.get("tags", {}))
    secrets = SecretStore(base_dir, state.box_id)
    secrets.ensure_secret_seed()
    wifi_backend = MockWifiBackend(state_store, secrets)
    spotify_backend = MockSpotifyBackend(secrets)
    lifecycle = NetworkLifecycle(wifi_backend)
    pairing_manager = PairingManager(state_store, secrets)
    media_sync = MediaSyncClient(
        server_url=str(box_meta.get("server_url")),
        box_id=state.box_id,
        token_provider=pairing_manager.get_api_token,
    )
    controller = BoxController(
        state=state,
        player=MockPlayer(),
        config=box_meta,
        config_path=str(box_store.path),
        media_sync=media_sync,
    )
    if resume_pruned:
        _persist_resume(controller, state_store)

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

    if args.command == "factory-reset":
        _factory_reset(controller, box_store, state_store, secrets, media_root)
        print("Factory reset completed. Restart required.")
        return 0

    if args.command == "run":
        announce_interval = _parse_int_env("KLANGKISTE_ANNOUNCE_INTERVAL", 30)
        poll_interval = _parse_int_env("KLANGKISTE_POLL_INTERVAL", 10)
        api_port = _parse_int_env("KLANGKISTE_API_PORT", 8000)
        setup_port = _parse_int_env("KLANGKISTE_SETUP_PORT", 9000)
        try:
            asyncio.run(
                _run_with_api(
                    controller,
                    state_store,
                    lifecycle,
                    wifi_backend,
                    spotify_backend,
                    pairing_manager,
                    secrets,
                    AnnounceConfig(
                        server_url=str(box_meta.get("server_url")),
                        firmware_version=str(box_meta.get("firmware_version")),
                        capabilities=dict(box_meta.get("capabilities", {})),
                        api_port=api_port,
                        setup_port=setup_port,
                        media_root=str(media_root.resolve()),
                        announce_interval_seconds=announce_interval,
                        polling_interval_seconds=poll_interval,
                    ),
                )
            )
        except KeyboardInterrupt:
            return 0
        return 0

    return 0


def _resume_to_json(state: RuntimeState) -> dict[str, dict[str, int]]:
    return {
        uid: {"file_index": file_index, "position": position}
        for uid, (file_index, position) in state._resume.items()
    }


def _parse_int_env(name: str, default_value: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default_value
    try:
        value = int(raw)
    except ValueError:
        return default_value
    if value <= 0:
        return default_value
    return value


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
    pairing_manager: PairingManager,
    secrets: SecretStore,
    announce_config: AnnounceConfig,
) -> None:
    base_dir = Path(__file__).resolve().parent / "data"
    media_root = Path(__file__).resolve().parent / "media"
    box_store = BoxStore(base_dir)
    app = create_app(
        controller,
        lifecycle,
        wifi_backend,
        spotify_backend,
        pairing_manager,
        lambda: _persist_resume(controller, storage),
        lambda: _factory_reset(controller, box_store, storage, secrets, media_root),
    )
    api_server = uvicorn.Server(
        uvicorn.Config(
            app,
            host="0.0.0.0",
            port=announce_config.api_port,
            log_level="warning",
            access_log=False,
        )
    )
    setup_app = create_setup_app(lifecycle, wifi_backend)
    setup_server = uvicorn.Server(
        uvicorn.Config(
            setup_app,
            host="0.0.0.0",
            port=announce_config.setup_port,
            log_level="warning",
            access_log=False,
        )
    )
    stop_event = asyncio.Event()
    tick_task = asyncio.create_task(
        _auto_tick_loop(controller, storage, stop_event)
    )
    announce_task = asyncio.create_task(
        announce_loop(
            controller.state.box_id,
            secrets=secrets,
            pairing=pairing_manager,
            config=announce_config,
            stop_event=stop_event,
        )
    )
    poll_task = asyncio.create_task(
        pairing_poll_loop(controller.state.box_id, pairing_manager, announce_config, stop_event)
    )
    api_task = asyncio.create_task(api_server.serve())
    setup_task = asyncio.create_task(setup_server.serve())

    try:
        if _stdin_is_foreground():
            await _run_session(
                controller,
                storage,
                lambda: _factory_reset(
                    controller,
                    box_store,
                    storage,
                    secrets,
                    media_root,
                ),
            )
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
        announce_task.cancel()
        poll_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await announce_task
        with contextlib.suppress(asyncio.CancelledError):
            await poll_task
        setup_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await setup_task


async def _run_session(
    controller: BoxController, storage: StateStore, factory_reset: callable
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
        if command == "factory-reset":
            factory_reset()
            print("Factory reset completed. Restart required.")
            break
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


def _factory_reset(
    controller: BoxController,
    box_store: BoxStore,
    state_store: StateStore,
    secrets: SecretStore,
    media_root: Path,
) -> None:
    controller.factory_reset()
    if box_store.path.exists():
        box_store.path.unlink()
    if state_store.path.exists():
        state_store.path.unlink()
    secrets.clear_all()
    shutil.rmtree(media_root, ignore_errors=True)
    media_root.mkdir(parents=True, exist_ok=True)


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
    print("  factory-reset     delete all local data (restart required)")
    print("  help              show this help")
    print("  exit | quit       leave interactive mode")


if __name__ == "__main__":
    raise SystemExit(main())
