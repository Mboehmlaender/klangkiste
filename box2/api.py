"""HTTP API for the Klangkiste Box (FastAPI)."""

from __future__ import annotations

from typing import Any, Callable

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.box_controller import BoxController
from storage.box_storage import BoxStorage
from wifi.manager import WifiManager
from spotify.manager import SpotifyManager


class CommandRequest(BaseModel):
    command: str
    payload: dict[str, Any] = {}


def create_app(
    controller: BoxController,
    persist_resume: Callable[[], None],
    wifi_manager: WifiManager,
    spotify_manager: SpotifyManager,
    storage: BoxStorage,
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
        state = controller.state
        return {
            "box_id": state.box_id,
            "network_status": wifi_manager.network_status,
            "connected_ssid": wifi_manager.connected_ssid,
            "wifi_profiles_count": wifi_manager.profiles_count,
            "spotify_status": spotify_manager.status,
            "server_status": _server_status(storage),
            "playback_status": {
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
    def command(request: CommandRequest) -> dict[str, Any]:
        cmd = request.command
        payload = request.payload or {}
        print(f"API command: {cmd} payload={payload}")

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
        elif cmd == "vol_up":
            controller.volume_up()
        elif cmd == "vol_down":
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
            wifi_manager.add_profile(ssid, password, priority)
        elif cmd == "wifi_remove_profile":
            ssid = payload.get("ssid")
            if not isinstance(ssid, str):
                raise HTTPException(status_code=400, detail="ssid is required")
            wifi_manager.remove_profile(ssid)
        elif cmd == "wifi_reset":
            wifi_manager.reset()
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
            spotify_manager.set_tokens(access_token, refresh_token, expires_at, account_id)
        elif cmd == "spotify_clear":
            spotify_manager.clear()
        else:
            raise HTTPException(status_code=400, detail="unknown command")

        persist_resume()
        return {"ok": True}

    return app


def _server_status(storage: BoxStorage) -> str:
    box_meta = storage.load_box_meta()
    if box_meta.get("server_reachable") is False:
        return "UNREACHABLE"
    if box_meta.get("server_reachable") is True:
        return "OK"
    return "UNKNOWN"
