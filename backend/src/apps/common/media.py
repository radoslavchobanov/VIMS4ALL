from __future__ import annotations
from typing import Optional
from urllib.parse import quote
from django.conf import settings
from django.core.files.storage import default_storage
from apps.institutes.models import Institute


def public_media_url(
    key: Optional[str], fallback_institute_id: Optional[int] = None, timestamp: Optional[str] = None
) -> Optional[str]:
    """
    Build a browser-facing URL for an object key inside the media bucket.

    - If MEDIA_PUBLIC_BASE is set, we join it with the key.
    - Otherwise we fall back to storage.url(key).
    - If no key is provided, we fall back to the current institute's logo (if set).
    - If timestamp is provided, append it as a query parameter for cache busting.
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
        url = f"{base.rstrip('/')}/{quote(key)}"
    else:
        try:
            url = default_storage.url(key)
        except Exception:
            return None

    # Add cache-busting timestamp if provided
    if timestamp and url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}v={timestamp}"

    return url
