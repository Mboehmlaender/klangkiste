"""Client to request media sync from the server."""

from __future__ import annotations

import json
import base64
from dataclasses import dataclass
from typing import Callable
from urllib import request, error


@dataclass
class MediaSyncClient:
    server_url: str
    box_id: str
    token_provider: Callable[[], str | None]
    timeout_seconds: int = 5

    def request_tag_media(self, uid: str) -> bool:
        token = self.token_provider()
        if not token:
            return False
        endpoint = f"{self.server_url.rstrip('/')}/api/boxes/{self.box_id}/media-sync"
        payload = json.dumps({"uid": uid}).encode("utf-8")
        req = request.Request(
            endpoint,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-API-Token": token,
            },
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                return 200 <= response.status < 300
        except error.HTTPError:
            return False
        except error.URLError:
            return False

    def resolve_tag(self, uid: str) -> tuple[str | None, str | None]:
        token = self.token_provider()
        if not token:
            return None, None
        endpoint = (
            f"{self.server_url.rstrip('/')}/api/boxes/{self.box_id}/resolve-tag"
        )
        payload = json.dumps({"uid": uid}).encode("utf-8")
        req = request.Request(
            endpoint,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-API-Token": token,
            },
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
        except error.HTTPError as http_error:
            try:
                detail = json.loads(http_error.read().decode("utf-8")).get("detail")
            except Exception:
                detail = None
            if detail == "tag_blocked":
                return None, "tag_blocked"
            return None, None
        except error.URLError:
            return None, None

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            return None, None
        media_path = data.get("media_path")
        if isinstance(media_path, str) and media_path:
            return media_path, None
        return None, None

    def upload_media_file(self, target_folder: str, rel_path: str, data: bytes) -> bool:
        token = self.token_provider()
        if not token:
            return False
        endpoint = (
            f"{self.server_url.rstrip('/')}/api/boxes/{self.box_id}/media-import"
        )
        payload = json.dumps(
            {
                "target_folder": target_folder,
                "rel_path": rel_path,
                "content_base64": base64.b64encode(data).decode("ascii"),
            }
        ).encode("utf-8")
        req = request.Request(
            endpoint,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-API-Token": token,
            },
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                return 200 <= response.status < 300
        except error.HTTPError:
            return False
        except error.URLError:
            return False
