"""CLI entrypoint for the Box runtime (Phase 1a)."""

from __future__ import annotations

import argparse
from typing import Any

from core.box_controller import BoxController
from core.state import RuntimeState
from player.mock_player import MockPlayer
from storage.json_storage import JsonStorage


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="klangkiste-box",
        description="Klangkiste Box CLI (Phase 1a, local simulation)",
    )
    parser.add_argument(
        "--config",
        default="config/box_config.json",
        help="Path to local box config JSON",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("status", help="Show current runtime status")

    nfc_on = subparsers.add_parser("simulate-nfc", help="Simulate NFC tag detection")
    nfc_on.add_argument("uid", help="NFC UID")

    nfc_off = subparsers.add_parser("simulate-nfc-off", help="Simulate NFC tag removal")
    nfc_off.add_argument("uid", help="NFC UID")

    tick_parser = subparsers.add_parser("tick", help="Simulate playback time")
    tick_parser.add_argument("seconds", type=int, help="Seconds to advance")

    subparsers.add_parser("run", help="Start interactive session")
    return parser


def _state_from_config(config: dict[str, Any]) -> RuntimeState:
    box_id = str(config.get("box_id", "unknown"))
    settings = config.get("settings", {}) if isinstance(config.get("settings"), dict) else {}
    default_volume = settings.get("default_volume", 0)
    state = RuntimeState(box_id=box_id, volume=int(default_volume))

    resume_raw = config.get("resume", {})
    if isinstance(resume_raw, dict):
        for uid, data in resume_raw.items():
            if not isinstance(uid, str) or not isinstance(data, dict):
                continue
            file_index = data.get("file_index")
            position = data.get("position")
            if isinstance(file_index, int) and isinstance(position, int):
                state._resume[uid] = (file_index, position)
    return state


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


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    storage = JsonStorage(args.config)
    config = storage.load_config()
    state = _state_from_config(config)
    controller = BoxController(
        state=state,
        player=MockPlayer(),
        config=config,
        config_path=args.config,
    )

    if args.command == "status":
        _print_status(controller.state)
        return 0

    if args.command == "simulate-nfc":
        controller.handle_nfc_on(args.uid)
        _print_status(controller.state)
        config["resume"] = _resume_to_json(controller.state)
        storage.save_config(config)
        return 0

    if args.command == "simulate-nfc-off":
        controller.handle_nfc_off(args.uid)
        _print_status(controller.state)
        config["resume"] = _resume_to_json(controller.state)
        storage.save_config(config)
        return 0

    if args.command == "tick":
        controller.tick(args.seconds)
        _print_status(controller.state)
        config["resume"] = _resume_to_json(controller.state)
        storage.save_config(config)
        return 0

    if args.command == "run":
        _run_session(controller, storage, config)
        return 0

    return 0


def _resume_to_json(state: RuntimeState) -> dict[str, dict[str, int]]:
    return {
        uid: {"file_index": file_index, "position": position}
        for uid, (file_index, position) in state._resume.items()
    }


def _run_session(controller: BoxController, storage: JsonStorage, config: dict[str, Any]) -> None:
    print("Klangkiste Box - Interactive Mode")
    print("Type 'help' for commands.")
    while True:
        try:
            raw = input("> ").strip()
        except EOFError:
            print()
            break
        if not raw:
            continue
        parts = raw.split()
        command = parts[0]
        args = parts[1:]

        if command in {"exit", "quit"}:
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
            _persist_resume(controller, storage, config)
            continue
        if command == "nfc-off":
            if len(args) != 1:
                print("error: usage: nfc-off <UID>")
                continue
            controller.handle_nfc_off(args[0])
            _print_status(controller.state)
            _persist_resume(controller, storage, config)
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
            _persist_resume(controller, storage, config)
            continue

        print(f"error: unknown command '{command}'")


def _persist_resume(
    controller: BoxController, storage: JsonStorage, config: dict[str, Any]
) -> None:
    config["resume"] = _resume_to_json(controller.state)
    storage.save_config(config)


def _print_help() -> None:
    print("Commands:")
    print("  nfc <UID>         simulate NFC tag detection")
    print("  nfc-off <UID>     simulate NFC tag removal")
    print("  tick <seconds>    simulate time progression")
    print("  status            show current status")
    print("  help              show this help")
    print("  exit | quit       leave interactive mode")


if __name__ == "__main__":
    raise SystemExit(main())
