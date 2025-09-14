from __future__ import annotations
from typing import Optional
from urllib.parse import quote
from django.conf import settings
from django.core.files.storage import default_storage


def public_media_url(key: Optional[str]) -> Optional[str]:
    """
    Build a browser-facing URL for an object key inside the media bucket.
    - If MEDIA_PUBLIC_BASE is set, we join it with the key.
    - Otherwise we fall back to storage.url(key).
    """
    if not key:
        return None

    base = getattr(settings, "MEDIA_PUBLIC_BASE", None)
    if base:
        return f"{base.rstrip('/')}/{quote(key)}"

    # Fallback (uses S3 endpoint/custom domain rules)
    try:
        return default_storage.url(key)
    except Exception:
        return None
