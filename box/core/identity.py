"""Box identity generation and management."""

from __future__ import annotations

import hashlib
import secrets
import string

PREFIX = "klangkiste-"
LETTERS = string.ascii_lowercase
DIGITS = string.digits
SUFFIX_LENGTH = 10
STATIC_APP_SALT = "klangkiste-static-app-salt-v1"


def generate_box_id() -> str:
    start_with_letter = secrets.choice([True, False])
    suffix_chars = []
    for i in range(SUFFIX_LENGTH):
        if (i % 2 == 0) == start_with_letter:
            suffix_chars.append(secrets.choice(LETTERS))
        else:
            suffix_chars.append(secrets.choice(DIGITS))
    suffix = "".join(suffix_chars)
    return f"{PREFIX}{suffix}"


def compute_fingerprint(box_id: str, secret_seed: str) -> str:
    payload = f"{box_id}{secret_seed}{STATIC_APP_SALT}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()
