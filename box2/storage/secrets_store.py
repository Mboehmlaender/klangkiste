"""Encrypted secret storage for sensitive Box data."""

from __future__ import annotations

import base64
import json
from hashlib import pbkdf2_hmac
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

STATIC_SALT = b"klangkiste-static-salt-v1"
KDF_ITERATIONS = 200_000


class SecretsStore:
    def __init__(self, base_dir: Path, box_id: str) -> None:
        self._path = base_dir / "secrets.enc"
        self._box_id = box_id

    def load_secrets(self) -> dict[str, Any]:
        if not self._path.exists():
            return {}
        token = self._path.read_bytes()
        fernet = Fernet(self._derive_key())
        try:
            payload = fernet.decrypt(token)
        except InvalidToken:
            return {}
        return json.loads(payload.decode("utf-8"))

    def save_secrets(self, data: dict[str, Any]) -> None:
        fernet = Fernet(self._derive_key())
        payload = json.dumps(data, indent=2).encode("utf-8")
        token = fernet.encrypt(payload)
        self._path.write_bytes(token)

    def clear_wifi_secrets(self) -> None:
        data = self.load_secrets()
        if "wifi" in data:
            data.pop("wifi")
            self.save_secrets(data)

    def clear_all(self) -> None:
        if self._path.exists():
            self._path.unlink()

    def _derive_key(self) -> bytes:
        raw = pbkdf2_hmac(
            "sha256",
            self._box_id.encode("utf-8"),
            STATIC_SALT,
            KDF_ITERATIONS,
            dklen=32,
        )
        return base64.urlsafe_b64encode(raw)
