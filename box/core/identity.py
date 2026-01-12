"""Box identity generation and management."""

from __future__ import annotations

import secrets
import string

PREFIX = "klangkiste-"
ALPHABET = string.ascii_lowercase + string.digits
SUFFIX_LENGTH = 10


def generate_box_id() -> str:
    suffix = "".join(secrets.choice(ALPHABET) for _ in range(SUFFIX_LENGTH))
    return f"{PREFIX}{suffix}"
