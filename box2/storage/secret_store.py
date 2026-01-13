"""Encrypted secret storage for sensitive Box data (app-level)."""

from __future__ import annotations

import base64
import json
from hashlib import pbkdf2_hmac
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

STATIC_SALT = b"klangkiste-static-salt-v1"
KDF_ITERATIONS = 200_000


class SecretStore:
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

    def ensure_secret_seed(self) -> str:
        data = self.load_secrets()
        seed = data.get("secret_seed")
        if isinstance(seed, str) and seed:
            return seed
        seed_value = self._generate_seed()
        data["secret_seed"] = seed_value
        self.save_secrets(data)
        return seed_value

    def get_secret_seed(self) -> str | None:
        data = self.load_secrets()
        seed = data.get("secret_seed")
        if isinstance(seed, str) and seed:
            return seed
        return None

    def save_api_token(self, token: str) -> None:
        data = self.load_secrets()
        data["api_token"] = token
        self.save_secrets(data)

    def get_api_token(self) -> str | None:
        data = self.load_secrets()
        token = data.get("api_token")
        if isinstance(token, str) and token:
            return token
        return None

    def clear_api_token(self) -> None:
        data = self.load_secrets()
        if "api_token" in data:
            data.pop("api_token")
            self.save_secrets(data)

    def clear_wifi_secrets(self) -> None:
        data = self.load_secrets()
        if "wifi_profiles" in data:
            data.pop("wifi_profiles")
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

    @staticmethod
    def _generate_seed() -> str:
        import secrets

        return secrets.token_hex(32)
