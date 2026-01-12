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
        }

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
