"""Server announce and pairing polling client."""

from __future__ import annotations

import asyncio
import json
import urllib.request
from dataclasses import dataclass
from typing import Any

from core.identity import compute_fingerprint
from core.pairing import PairingManager, PairingState
from storage.secret_store import SecretStore


@dataclass
class AnnounceConfig:
    server_url: str
    firmware_version: str
    capabilities: dict[str, Any]
    api_port: int
    setup_port: int
    media_root: str
    announce_interval_seconds: int = 30
    polling_interval_seconds: int = 10


def build_payload(
    box_id: str,
    secret_seed: str,
    config: AnnounceConfig,
) -> dict[str, Any]:
    fingerprint = compute_fingerprint(box_id, secret_seed)
    return {
        "box_id": box_id,
        "fingerprint": fingerprint,
        "firmware_version": config.firmware_version,
        "capabilities": config.capabilities,
        "api_port": config.api_port,
        "setup_port": config.setup_port,
        "media_root": config.media_root,
    }


def _post_json(url: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode("utf-8")
    except Exception:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return None


async def announce_loop(
    box_id: str,
    secrets: SecretStore,
    pairing: PairingManager,
    config: AnnounceConfig,
    stop_event: asyncio.Event,
) -> None:
    secret_seed = secrets.ensure_secret_seed()
    payload = build_payload(box_id, secret_seed, config)
    announce_url = f"{config.server_url}/api/boxes/announce"

    while not stop_event.is_set():
        response = await asyncio.to_thread(_post_json, announce_url, payload)
        if response and response.get("force_unpair") is True:
            pairing.unpair(reset_state=True)
        await asyncio.sleep(config.announce_interval_seconds)


async def pairing_poll_loop(
    box_id: str,
    pairing: PairingManager,
    config: AnnounceConfig,
    stop_event: asyncio.Event,
) -> None:
    poll_url = f"{config.server_url}/api/boxes/poll-pairing"
    payload = {"box_id": box_id}
    while not stop_event.is_set():
        if pairing.is_paired():
            await asyncio.sleep(config.polling_interval_seconds)
            continue
        pairing.set_state(PairingState.PAIRING_PENDING)
        response = await asyncio.to_thread(_post_json, poll_url, payload)
        if response and response.get("paired") is True:
            token = response.get("api_token")
            if isinstance(token, str) and token:
                pairing.save_api_token(token)
        await asyncio.sleep(config.polling_interval_seconds)
