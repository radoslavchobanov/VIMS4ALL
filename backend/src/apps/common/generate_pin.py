import secrets, hmac, hashlib
from typing import Union
import uuid


def generate_pin(
    prefix: str,
    institute_id: Union[int, str],
    first_name: str,
    *,
    hash_len: int = 10,
    rand_len: int = 4,
) -> str:
    """
    Minimal PIN generator with randomness (no secrets/HMAC).
    - prefix: e.g. "S", "E"
    - institute_id: int or str
    - first_name: person's first name

    Output shape (default): <PREFIX><hash_len hex><rand_len alnum>
      e.g. "S9f2a1c0b7dK3P8"

    Notes:
    - hash = SHA1(str(institute_id).lower() + "|" + first_name.lower()), sliced to `hash_len`
    - random = first `rand_len` chars of uuid4 (hex), uppercased for variety (alphanumeric)
    """
    if not prefix or not first_name:
        raise ValueError("prefix and first_name are required")

    pref = prefix.strip().upper()
    name = first_name.strip().lower()
    inst = str(institute_id).strip().lower()

    # deterministic part from institute+name
    seed = f"{inst}|{name}".encode("utf-8")
    hash_part = hashlib.sha1(seed).hexdigest()[:hash_len]

    # random part (no secrets): use uuid4 hex and uppercase it for mixed alnum look
    rand_part = uuid.uuid4().hex[:rand_len].upper()

    return f"{pref}{hash_part}{rand_part}"
