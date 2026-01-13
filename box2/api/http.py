"""HTTP API (FastAPI) for the Box."""

from __future__ import annotations

from typing import Any, Callable

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.box_controller import BoxController
from core.lifecycle import NetworkLifecycle
from core.pairing import PairingManager, PairingState
from spotify.base import SpotifyBackend
from wifi.base import WifiBackend


class CommandRequest(BaseModel):
    command: str
    payload: dict[str, Any] = {}


def create_app(
    controller: BoxController,
    lifecycle: NetworkLifecycle,
    wifi_backend: WifiBackend,
    spotify_backend: SpotifyBackend,
    pairing_manager: PairingManager,
    persist_state: Callable[[], None],
    factory_reset: Callable[[], None],
) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/status")
    def status() -> dict[str, Any]:
        snapshot = lifecycle.snapshot()
        state = controller.state
        return {
            "box_id": state.box_id,
            "pairing_state": pairing_manager.state.value,
            "wifi_state": snapshot.wifi_state.value,
            "ip_address": snapshot.ip_address,
            "connected_ssid": snapshot.connected_ssid,
            "wifi_profiles_count": snapshot.wifi_profiles_count,
            "spotify_status": spotify_backend.status,
            "last_nfc": {
                "uid": state.last_nfc_uid,
                "known": state.last_nfc_known,
            },
            "last_nfc_at": state.last_nfc_at,
            "playback_state": {
                "state": state.state.value,
                "active_uid": state.active_uid,
                "playback_root": state.playback_path,
                "current_file": state.current_media,
                "file_index": state.file_index,
                "position": state.position,
                "duration": state.current_duration,
                "volume": state.volume,
                "last_error": state.last_error,
            },
            "blocked_tags": controller.config.get("blocked_tags", []),
        }

    @app.get("/local-tags")
    def local_tags(http_request: Request) -> dict[str, Any]:
        if not _is_authorized(pairing_manager, http_request):
            raise HTTPException(status_code=403, detail="pairing required")
        tags = controller.config.get("tags", {})
        result = []
        if isinstance(tags, dict):
            for uid, tag in tags.items():
                if not isinstance(tag, dict):
                    continue
                path_value = tag.get("path")
                if not isinstance(path_value, str):
                    continue
                root = controller._resolve_path(path_value)
                files = []
                total_size = 0
                if root.exists() and root.is_dir():
                    for file_path in root.rglob("*"):
                        if not file_path.is_file():
                            continue
                        rel_path = file_path.relative_to(root).as_posix()
                        files.append(rel_path)
                        try:
                            total_size += file_path.stat().st_size
                        except OSError:
                            continue
                result.append(
                    {
                        "uid": uid,
                        "path": path_value,
                        "media_exists": bool(files),
                        "file_count": len(files),
                        "total_size": total_size,
                        "files": files,
                    }
                )
        return {"tags": result}

    @app.post("/command")
    def command(request: CommandRequest, http_request: Request) -> dict[str, Any]:
        cmd = request.command
        payload = request.payload or {}

        if _requires_pairing(cmd) and not _is_authorized(pairing_manager, http_request):
            raise HTTPException(status_code=403, detail="pairing required")

        if cmd == "nfc_on":
            uid = payload.get("uid")
            if not isinstance(uid, str):
                raise HTTPException(status_code=400, detail="uid is required")
            controller.handle_nfc_on(uid)
        elif cmd == "nfc_off":
            uid = payload.get("uid")
            if not isinstance(uid, str):
                raise HTTPException(status_code=400, detail="uid is required")
            controller.handle_nfc_off(uid)
        elif cmd == "play_pause":
            controller.play_pause()
        elif cmd == "next":
            controller.next_track()
        elif cmd == "prev":
            controller.prev_track()
        elif cmd in {"vol_up", "volume_up"}:
            controller.volume_up()
        elif cmd in {"vol_down", "volume_down"}:
            controller.volume_down()
        elif cmd == "stop":
            if controller.state.active_uid:
                controller.handle_nfc_off(controller.state.active_uid)
            else:
                controller.stop()
        elif cmd == "trigger_error":
            error_type = payload.get("type")
            if not isinstance(error_type, str):
                raise HTTPException(status_code=400, detail="type is required")
            controller.trigger_error(error_type)
        elif cmd == "wifi_add_profile":
            ssid = payload.get("ssid")
            password = payload.get("password")
            priority = payload.get("priority", 0)
            if not isinstance(ssid, str) or not isinstance(password, str):
                raise HTTPException(status_code=400, detail="ssid and password required")
            if not isinstance(priority, int):
                priority = 0
            wifi_backend.add_profile(ssid, password, priority)
        elif cmd == "wifi_reset":
            wifi_backend.reset()
        elif cmd == "spotify_set_tokens":
            access_token = payload.get("access_token")
            refresh_token = payload.get("refresh_token")
            expires_at = payload.get("expires_at")
            account_id = payload.get("account_id")
            if not isinstance(access_token, str) or not isinstance(refresh_token, str):
                raise HTTPException(status_code=400, detail="tokens are required")
            if not isinstance(expires_at, int):
                raise HTTPException(status_code=400, detail="expires_at is required")
            if account_id is not None and not isinstance(account_id, str):
                raise HTTPException(status_code=400, detail="account_id must be string")
            spotify_backend.set_tokens(access_token, refresh_token, expires_at, account_id)
        elif cmd == "spotify_clear":
            spotify_backend.clear()
        elif cmd == "unpair":
            pairing_manager.unpair(reset_state=True)
        elif cmd == "tag_assign":
            uid = payload.get("uid")
            media_path = payload.get("media_path")
            if not isinstance(uid, str) or not isinstance(media_path, str):
                raise HTTPException(status_code=400, detail="uid and media_path required")
            controller.set_tag(uid, media_path)
        elif cmd == "tag_remove":
            uid = payload.get("uid")
            if not isinstance(uid, str):
                raise HTTPException(status_code=400, detail="uid is required")
            controller.remove_tag(uid)
        elif cmd == "tag_block":
            uid = payload.get("uid")
            if not isinstance(uid, str):
                raise HTTPException(status_code=400, detail="uid is required")
            controller.block_tag(uid)
        elif cmd == "tag_unblock":
            uid = payload.get("uid")
            if not isinstance(uid, str):
                raise HTTPException(status_code=400, detail="uid is required")
            controller.unblock_tag(uid)
        elif cmd == "export_tag":
            uid = payload.get("uid")
            target_folder = payload.get("target_folder")
            if not isinstance(uid, str) or not isinstance(target_folder, str):
                raise HTTPException(status_code=400, detail="uid and target_folder required")
            if "/" in target_folder or "\\" in target_folder or not target_folder.strip():
                raise HTTPException(status_code=400, detail="invalid target_folder")
            ok = controller.export_tag_media(uid, target_folder.strip())
            if not ok:
                raise HTTPException(status_code=500, detail="export failed")
        elif cmd == "factory_reset":
            factory_reset()
            return {"ok": True, "restart_required": True}
        else:
            raise HTTPException(status_code=400, detail="unknown command")

        persist_state()
        return {"ok": True}

    return app


def _requires_pairing(command: str) -> bool:
    allowed_without_pairing = {
        "wifi_add_profile",
        "wifi_reset",
        "spotify_set_tokens",
        "spotify_clear",
        "factory_reset",
    }
    return command not in allowed_without_pairing


def _is_authorized(pairing: PairingManager, http_request: Request) -> bool:
    if not pairing.is_paired():
        return False
    token = pairing.get_api_token()
    if not token:
        return False
    header = http_request.headers.get("X-API-Token")
    if not header:
        return False
    return header == token
