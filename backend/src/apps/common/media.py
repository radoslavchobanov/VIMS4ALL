from __future__ import annotations
from typing import Optional
from urllib.parse import quote
from django.conf import settings
from django.core.files.storage import default_storage
from apps.institutes.models import Institute


def public_media_url(
    key: Optional[str], fallback_institute_id: Optional[int] = None
) -> Optional[str]:
    """
    Build a browser-facing URL for an object key inside the media bucket.

    - If MEDIA_PUBLIC_BASE is set, we join it with the key.
    - Otherwise we fall back to storage.url(key).
    - If no key is provided, we fall back to the current institute's logo (if set).
    """

    if not key:
        # Try institute fallback
        if fallback_institute_id:
            try:
                inst = Institute.objects.only("logo_key").get(id=fallback_institute_id)
                key = inst.logo_key
            except Institute.DoesNotExist:
                return None

    if not key:
        return None

    base = getattr(settings, "MEDIA_PUBLIC_BASE", None)
    if base:
        return f"{base.rstrip('/')}/{quote(key)}"

    try:
        return default_storage.url(key)
    except Exception:
        return None
